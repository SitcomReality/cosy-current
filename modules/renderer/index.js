// Main renderer composition: uses chunkManager, palette, daycycle, objects and water effects
import { createChunkManager } from './chunk.js';
import { getVertexOffset } from './vertex.js';
import { createWaterEffects } from './water/index.js';

import { resolvePalettes } from './palette.js';
import { advanceDayTime, getCycleProps } from './daycycle.js';
import { drawTreeShadow, drawTree, drawAquaticPlant, drawAquaticShadow, drawEntities, drawPlayer } from './objects.js';
import { renderFauna, renderBirds } from './fauna/index.js';

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
    
    // Raft headlight: active only when the sun's shadows have fully faded (night).
    const useRaftLight = (cycle.dayFactor || 0) < 0.01 && state.isPlaying;
    const raftLight = useRaftLight ? {
      mode: 'raft',
      enabled: true,
      x: state.player.x,
      y: state.player.y,
      angle: state.player.angle
    } : null;

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
      renderFauna(ctx, state, tileSize, state.fauna.creatures, cycle, shadowDir, noise, raftLight);
    }

    // Objects: draw shadows then geometry for chunks in view
    for (let cy = startChunkY; cy <= endChunkY; cy++) {
      for (let cx = startChunkX; cx <= endChunkX; cx++) {
        const props = chunkManager.getChunkProps(cx, cy);
        
        // Draw shadows first
        for (const prop of props) {
          if (prop.type === 'forest' || prop.type === 'grass') {
             drawTreeShadow(ctx, state, state.camera, tileSize, prop, cycle, shadowDir);
          } else {
             // Aquatic props
             drawAquaticShadow(ctx, state, tileSize, prop, cycle, shadowDir, raftLight);
          }
        }
        
        // Then draw geometry
        for (const prop of props) {
          if (prop.type === 'forest' || prop.type === 'grass') {
             drawTree(ctx, state, tileSize, prop, TREES, cycle);
          } else {
             drawAquaticPlant(ctx, state, tileSize, prop, FLORA, raftLight);
          }
        }
      }
    }

    chunkManager.pruneCache();

    // Entities
    drawEntities(ctx, state, tileSize, game, centerX, centerY, raftLight);

    // Player
    drawPlayer(ctx, state, tileSize, cycle, shadowDir, noise, raftLight);

    // Birds in front of the raft
    if (state.fauna && state.fauna.creatures) {
      renderBirds(ctx, state, tileSize, state.fauna.creatures, cycle, shadowDir, noise, raftLight);
    }

    // Atmosphere overlay
    if (cycle.ambientColor !== 'transparent') {
      
      if (raftLight) {
        // Night mode with Raft Light enabled: Use masking to carve out the light cone.
        ctx.save();
        
        // 1. Draw the ambient shade over the entire screen
        ctx.fillStyle = cycle.ambientColor;
        ctx.fillRect(0, 0, state.width, state.height);

        // 2. Create a "hole" where the raft light shines using destination-out
        const pX = (state.player.x - state.camera.x) * tileSize + centerX;
        const pY = (state.player.y - state.camera.y) * tileSize + centerY;
        
        const lightAngle = raftLight.angle;
        // Light range must be large enough to cover the visible area, 25 tiles * tileSize
        const lightRange = tileSize * 25; 
        const coneAngle = Math.PI / 3; // 60 degrees total arc

        ctx.globalCompositeOperation = 'destination-out';
        
        // Draw the light cone shape to carve a hole
        ctx.beginPath();
        ctx.moveTo(pX, pY);
        
        const startAngle = lightAngle - coneAngle / 2;
        const endAngle = lightAngle + coneAngle / 2;
        
        // Use an oversized radius to ensure polygon covers the canvas edge even when light source is off-center
        const R = Math.max(state.width, state.height) * 2; 

        // Point 1 (start of arc)
        const x1 = pX + R * Math.cos(startAngle);
        const y1 = pY + R * Math.sin(startAngle);
        ctx.lineTo(x1, y1);
        
        // Arc approximation steps
        const STEPS = 10;
        for (let i = 1; i <= STEPS; i++) {
          const u = i / STEPS;
          const currentAngle = startAngle + (endAngle - startAngle) * u;
          const x = pX + R * Math.cos(currentAngle);
          const y = pY + R * Math.sin(currentAngle);
          ctx.lineTo(x, y);
        }
        
        // Point N (end of arc)
        const xN = pX + R * Math.cos(endAngle);
        const yN = pY + R * Math.sin(endAngle);
        ctx.lineTo(xN, yN);
        
        ctx.closePath();
        
        // Alpha is what carves the hole
        ctx.fillStyle = 'white'; 
        ctx.fill();

        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();

      } else {
        // Normal ambient coloring (Day or Transition)
        ctx.fillStyle = cycle.ambientColor;
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