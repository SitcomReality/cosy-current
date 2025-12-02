import { createChunkManager } from './chunk.js';
import { getVertexOffset } from './vertex.js';
import { convexHull, floodFill } from './hull.js';
import { createWaterEffects } from '../water.js';

// This file composes the modular renderer pieces into the original public API
export function createRenderer({ canvas, state, game, noise }) {
  const ctx = canvas.getContext('2d', { alpha: false });

  // Stylized Vector Palette - Fixed river colors
  // We now define gradient endpoints for the unified water tile
  const WATER_PALETTE = {
    deep: '#0c4a6e',    // Deep Blue Water (Center)
    shallow: '#0ea5e9'  // Bright Blue Water (Edge)
  };

  const COLORS = {
    [game.CONSTANTS.TILE_WATER]: WATER_PALETTE.shallow, // Fallback/base
    [game.CONSTANTS.TILE_BANK]: '#fbbf24',          // Sandy/Gold
    [game.CONSTANTS.TILE_GRASS]: '#4ade80',         // Vibrant Green
    [game.CONSTANTS.TILE_FOREST]: '#166534',        // Deep Green
    [game.CONSTANTS.TILE_HILL]: '#94a3b8',          // Grey Blue
    [game.CONSTANTS.TILE_MOUNTAIN]: '#cbd5e1'       // White/Grey
  };

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

        ctx.drawImage(chunkImg, Math.round(screenX), Math.round(screenY));
      }
    }

    chunkManager.pruneCache();

    // Render water effects (wakes, waves) after terrain, before entities
    waterEffects.render(ctx, state.camera, tileSize);

    // Entities
    state.entities.forEach(ent => {
       const screenX = (ent.x - state.camera.x) * tileSize + centerX;
       const screenY = (ent.y - state.camera.y) * tileSize + centerY;

       if (screenX < -tileSize*2 || screenX > state.width + tileSize*2 ||
           screenY < -tileSize*2 || screenY > state.height + tileSize*2) return;

       if (ent.type === game.CONSTANTS.ENTITY_CITY) {
         // Use game interaction radius (in tiles) scaled to pixels for the visible influence circle
         const influenceRadiusPx = (game.CONSTANTS.INTERACTION_RADIUS || 35) * tileSize;

         ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
         ctx.beginPath();
         ctx.arc(screenX + tileSize/2, screenY + tileSize/2, influenceRadiusPx, 0, Math.PI*2);
         ctx.fill();

         ctx.fillStyle = '#10b981';
         ctx.fillRect(screenX, screenY, tileSize, tileSize);
         ctx.fillStyle = '#065f46';
         ctx.fillRect(screenX + tileSize/2 - tileSize*0.1, screenY, tileSize*0.2, tileSize*0.6);
       } else if (ent.type === game.CONSTANTS.ENTITY_RELIC) {
         // Use same interaction radius for relic highlight
         const influenceRadiusPx = (game.CONSTANTS.INTERACTION_RADIUS || 35) * tileSize;

         ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
         ctx.beginPath();
         ctx.arc(screenX + tileSize/2, screenY + tileSize/2, influenceRadiusPx, 0, Math.PI*2);
         ctx.fill();

         ctx.fillStyle = '#f59e0b';
         ctx.beginPath();
         ctx.moveTo(screenX + tileSize/2, screenY);
         ctx.lineTo(screenX + tileSize, screenY + tileSize);
         ctx.lineTo(screenX, screenY + tileSize);
         ctx.fill();
       }
    });

    // Player - Houseboat/Raft
    const p = state.player;
    const px = (p.x - state.camera.x) * tileSize + centerX;
    const py = (p.y - state.camera.y) * tileSize + centerY;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.angle);

    const raftLen = tileSize * 1.8;
    const raftWid = tileSize * 1.2;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-raftLen/2 + 3, -raftWid/2 + 3, raftLen, raftWid);

    // Main deck (wood planks)
    ctx.fillStyle = '#92400e';
    ctx.fillRect(-raftLen/2, -raftWid/2, raftLen, raftWid);

    // Plank lines
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const x = -raftLen/2 + (i / 4) * raftLen;
      ctx.beginPath();
      ctx.moveTo(x, -raftWid/2);
      ctx.lineTo(x, raftWid/2);
      ctx.stroke();
    }

    // Cabin structure
    ctx.fillStyle = '#fef3c7';
    const cabinW = raftLen * 0.4;
    const cabinH = raftWid * 0.6;
    ctx.fillRect(-cabinW/2, -cabinH/2, cabinW, cabinH);

    // Cabin window
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(-cabinW/4, -cabinH/4, cabinW/2, cabinH/3);

    // Bow light (navigation)
    ctx.fillStyle = '#fef08a';
    ctx.shadowColor = '#fef08a';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(raftLen/2 - 5, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

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

  return { start, stop, resize, renderFrame, clearCache, waterEffects };
}