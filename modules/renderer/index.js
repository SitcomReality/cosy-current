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
    const LIGHT_ANGLE_WIDTH = 0.9; // Radians half-width (~50 degrees)

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, state.width, state.height);

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

          if (cycle.raftLightActive) {
            const dx = prop.x - state.player.x;
            const dy = prop.y - state.player.y;
            const dist = Math.hypot(dx, dy);
            const angleTo = Math.atan2(dy, dx);
            const angleDiff = Math.abs(shortestAngleDiff(state.player.angle, angleTo));

            if (dist < LIGHT_RADIUS && angleDiff < LIGHT_ANGLE_WIDTH) {
              // Lit by raft
              // Create a modified cycle object for this prop
              const falloff = 1.0 - (dist / LIGHT_RADIUS);
              propCycle = Object.assign({}, cycle, {
                 shadowAlpha: 0.6 * falloff, // Shadows fade at distance
                 shadowLength: 1.0,
                 shadeProgression: 0.5 // Force "noon" shading for lit effect
              });
              // Shadow points away from player
              propShadowDir = { x: dx/dist, y: dy/dist };
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
          if (cycle.raftLightActive) {
            const dx = prop.x - state.player.x;
            const dy = prop.y - state.player.y;
            const dist = Math.hypot(dx, dy);
            const angleTo = Math.atan2(dy, dx);
            const angleDiff = Math.abs(shortestAngleDiff(state.player.angle, angleTo));

            if (dist < LIGHT_RADIUS && angleDiff < LIGHT_ANGLE_WIDTH) {
               propCycle = Object.assign({}, cycle, {
                 shadeProgression: 0.5 // Force daylight appearance
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
      ctx.fillStyle = cycle.ambientColor;

      // If raft light is active, we punch a hole in the darkness
      if (cycle.raftLightActive) {
         // Draw full darkness rect first?
         // No, if we draw full rect, we can't easily punch out without composite ops
         // which might clear the underlying image if not careful.
         // 'destination-out' removes alpha from the destination (canvas).
         // But the destination has the world drawn on it.
         // We want to remove the OVERLAY, not the world.
         // So we need to draw the overlay into the canvas with the hole already in it,
         // OR use a separate offscreen canvas (expensive),
         // OR use a path that covers the screen MINUS the arc.
         
         // Path with hole approach (Winding rule 'evenodd' is tricky with arc).
         // Simpler: Draw darkness, then use 'destination-out' to erase it? 
         // NO, 'destination-out' erases the EXISTING content (the world).
         
         // Correct approach for single canvas:
         // 1. Draw darkness overlay.
         // 2. Use 'destination-out' ONLY if we were drawing onto a separate layer.
         // But we are on the main canvas.
         
         // Alternative: Draw the "Light" using a gradient with 'soft-light' or 'overlay' blend mode?
         // Or 'screen' blend mode?
         // 'screen' blend mode with a light color will brighten the underlying darkness.
         // 
         // Let's try drawing the ambient rect, and then drawing the "Light Beam" on top 
         // using 'destination-in' ... wait no.
         
         // We want to remove the blue tint.
         // Let's draw the ambient rect with a radial gradient transparency? No, it's a cone.
         
         // Hack: Draw the ambient color everywhere using a massive path that excludes the triangle/arc.
         // Screen corners
         const w = state.width;
         const h = state.height;
         
         ctx.beginPath();
         // Outer box (clockwise)
         ctx.moveTo(0, 0);
         ctx.lineTo(w, 0);
         ctx.lineTo(w, h);
         ctx.lineTo(0, h);
         ctx.closePath();
         
         // Inner hole (counter-clockwise) to create cutout
         // The beam is an arc sector.
         // Center
         const px = centerX; // player is always centered in camera view (locked)
         // Actually player might strictly not be if panning, but for gameplay locked=true.
         // Let's use actual projected player pos.
         const screenX = (state.player.x - state.camera.x) * tileSize + centerX;
         const screenY = (state.player.y - state.camera.y) * tileSize + centerY;
         
         const r = LIGHT_RADIUS * tileSize;
         const a = state.player.angle;
         const halfA = LIGHT_ANGLE_WIDTH;
         
         // Arc definition
         // ctx.arc(x, y, radius, startAngle, endAngle, counterclockwise)
         // We want the hole to be CCW relative to the outer box CW to subtract?
         // Canvas winding rule is usually non-zero.
         
         ctx.moveTo(screenX, screenY);
         ctx.arc(screenX, screenY, r, a - halfA, a + halfA, false); // Arc segment
         ctx.closePath(); // Closes back to center
         
         // Fill with even-odd rule to punch hole?
         // 'evenodd': points inside the outer box but outside the arc are filled.
         ctx.fill('evenodd');
         
         // Draw a soft glow over the hole edges to hide the hard cut
         // Using a radial gradient or multiple soft strokes
         ctx.globalCompositeOperation = 'screen';
         const grad = ctx.createRadialGradient(screenX, screenY, r * 0.8, screenX, screenY, r);
         grad.addColorStop(0, 'rgba(15, 23, 42, 0)'); // inner (transparent, shows world)
         grad.addColorStop(1, cycle.ambientColor); // outer (matches darkness)
         
         // Actually, just drawing a soft gradient 'light' over the harsh edge might be enough.
         // Let's try drawing the hole-punched overlay, then a soft gradient on top to blend.
         
      } else {
         // Normal full overlay
         ctx.fillRect(0, 0, state.width, state.height);
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