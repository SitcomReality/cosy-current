// Main renderer composition: uses chunkManager, palette, daycycle, objects and water effects
import { createChunkManager } from './chunk.js';
import { getVertexOffset } from './vertex.js';
import { createWaterEffects } from '../water.js';

import { resolvePalettes } from './palette.js';
import { advanceDayTime, getCycleProps } from './daycycle.js';
import { drawTreeShadow, drawTree, drawEntities, drawPlayer } from './objects.js';
import { renderFauna, renderBirds } from './fauna.js';

// This file composes the modular renderer pieces into the original public API
export function createRenderer({ canvas, state, game, noise }) {
  const ctx = canvas.getContext('2d', { alpha: false });

  const { WATER_PALETTE, COLORS, TREES } = resolvePalettes(game);

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
      renderFauna(ctx, state, tileSize, state.fauna.creatures, cycle, shadowDir, noise);
    }

    // Objects: draw shadows then geometry for chunks in view
    for (let cy = startChunkY; cy <= endChunkY; cy++) {
      for (let cx = startChunkX; cx <= endChunkX; cx++) {
        const props = chunkManager.getChunkProps(cx, cy);
        // Draw shadows first
        for (const tree of props) {
          drawTreeShadow(ctx, state, state.camera, tileSize, tree, cycle, shadowDir);
        }
        // Then draw tree geometry
        for (const tree of props) {
          drawTree(ctx, state, tileSize, tree, TREES, cycle);
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
      renderBirds(ctx, state, tileSize, state.fauna.creatures, cycle, shadowDir, noise);
    }

    // Atmosphere overlay
    if (cycle.ambientColor !== 'transparent') {
      ctx.fillStyle = cycle.ambientColor;
      ctx.fillRect(0, 0, state.width, state.height);
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