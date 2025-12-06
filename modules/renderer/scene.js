import { createChunkManager } from './chunk.js';
import { getVertexOffset } from './vertex.js';
import { createWaterEffects } from './water/index.js';

import { resolvePalettes } from './palette.js';
import { advanceDayTime, getCycleProps } from './daycycle.js';
import { drawTreeShadow, drawTree, drawAquaticPlant, drawAquaticShadow, drawEntities, drawPlayer } from './objects.js';
import { renderFaunaBehind } from './scene/faunaBehind.js';
import { renderBirdsAhead } from './scene/faunaAhead.js';
import { shortestAngleDiff } from '../fauna/utils.js';
import { getRiverGradient } from '../fauna/behaviors/riverUtils.js'; 

// This file contains the original renderer implementation moved out of the monolith index.
// It exposes the same createRenderer({ canvas, state, game, noise }) API.

export function createRenderer({ canvas, state, game, noise }) {
  const ctx = canvas.getContext('2d', { alpha: false });

  const { WATER_PALETTE, COLORS, TREES, FLORA } = resolvePalettes(game);

  const CHUNK_SIZE = 16;
  const chunkManager = createChunkManager({ CHUNK_SIZE, COLORS, WATER_PALETTE, state, game, noise, getVertexOffset });
  const waterEffects = createWaterEffects({ state, game, noise });

  function resize() {
    const dpr = state.pixelRatio;
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = state.width * dpr;
    canvas.height = state.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    chunkManager.clearCache();
  }

  function renderFrame(timestamp) {
    // Advance day cycle
    advanceDayTime(state);
    const cycle = getCycleProps(state);
    const shadowDir = { x: cycle.shadowDirX, y: cycle.shadowDirY };
    // Duration (ms) for tree headlight afterglow fade-out
    const TREE_LIGHT_FADE_MS = 300;
    const now = performance.now();

    // Raft Light Constants
    const LIGHT_RADIUS = 14; 
    const LIGHT_ANGLE_WIDTH = 0.9;
    const lightIntensity = cycle.raftLightIntensity || 0;
    const effectiveLightRadius = LIGHT_RADIUS * lightIntensity; // Radians half-width (~50 degrees)

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, state.width, state.height);

    // Helper: derive a night-time tree shadeProgression from raft headlight.
    // - The SIDE of the light (left/right on screen) comes from the headlight direction.
    // - The AMOUNT of lit area comes from distance/brightness (falloff * intensity).
    // This maps into the same shadeProgression space that drawTree() uses:
    //   S in [0.05, 0.45]  -> "morning" branch, light on the right side.
    //   S in [0.55, 0.95]  -> "afternoon" branch, light on the left side.
    function computeTreeShadeFromHeadlight(falloffBrightness, lightDirX) {
      // Clamp 0..1 brightness from distance & light intensity
      const b = Math.max(0, Math.min(1, falloffBrightness || 0));
      // Decide which SCREEN side the light comes from: x>0 ≈ from the right, x<0 ≈ from the left.
      // Invert side so raft headlight lights the opposite face of trees
      const fromRight = lightDirX < 0;

      if (fromRight) {
        // Morning-style shading: right side lit.
        const minS = 0.05;
        const maxS = 0.45;
        return minS + b * (maxS - minS);
      } else {
        // Afternoon-style shading: left side lit.
        const minS = 0.55;
        const maxS = 0.95;
        // b=0 -> near 0.95 (mostly dark), b=1 -> near 0.55 (mostly lit)
        return maxS - b * (maxS - minS);
      }
    }

    if (!state.isPlaying) {
      const hue = (timestamp * 0.01) % 360;
      // Use a safe fallback color string
      ctx.fillStyle = `rgba(32,40,55,1)`;
      ctx.fillRect(0, 0, state.width, state.height);
      return;
    }

    const tileSize = state.tileSize;
    const centerX = state.width / 2;
    const centerY = state.height / 2;

    const viewLeftTile = state.camera.x - (state.width / 2) / tileSize;
    const viewRightTile = state.camera.x + (state.width / 2) / tileSize;
    const viewTopTile = state.camera.y - (state.height / 2) / tileSize;
    const viewBottomTile = state.camera.y + (state.height / 2) / tileSize;

    const startChunkX = Math.floor(viewLeftTile / CHUNK_SIZE);
    const endChunkX = Math.floor(viewRightTile / CHUNK_SIZE);
    const startChunkY = Math.floor(viewTopTile / CHUNK_SIZE);
    const endChunkY = Math.floor(viewBottomTile / CHUNK_SIZE);

    // Terrain
    for (let cy = startChunkY; cy <= endChunkY; cy++) {
      for (let cx = startChunkX; cx <= endChunkX; cx++) {
        const chunkImg = chunkManager.getChunk(cx, cy);
        const screenX = (cx * CHUNK_SIZE - state.camera.x) * tileSize + centerX;
        const screenY = (cy * CHUNK_SIZE - state.camera.y) * tileSize + centerY;
        if (screenX > state.width || screenY > state.height ||
            screenX + chunkImg.width < 0 || screenY + chunkImg.height < 0) continue;
        ctx.drawImage(chunkImg, Math.round(screenX), Math.round(screenY));
      }
    }

    // Underwater slope shading: darken water bands based on river slope vs sun direction
    // Uses the river gradient (bank-facing direction) and the opposite of shadowDir (sun direction)
    // so that the bank/slope "nearest the sun" appears darker at morning/evening and fades at noon.
    (function shadeUnderwater() {
      // If there is effectively no sun-driven shading (e.g., deep night or very low shadow alpha),
      // skip this pass.
      if (cycle.shadowAlpha <= 0.001 || cycle.shadowLength <= 0.0001) return;

      const sunDirX = -shadowDir.x;
      const sunDirY = -shadowDir.y;
      const sunDirLen = Math.hypot(sunDirX, sunDirY) || 1;
      const sunNX = sunDirX / sunDirLen;
      const sunNY = sunDirY / sunDirLen;

      // Use shadowAlpha as a proxy for "edge of day" intensity (strong at dawn/dusk, weak at noon)
      const strengthBase = Math.max(0, Math.min(1, cycle.shadowAlpha / 0.45)); // 0..1

      if (strengthBase <= 0.001) return;

      ctx.save();

      for (let ty = Math.floor(viewTopTile); ty <= Math.floor(viewBottomTile); ty++) {
        for (let tx = Math.floor(viewLeftTile); tx <= Math.floor(viewRightTile); tx++) {
          const tileType = game.getTile(tx, ty);
          if (tileType !== game.CONSTANTS.TILE_WATER) continue;

          // Sample gradient of river "value" at tile center; gradient points center -> bank (uphill)
          const wx = tx + 0.5;
          const wy = ty + 0.5;
          const { gx, gy, mag } = getRiverGradient(noise, wx, wy, 2.0);

          // Skip areas with essentially no slope (deep center or flat pools)
          if (mag < 0.05) continue;

          // Dot product between slope direction and sun direction: 
          // positive when bank "faces" the sun, which we darken.
          const dot = gx * sunNX + gy * sunNY;
          const angleFactor = Math.max(0, dot); // 0..1

          if (angleFactor <= 0.001) continue;

          const darkness = angleFactor * strengthBase;
          if (darkness <= 0.001) continue;

          const screenX = (tx - state.camera.x) * tileSize + centerX;
          const screenY = (ty - state.camera.y) * tileSize + centerY;

          // Cull off-screen tiles
          if (screenX > state.width || screenY > state.height ||
              screenX + tileSize < 0 || screenY + tileSize < 0) continue;

          const alpha = Math.min(0.5, 0.35 * darkness); // cap to keep subtle but perceptible
          if (alpha <= 0) continue;

          ctx.fillStyle = `rgba(0,0,0,${alpha})`;
          ctx.fillRect(Math.floor(screenX), Math.floor(screenY), Math.ceil(tileSize), Math.ceil(tileSize));
        }
      }

      ctx.restore();
    })();

    // Water effects
    waterEffects.render(ctx, state.camera, tileSize);

    // Fauna behind objects/player (fish, deer, critters, fireflies, turtles, etc.)
    renderFaunaBehind(ctx, state, tileSize, cycle, shadowDir, noise);

    // Objects: draw shadows then geometry for chunks in view
    for (let cy = startChunkY; cy <= endChunkY; cy++) {
      for (let cx = startChunkX; cx <= endChunkX; cx++) {
        const props = chunkManager.getChunkProps(cx, cy);
        
        // Prepare per-prop cycle/shadow settings
        // If raft light is active, check which props are lit

        // Draw shadows first
        for (const prop of props) {
          let propCycle = cycle;
          let propShadowDir = shadowDir;

          if (cycle.raftLightActive && effectiveLightRadius > 0.01) {
            const dx = prop.x - state.player.x;
            const dy = prop.y - state.player.y;
            const dist = Math.hypot(dx, dy);
            const angleTo = Math.atan2(dy, dx);
            const angleDiff = Math.abs(shortestAngleDiff(state.player.angle, angleTo));

            let brightness = 0;
            let litNow = false;

            if (dist < effectiveLightRadius && angleDiff < LIGHT_ANGLE_WIDTH) {
              // Currently inside the beam
              const falloff = (1.0 - (dist / effectiveLightRadius)) * (cycle.raftLightIntensity || 0);
              brightness = Math.max(0, Math.min(1, falloff));
              litNow = true;

              // Remember last light strength and direction for fade-out
              prop._lastLightStrength = brightness;
              prop._lastLightTime = now;
              prop._lastLightDirX = dx / Math.max(dist, 1e-6);
            } else {
              // Not currently lit: compute a short afterglow based on last illumination
              const lastTime = prop._lastLightTime || 0;
              const elapsed = lastTime ? (now - lastTime) : Infinity;
              const lastStrength = prop._lastLightStrength || 0;
              const fade = Math.max(0, 1 - elapsed / TREE_LIGHT_FADE_MS);
              brightness = lastStrength * fade;
            }

            if (brightness > 0.01) {
              // Shadow points away from player (use current or last-known direction)
              const dirX = dist > 1e-6 ? dx / dist : (prop._lastLightDirX || 0);
              const dirY = dist > 1e-6 ? dy / dist : 0;
              propShadowDir = { x: dirX, y: dirY };

              if (prop.type === 'forest' || prop.type === 'grass') {
                const lightDirX = (typeof prop._lastLightDirX === 'number' && !litNow)
                  ? prop._lastLightDirX
                  : propShadowDir.x;
                const nightShade = computeTreeShadeFromHeadlight(brightness, lightDirX);
                propCycle = Object.assign({}, cycle, {
                  shadowAlpha: 0.6 * brightness,
                  shadowLength: 1.0,
                  shadeProgression: nightShade
                });
              } else {
                propCycle = Object.assign({}, cycle, {
                  shadowAlpha: 0.6 * brightness,
                  shadowLength: 1.0,
                  shadeProgression: 0.5
                });
              }
            } else {
              // No remaining light: skip shadow at night
              continue;
            }
          }

          if (prop.type === 'forest' || prop.type === 'grass') {
             drawTreeShadow(ctx, state, state.camera, tileSize, prop, propCycle, propShadowDir);
          } else {
             // Aquatic props
             drawAquaticShadow(ctx, state, tileSize, prop, propCycle, propShadowDir);
          }
        }
        
        // Then draw geometry
        for (const prop of props) {
          let propCycle = cycle;
          if (cycle.raftLightActive && effectiveLightRadius > 0.01) {
            const dx = prop.x - state.player.x;
            const dy = prop.y - state.player.y;
            const dist = Math.hypot(dx, dy);
            const angleTo = Math.atan2(dy, dx);
            const angleDiff = Math.abs(shortestAngleDiff(state.player.angle, angleTo));

            let brightness = 0;
            let litNow = false;

            if (dist < effectiveLightRadius && angleDiff < LIGHT_ANGLE_WIDTH) {
               const falloff = (1.0 - (dist / effectiveLightRadius)) * (cycle.raftLightIntensity || 0);
               brightness = Math.max(0, Math.min(1, falloff));
               litNow = true;

               // Update remembered light state
               prop._lastLightStrength = brightness;
               prop._lastLightTime = now;
               prop._lastLightDirX = dx / Math.max(dist, 1e-6);
            } else {
               const lastTime = prop._lastLightTime || 0;
               const elapsed = lastTime ? (now - lastTime) : Infinity;
               const lastStrength = prop._lastLightStrength || 0;
               const fade = Math.max(0, 1 - elapsed / TREE_LIGHT_FADE_MS);
               brightness = lastStrength * fade;
            }

            if (brightness > 0.01) {
               if (prop.type === 'forest' || prop.type === 'grass') {
                 const lightDirX = (typeof prop._lastLightDirX === 'number' && !litNow)
                   ? prop._lastLightDirX
                   : (dist > 1e-6 ? dx / dist : (prop._lastLightDirX || 0));
                 const nightShade = computeTreeShadeFromHeadlight(brightness, lightDirX);
                 propCycle = Object.assign({}, cycle, {
                   shadeProgression: nightShade,
                   shadowAlpha: 0.6 * brightness
                 });
               } else {
                 propCycle = Object.assign({}, cycle, {
                   shadeProgression: 0.5,
                   shadowAlpha: 0.6 * brightness
                 });
               }
            } else {
               // No remaining light: keep default night cycle (dark tree)
               propCycle = cycle;
            }
          }

          if (prop.type === 'forest' || prop.type === 'grass') {
             drawTree(ctx, state, tileSize, prop, TREES, propCycle);
          } else {
             drawAquaticPlant(ctx, state, tileSize, prop, FLORA);
          }
        }
      }
    }

    chunkManager.pruneCache();

    // Entities
    drawEntities(ctx, state, tileSize, game, centerX, centerY);

    // Player
    drawPlayer(ctx, state, tileSize, cycle, shadowDir, noise);

    // Birds in front of the raft
    renderBirdsAhead(ctx, state, tileSize, cycle, shadowDir, noise);

    // Atmosphere overlay
    if (cycle.ambientColor !== 'transparent') {
      // Draw overlay with safe canvas state handling so composite ops don't leak
      ctx.save();
      try {
        // Fill full-screen ambient tint (darkness)
        ctx.fillStyle = cycle.ambientColor;
        if (!cycle.raftLightActive || effectiveLightRadius <= 0.01) {
          ctx.fillRect(0, 0, state.width, state.height);
        } else {
          // When raft light is active, draw the overlay but punch a sector-shaped hole
          // using the 'evenodd' winding rule. Use save/restore to keep compositing sane.
          const w = state.width;
          const h = state.height;
          const screenX = (state.player.x - state.camera.x) * tileSize + centerX;
          const screenY = (state.player.y - state.camera.y) * tileSize + centerY;
          const r = effectiveLightRadius * tileSize;
          const a = state.player.angle;
          const halfA = LIGHT_ANGLE_WIDTH;

          ctx.beginPath();
          // Outer rectangle (clockwise)
          ctx.moveTo(0, 0);
          ctx.lineTo(w, 0);
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.closePath();

          // Sector hole (counter direction as subpath)
          ctx.moveTo(screenX, screenY);
          ctx.arc(screenX, screenY, r, a - halfA, a + halfA, false);
          ctx.closePath();

          // Fill outer minus sector using evenodd to create the cutout
          ctx.fill('evenodd');

          // Draw a gentle radial gradient over the beam to soften the edge
          const g = ctx.createRadialGradient(screenX, screenY, r * 0.35, screenX, screenY, r);
          // Inner: transparent, Outer: slight ambient color to blend
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(1, cycle.ambientColor);

          // Use normal composite so we don't affect underlying world pixels
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 0.6 * lightIntensity;
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(screenX, screenY, r, a - halfA, a + halfA, false);
          ctx.lineTo(screenX, screenY);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      } finally {
        ctx.restore();
        // Ensure composite operation reset just in case
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  function start() {
    resize();
    window.addEventListener('resize', resize);
  }

  function stop() {
    window.removeEventListener('resize', resize);
  }

  function clearCache() {
    chunkManager.clearCache();
  }

  return { start, stop, resize, renderFrame, clearCache, waterEffects };
}
