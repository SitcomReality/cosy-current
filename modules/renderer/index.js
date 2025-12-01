import { createChunkManager } from './chunk.js';
import { getVertexOffset } from './vertex.js';
import { convexHull, floodFill } from './hull.js';

// This file composes the modular renderer pieces into the original public API
export function createRenderer({ canvas, state, game, noise }) {
  const ctx = canvas.getContext('2d', { alpha: false });

  // Stylized Vector Palette
  const COLORS = {
    [game.CONSTANTS.TILE_RIVER_DEEP]: '#1e3a8a',    // Deeper Blue
    [game.CONSTANTS.TILE_RIVER_SHALLOW]: '#38bdf8', // Bright Blue
    [game.CONSTANTS.TILE_BANK]: '#fbbf24',          // Sandy/Gold
    [game.CONSTANTS.TILE_GRASS]: '#4ade80',         // Vibrant Green
    [game.CONSTANTS.TILE_FOREST]: '#166534',        // Deep Green
    [game.CONSTANTS.TILE_HILL]: '#94a3b8',          // Grey Blue
    [game.CONSTANTS.TILE_MOUNTAIN]: '#cbd5e1'       // White/Grey
  };

  const CHUNK_SIZE = 16;
  const chunkManager = createChunkManager({ CHUNK_SIZE, COLORS, state, game, noise, getVertexOffset });

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

        // Account for chunk padding when placing on screen so the visible content
        // aligns exactly with neighboring chunks (subtract PAD).
        const PAD = (chunkImg && chunkImg.width > CHUNK_SIZE * tileSize) ? Math.floor((chunkImg.width - CHUNK_SIZE * tileSize) / 2) : 0;
        const screenX = (chunkWorldX - state.camera.x) * tileSize + centerX - PAD;
        const screenY = (chunkWorldY - state.camera.y) * tileSize + centerY - PAD;

        // Use integer draw positions to avoid subpixel seams
        ctx.drawImage(chunkImg, Math.floor(screenX), Math.floor(screenY));
      }
    }

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
    ctx.translate(px, py);
    ctx.rotate(p.angle);

    const carLen = tileSize * 1.5;
    const carWid = tileSize * 0.8;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-carLen/2 + 4, -carWid/2 + 4, carLen, carWid);

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-carLen/2, -carWid/2, carLen, carWid);

    ctx.fillStyle = '#334155';
    ctx.fillRect(-carLen/4, -carWid/3, carLen/2, carWid/1.5);

    ctx.fillStyle = '#0ea5e9';
    ctx.shadowColor = '#0ea5e9';
    ctx.shadowBlur = 10;
    ctx.fillRect(-carLen/2 - 4, -carWid/4, 4, carWid/2);

    ctx.fillStyle = '#fef08a';
    ctx.shadowColor = '#fef08a';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(carLen/2, -carWid/4);
    ctx.lineTo(carLen/2 + carLen/2, -carWid/1.5);
    ctx.lineTo(carLen/2 + carLen/2, carWid/1.5);
    ctx.lineTo(carLen/2, carWid/4);
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

  return { start, stop, resize, renderFrame, clearCache };
}