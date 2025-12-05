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

    // Raft Light Constants
    const LIGHT_RADIUS = 14; 
    const LIGHT_ANGLE_WIDTH = 0.9;
    const lightIntensity = cycle.raftLightIntensity || 0;
    const effectiveLightRadius = LIGHT_RADIUS * lightIntensity; // Radians half-width (~50 degrees)

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, state.width, state.height);

    // Helper: derive a night-time tree shadeProgression from raft headlight
    // based on distance falloff and the obliqueness of the shadow direction.
    function computeTreeShadeFromHeadlight(falloff, shadowDirVec) {
      const sx = Math.abs(shadowDirVec.x);
      const sy = Math.abs(shadowDirVec.y);
      const sum = sx + sy || 1;
      // obliqueness: 0 when shadow is almost axis-aligned (very slivery),
      // 1 when x/y components are equal (shadow triangle has equal legs).
      const oblique = 1 - Math.abs(sx - sy) / sum;
      const brightness = falloff * oblique;
      // Map to tree shading range: 0.05 ≈ mostly dark, 0.95 ≈ fully lit
      const base = 0.05 + brightness * 0.9;

      // Determine which screen-side the light is coming from.
      // shadowDirVec is a vector from light -> prop (so shadows point away from light).
      // If the light's X component is negative, light is coming from the left side (so left face should be lit).
      const lightFromLeft = (shadowDirVec.x < 0);

      // Convert base (0.05..0.95) into a shadeProgression where:
      // - values < 0.5 indicate the right face is the lit side,
      // - values > 0.5 indicate the left face is the lit side.
      // We bias around 0.5 by half of the computed brightness range so that both
      // intensity and side are encoded.
      const normalized = (base - 0.05) / 0.9; // 0..1
      const bias = normalized * 0.45; // max +/-0.45 from 0.5 -> yields ~0.05..0.95
      return lightFromLeft ? (0.5 + bias) : (0.5 - bias);
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

          if (cycle.raftLightActive && effectiveLightRadius > 0.01) {
            const dx = prop.x - state.player.x;
            const dy = prop.y - state.player.y;
            const dist = Math.hypot(dx, dy);
            const angleTo = Math.atan2(dy, dx);
            const angleDiff = Math.abs(shortestAngleDiff(state.player.angle, angleTo));

            if (dist < effectiveLightRadius && angleDiff < LIGHT_ANGLE_WIDTH) {
              // Lit by raft
              const falloff = (1.0 - (dist / effectiveLightRadius)) * (cycle.raftLightIntensity || 0);
              // Shadow points away from player
              propShadowDir = { x: dx / dist, y: dy / dist };

              // For trees, derive a smoother night shading value from the same
              // falloff and the shadow direction; for aquatic props keep prior behavior.
              if (prop.type === 'forest' || prop.type === 'grass') {
                const nightShade = computeTreeShadeFromHeadlight(falloff, propShadowDir);
                propCycle = Object.assign({}, cycle, {
                  shadowAlpha: 0.6 * falloff,
                  shadowLength: 1.0,
                  shadeProgression: nightShade
                });
              } else {
                propCycle = Object.assign({}, cycle, {
                  shadowAlpha: 0.6 * falloff,
                  shadowLength: 1.0,
                  shadeProgression: 0.5
                });
              }
            } else {
              // Unlit at night -> no shadow
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

            if (dist < effectiveLightRadius && angleDiff < LIGHT_ANGLE_WIDTH) {
               const falloff = (1.0 - (dist / effectiveLightRadius)) * (cycle.raftLightIntensity || 0);

               if (prop.type === 'forest' || prop.type === 'grass') {
                 // Use the same smooth night shading for tree geometry as for their shadows
                 const lightDir = { x: dx / Math.max(dist, 1e-6), y: dy / Math.max(dist, 1e-6) };
                 const nightShade = computeTreeShadeFromHeadlight(falloff, lightDir);
                 propCycle = Object.assign({}, cycle, {
                   shadeProgression: nightShade,
                   shadowAlpha: 0.6 * falloff
                 });
               } else {
                 propCycle = Object.assign({}, cycle, {
                   shadeProgression: 0.5,
                   shadowAlpha: 0.6 * falloff
                 });
               }
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