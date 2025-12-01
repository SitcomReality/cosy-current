import { createChunkManager } from './chunk.js';
import { getVertexOffset } from './vertex.js';
import { convexHull, floodFill } from './hull.js';
import { createWaterFX } from './water_fx.js';

// This file composes the modular renderer pieces into the original public API
export function createRenderer({ canvas, state, game, noise }) {
  const ctx = canvas.getContext('2d', { alpha: false });

  // Stylized Vector Palette
  const COLORS = {
    // Warmer, clearer water palette
    [game.CONSTANTS.TILE_RIVER_DEEP]: '#3b82f6',    // lively deep blue
    [game.CONSTANTS.TILE_RIVER_SHALLOW]: '#7dd3fc', // sky/shore blue
    [game.CONSTANTS.TILE_BANK]: '#fde047',          // sandy gold
    [game.CONSTANTS.TILE_GRASS]: '#4ade80',         // Vibrant Green
    [game.CONSTANTS.TILE_FOREST]: '#166534',        // Deep Green
    [game.CONSTANTS.TILE_HILL]: '#94a3b8',          // Grey Blue
    [game.CONSTANTS.TILE_MOUNTAIN]: '#cbd5e1'       // White/Grey
  };

  const CHUNK_SIZE = 16;
  const chunkManager = createChunkManager({ CHUNK_SIZE, COLORS, state, game, noise, getVertexOffset });
  const waterFX = createWaterFX();

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

  // Per-frame update called from app loop
  function update(dt) {
    // Advance water effects (wakes)
    waterFX.update(dt, state.player);
  }

  function drawMenuBackground(t) {
    const hue = (t * 0.01) % 360;
    const grad = ctx.createLinearGradient(0, 0, state.width, state.height);
    grad.addColorStop(0, `hsl(${hue}, 20%, 10%)`);
    grad.addColorStop(1, `hsl(${hue + 40}, 30%, 5%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  function renderFrame(timestamp) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, state.width, state.height);

    if (!state.isPlaying) {
      drawMenuBackground(timestamp);
      return;
    }

    const tileSize = state.tileSize;
    const centerX = state.width / 2;
    const centerY = state.height / 2;

    const visibleWidth = state.width;
    const visibleHeight = state.height;

    const chunkPixels = CHUNK_SIZE * tileSize;

    const viewLeftTile = state.camera.x - (visibleWidth / 2) / tileSize;
    const viewRightTile = state.camera.x + (visibleWidth / 2) / tileSize;
    const viewTopTile = state.camera.y - (visibleHeight / 2) / tileSize;
    const viewBottomTile = state.camera.y + (visibleHeight / 2) / tileSize;

    const startChunkX = Math.floor(viewLeftTile / CHUNK_SIZE);
    const endChunkX = Math.floor(viewRightTile / CHUNK_SIZE);
    const startChunkY = Math.floor(viewTopTile / CHUNK_SIZE);
    const endChunkY = Math.floor(viewBottomTile / CHUNK_SIZE);

    for (let cy = startChunkY; cy <= endChunkY; cy++) {
      for (let cx = startChunkX; cx <= endChunkX; cx++) {
        const chunkImg = chunkManager.getChunk(cx, cy);

        const chunkWorldX = cx * CHUNK_SIZE;
        const chunkWorldY = cy * CHUNK_SIZE;

        const screenX = (chunkWorldX - state.camera.x) * tileSize + centerX;
        const screenY = (chunkWorldY - state.camera.y) * tileSize + centerY;

        // Use consistent rounding so adjacent chunks meet exactly with no pixel gaps
        ctx.drawImage(chunkImg, Math.round(screenX), Math.round(screenY));
      }
    }

    // Water FX (wakes, shore ripples) drawn above terrain and beneath entities
    waterFX.render(ctx, state.camera, state.tileSize, centerX, centerY);

    // Prune cache occasionally
    chunkManager.pruneCache();

    // Entities
    state.entities.forEach(ent => {
       const screenX = (ent.x - state.camera.x) * tileSize + centerX;
       const screenY = (ent.y - state.camera.y) * tileSize + centerY;

       if (screenX < -tileSize*2 || screenX > state.width + tileSize*2 ||
           screenY < -tileSize*2 || screenY > state.height + tileSize*2) return;

       if (ent.type === game.CONSTANTS.ENTITY_CITY) {
         ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
         ctx.beginPath();
         ctx.arc(screenX + tileSize/2, screenY + tileSize/2, tileSize * 2, 0, Math.PI*2);
         ctx.fill();

         ctx.fillStyle = '#10b981';
         ctx.fillRect(screenX, screenY, tileSize, tileSize);
         ctx.fillStyle = '#065f46';
         ctx.fillRect(screenX + tileSize/2 - tileSize*0.1, screenY, tileSize*0.2, tileSize*0.6);
       } else if (ent.type === game.CONSTANTS.ENTITY_RELIC) {
         ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
         ctx.beginPath();
         ctx.arc(screenX + tileSize/2, screenY + tileSize/2, tileSize * 2, 0, Math.PI*2);
         ctx.fill();

         ctx.fillStyle = '#f59e0b';
         ctx.beginPath();
         ctx.moveTo(screenX + tileSize/2, screenY);
         ctx.lineTo(screenX + tileSize, screenY + tileSize);
         ctx.lineTo(screenX, screenY + tileSize);
         ctx.fill();
       }
    });

    // Player
    const p = state.player;
    const px = (p.x - state.camera.x) * tileSize + centerX;
    const py = (p.y - state.camera.y) * tileSize + centerY;

    ctx.save();
    // Draw raft (low-poly wooden logs with small cabin)
    ctx.translate(px, py);
    ctx.rotate(p.angle);
    const raftW = tileSize * 1.2;
    const raftH = tileSize * 0.9;
    // Logs base
    ctx.fillStyle = '#6b4226';
    for (let i = -1; i <= 1; i++) {
      ctx.fillRect(-raftW/2, (i * 6) - raftH/2, raftW, Math.max(8, tileSize * 0.12));
    }
    // Deck
    ctx.fillStyle = '#8b5e3c';
    ctx.fillRect(-raftW/2 + 6, -raftH/2 + 6, raftW - 12, raftH - 12);
    // Cabin
    const cabW = raftW * 0.5;
    const cabH = raftH * 0.45;
    ctx.fillStyle = '#f3e7d7';
    ctx.fillRect(-cabW/2, -cabH/2, cabW, cabH);
    ctx.fillStyle = '#7a4b2b';
    ctx.fillRect(-cabW/2, -cabH/2, cabW, cabH*0.25); // roof ledge
    // Lantern glow
    ctx.fillStyle = 'rgba(255, 210, 100, 0.6)';
    ctx.beginPath();
    ctx.arc(cabW/2 - 6, 0, Math.max(2, tileSize*0.04), 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
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

  return { start, stop, resize, renderFrame, clearCache, update };
}