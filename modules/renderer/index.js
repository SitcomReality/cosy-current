// Main renderer composition: uses chunkManager, palette, daycycle, objects and water effects
import { createChunkManager } from './chunk.js';
import { getVertexOffset } from './vertex.js';
import { createWaterEffects } from './water/index.js';

import { resolvePalettes } from './palette.js';
import { advanceDayTime, getCycleProps } from './daycycle.js';
import { drawTreeShadow, drawTree, drawAquaticPlant, drawAquaticShadow, drawEntities, drawPlayer } from './objects.js';
import { renderFauna, renderBirds } from './fauna/index.js';
import { shortestAngleDiff } from '../fauna/utils.js';

// This file composes the modular renderer pieces into the original public API
export function createRenderer({ canvas, state, game, noise }) {
  const ctx = canvas.getContext('2d', { alpha: false });

  const { WATER_PALETTE, COLORS, TREES, FLORA } = resolvePalettes(game);

  const CHUNK_SIZE = 16;
  const chunkManager = createChunkManager({ CHUNK_SIZE, COLORS, WATER_PALETTE, state, game, noise, getVertexOffset });
  const waterEffects = createWaterEffects({ state, game, noise });

  // Track last frame time to compute dt for fades
  let _lastRenderTs = null;

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
    // compute dt (seconds) for per-prop fades; clamp reasonable max
    let dt = 0.016;
    if (_lastRenderTs !== null) {
      dt = (timestamp - _lastRenderTs) / 1000;
      if (!isFinite(dt) || dt <= 0) dt = 0.016;
      if (dt > 0.2) dt = 0.2;
    }
    _lastRenderTs = timestamp;

    // Advance day cycle
    advanceDayTime(state);
    const cycle = getCycleProps(state);
    const shadowDir = { x: cycle.shadowDirX, y: cycle.shadowDirY };

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

    // Water effects
    waterEffects.render(ctx, state.camera, tileSize);

    // Fauna behind objects/player (fish, deer, critters, fireflies)
    if (state.fauna && state.fauna.creatures) {
      renderFauna(ctx, state, tileSize, state.fauna.creatures, cycle, shadowDir, noise, cycle.raftLightActive);
    }

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

          // Ensure each prop has a fade tracker
          if (prop._raftLitFade === undefined) prop._raftLitFade = 0;

          // Determine if prop is currently inside the raft beam
          let currentlyLit = false;
          let litFalloff = 0;
          if (cycle.raftLightActive && effectiveLightRadius > 0.01) {
            const dx = prop.x - state.player.x;
            const dy = prop.y - state.player.y;
            const dist = Math.hypot(dx, dy);
            const angleTo = Math.atan2(dy, dx);
            const angleDiff = Math.abs(shortestAngleDiff(state.player.angle, angleTo));

            if (dist < effectiveLightRadius && angleDiff < LIGHT_ANGLE_WIDTH) {
              currentlyLit = true;
              litFalloff = (1.0 - (dist / effectiveLightRadius)) * (cycle.raftLightIntensity || 0);
              propShadowDir = { x: dx / Math.max(dist, 1e-6), y: dy / Math.max(dist, 1e-6) };
            }
          }

          // Update fade: quick fade-in, slightly slower fade-out for smoother exit
          const fadeInRate = 12.0;  // per second
          const fadeOutRate = 6.0;  // per second
          if (currentlyLit) {
            prop._raftLitFade = Math.min(1, prop._raftLitFade + dt * fadeInRate);
          } else {
            prop._raftLitFade = Math.max(0, prop._raftLitFade - dt * fadeOutRate);
          }

          // If no effective fade, skip drawing lit shadows to avoid sudden pops
          if (prop._raftLitFade <= 0.001) {
            // For aquatic props and normal night-case we still want no special raft shadow
            // so fall back to standard unlit behavior: draw only global shadows (handled elsewhere)
            continue;
          }

          // Build propCycle blended by fade
          if (prop.type === 'forest' || prop.type === 'grass') {
            const nightShade = computeTreeShadeFromHeadlight(litFalloff, propShadowDir.x);
            // Blend between current global cycle.shadeProgression and the nightShade by fade
            const blendedShade = (cycle.shadeProgression * (1 - prop._raftLitFade)) + (nightShade * prop._raftLitFade);
            propCycle = Object.assign({}, cycle, {
              shadowAlpha: (0.6 * litFalloff) * prop._raftLitFade,
              shadowLength: 1.0,
              shadeProgression: blendedShade
            });
          } else {
            propCycle = Object.assign({}, cycle, {
              shadowAlpha: (0.6 * litFalloff) * prop._raftLitFade,
              shadowLength: 1.0,
              shadeProgression: 0.5
            });
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

          // Ensure fade tracker exists (keeps sync with shadow pass)
          if (prop._raftLitFade === undefined) prop._raftLitFade = 0;

          // Recompute current lit state to get falloff for blending
          let currentlyLit = false;
          let litFalloff = 0;
          let propShadowDirX = 0;
          if (cycle.raftLightActive && effectiveLightRadius > 0.01) {
            const dx = prop.x - state.player.x;
            const dy = prop.y - state.player.y;
            const dist = Math.hypot(dx, dy);
            const angleTo = Math.atan2(dy, dx);
            const angleDiff = Math.abs(shortestAngleDiff(state.player.angle, angleTo));

            if (dist < effectiveLightRadius && angleDiff < LIGHT_ANGLE_WIDTH) {
              currentlyLit = true;
              litFalloff = (1.0 - (dist / effectiveLightRadius)) * (cycle.raftLightIntensity || 0);
              propShadowDirX = dx / Math.max(dist, 1e-6);
            }
          }

          // Build blended cycle only if there is some fade value
          if (prop._raftLitFade > 0.001) {
            if (prop.type === 'forest' || prop.type === 'grass') {
              const nightShade = computeTreeShadeFromHeadlight(litFalloff, propShadowDirX);
              const blendedShade = (cycle.shadeProgression * (1 - prop._raftLitFade)) + (nightShade * prop._raftLitFade);
              propCycle = Object.assign({}, cycle, {
                shadeProgression: blendedShade,
                shadowAlpha: (0.6 * litFalloff) * prop._raftLitFade
              });
            } else {
              propCycle = Object.assign({}, cycle, {
                shadeProgression: 0.5,
                shadowAlpha: (0.6 * litFalloff) * prop._raftLitFade
              });
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
    if (state.fauna && state.fauna.creatures) {
      renderBirds(ctx, state, tileSize, state.fauna.creatures, cycle, shadowDir, noise, cycle.raftLightActive);
    }

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