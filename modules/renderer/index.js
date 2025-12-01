import { createChunkManager } from './chunk.js';
import { getVertexOffset } from './vertex.js';
import { convexHull, floodFill } from './hull.js';

// This file composes the modular renderer pieces into the original public API
export function createRenderer({ terrainCanvas, waterCanvas, state, game, noise }) {
  const terrainCtx = terrainCanvas.getContext('2d', { alpha: false });
  const waterCtx = waterCanvas.getContext('2d', { alpha: true });

  // Stylized Vector Palette
  const COLORS = {
    [game.CONSTANTS.TILE_RIVER_DEEP]: '#0b1120',    // Deep dark water core (road-like channel)
    [game.CONSTANTS.TILE_RIVER_SHALLOW]: '#38bdf8', // Bright shallow edge
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

    terrainCanvas.width = state.width * dpr;
    terrainCanvas.height = state.height * dpr;
    waterCanvas.width = state.width * dpr;
    waterCanvas.height = state.height * dpr;

    terrainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    waterCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    terrainCtx.imageSmoothingEnabled = false;
    waterCtx.imageSmoothingEnabled = false;

    chunkManager.clearCache();
  }

  function drawMenuBackground(t) {
    const hue = (t * 0.01) % 360;
    const grad = terrainCtx.createLinearGradient(0, 0, state.width, state.height);
    grad.addColorStop(0, `hsl(${hue}, 20%, 10%)`);
    grad.addColorStop(1, `hsl(${hue + 40}, 30%, 5%)`);
    terrainCtx.fillStyle = grad;
    terrainCtx.fillRect(0, 0, state.width, state.height);

    // Clear water layer while in menu
    waterCtx.clearRect(0, 0, state.width, state.height);
  }

  function renderWaterOverlay(timestamp) {
    const tileSize = state.tileSize;
    const centerX = state.width / 2;
    const centerY = state.height / 2;

    // Clear previous water overlay
    waterCtx.clearRect(0, 0, state.width, state.height);

    if (!state.isPlaying) return;

    const t = timestamp * 0.001;

    const visibleWidthTiles = state.width / tileSize;
    const visibleHeightTiles = state.height / tileSize;

    const startX = state.camera.x - visibleWidthTiles / 2 - 2;
    const endX = state.camera.x + visibleWidthTiles / 2 + 2;
    const startY = state.camera.y - visibleHeightTiles / 2 - 2;
    const endY = state.camera.y + visibleHeightTiles / 2 + 2;

    // Coarse sampling grid to draw soft animated highlights along rivers
    const step = Math.max(0.75, tileSize < 48 ? 1.5 : 1.0);

    waterCtx.save();
    waterCtx.globalCompositeOperation = 'lighter';

    for (let y = startY; y < endY; y += step) {
      for (let x = startX; x < endX; x += step) {
        const river = noise.getRiverSystem(x, y);
        if (!river.isRiver) continue;

        // value 0 at center, 1 at bank edge
        const centerFactor = 1.0 - Math.min(1, river.value);
        if (centerFactor <= 0) continue;

        const screenX = (x - state.camera.x) * tileSize + centerX;
        const screenY = (y - state.camera.y) * tileSize + centerY;

        // Small horizontal wave wobble
        const waveOffset = Math.sin((x + y) * 0.3 + t * 2.0) * (tileSize * 0.05 * centerFactor);

        const radius = tileSize * 0.45 * (0.8 + centerFactor * 0.4);

        const alpha = 0.08 + centerFactor * 0.12;

        // Deep inner shimmer
        waterCtx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
        waterCtx.beginPath();
        waterCtx.ellipse(
          screenX + waveOffset,
          screenY + waveOffset * 0.4,
          radius * 1.2,
          radius * 0.7,
          (t * 0.5) + river.gx * 0.1,
          0,
          Math.PI * 2
        );
        waterCtx.fill();
      }
    }

    waterCtx.restore();
  }

  function renderFrame(timestamp) {
    terrainCtx.fillStyle = '#0f172a';
    terrainCtx.fillRect(0, 0, state.width, state.height);

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
        terrainCtx.drawImage(chunkImg, Math.round(screenX), Math.round(screenY));
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
         terrainCtx.fillStyle = 'rgba(16, 185, 129, 0.2)';
         terrainCtx.beginPath();
         terrainCtx.arc(screenX + tileSize/2, screenY + tileSize/2, tileSize * 2, 0, Math.PI*2);
         terrainCtx.fill();

         terrainCtx.fillStyle = '#10b981';
         terrainCtx.fillRect(screenX, screenY, tileSize, tileSize);
         terrainCtx.fillStyle = '#065f46';
         terrainCtx.fillRect(screenX + tileSize/2 - tileSize*0.1, screenY, tileSize*0.2, tileSize*0.6);
       } else if (ent.type === game.CONSTANTS.ENTITY_RELIC) {
         terrainCtx.fillStyle = 'rgba(245, 158, 11, 0.2)';
         terrainCtx.beginPath();
         terrainCtx.arc(screenX + tileSize/2, screenY + tileSize/2, tileSize * 2, 0, Math.PI*2);
         terrainCtx.fill();

         terrainCtx.fillStyle = '#f59e0b';
         terrainCtx.beginPath();
         terrainCtx.moveTo(screenX + tileSize/2, screenY);
         terrainCtx.lineTo(screenX + tileSize, screenY + tileSize);
         terrainCtx.lineTo(screenX, screenY + tileSize);
         terrainCtx.fill();
       }
    });

    // Player (houseboat/raft) riding the river
    const p = state.player;
    const px = (p.x - state.camera.x) * tileSize + centerX;
    const py = (p.y - state.camera.y) * tileSize + centerY;

    terrainCtx.save();
    terrainCtx.translate(px, py);
    terrainCtx.rotate(p.angle);

    const carLen = tileSize * 1.5;
    const carWid = tileSize * 0.8;

    terrainCtx.fillStyle = 'rgba(0,0,0,0.5)';
    terrainCtx.fillRect(-carLen/2 + 4, -carWid/2 + 4, carLen, carWid);

    terrainCtx.fillStyle = '#e2e8f0';
    terrainCtx.fillRect(-carLen/2, -carWid/2, carLen, carWid);

    terrainCtx.fillStyle = '#334155';
    terrainCtx.fillRect(-carLen/4, -carWid/3, carLen/2, carWid/1.5);

    terrainCtx.fillStyle = '#0ea5e9';
    terrainCtx.shadowColor = '#0ea5e9';
    terrainCtx.shadowBlur = 10;
    terrainCtx.fillRect(-carLen/2 - 4, -carWid/4, 4, carWid/2);

    terrainCtx.fillStyle = '#fef08a';
    terrainCtx.shadowColor = '#fef08a';
    terrainCtx.shadowBlur = 15;
    terrainCtx.beginPath();
    terrainCtx.moveTo(carLen/2, -carWid/4);
    terrainCtx.lineTo(carLen/2 + carLen/2, -carWid/1.5);
    terrainCtx.lineTo(carLen/2 + carLen/2, carWid/1.5);
    terrainCtx.lineTo(carLen/2, carWid/4);
    terrainCtx.fill();

    terrainCtx.restore();

    // Finally, draw animated water overlay on top
    renderWaterOverlay(timestamp);
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