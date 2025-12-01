import { convexHull, floodFill } from './hull.js';

// Factory to create chunk manager so it can close over state/game/noise/COLORS etc.
export function createChunkManager({ CHUNK_SIZE, COLORS, state, game, noise, getVertexOffset }) {
  const chunkCache = new Map();

  function clearCache() {
    chunkCache.clear();
  }

  function pruneCache() {
    if (Math.random() < 0.02) {
      const now = performance.now();
      for (const [key, val] of chunkCache) {
        if (now - val.lastUsed > 2000) {
          chunkCache.delete(key);
        }
      }
    }
  }

  // Generate or return existing chunk canvas
  function getChunk(cx, cy) {
    const key = `${cx},${cy}`;
    if (chunkCache.has(key)) {
      const data = chunkCache.get(key);
      data.lastUsed = performance.now();
      return data.canvas;
    }

    const pxSize = CHUNK_SIZE * state.tileSize;
    // Add a small padding (bleed) around chunks so geometry that sits on edges
    // lines up between adjacent chunks and avoids 1px seams due to rounding.
    const PAD = 2; // pixels of overlap on each side
    const cCanvas = document.createElement('canvas');
    cCanvas.width = pxSize + PAD * 2;
    cCanvas.height = pxSize + PAD * 2;
    const cCtx = cCanvas.getContext('2d', { alpha: false });

    // startX/Y are world tile coordinates for the top-left of the chunk content (without padding)
    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;
    const tileSize = state.tileSize;

    // We generate the same CHUNK_SIZE x CHUNK_SIZE logical tiles but render them
    // offset by PAD pixels to leave a 1-2px overlap with neighbor chunks.
    const tileGrid = Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(0));
    const heightGrid = Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(0));
    const visited = Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(false));

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = startX + x;
        const worldY = startY + y;

        const tileType = game.getTile(worldX, worldY);
        tileGrid[y][x] = tileType;
        heightGrid[y][x] = game.getHeight(worldX, worldY);
      }
    }

    const perturbScale = tileSize * 0.15;

    // Phase 1: Crisp roads (compatibility: previously TILE_ROAD existed; check constant)
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tileType = tileGrid[y][x];
        // If game no longer defines TILE_ROAD, skip
        if (game.CONSTANTS.TILE_ROAD && tileType === game.CONSTANTS.TILE_ROAD) {
          cCtx.fillStyle = COLORS[tileType] || '#f0f';
          // Draw with PAD offset so edges have bleed
          cCtx.fillRect(PAD + x * tileSize, PAD + y * tileSize, tileSize, tileSize);
          visited[y][x] = true;
        }
      }
    }

    // Phase 2: Hull polygons for terrain components
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tileType = tileGrid[y][x];
        if (visited[y][x] || tileType === 0 || (game.CONSTANTS.TILE_ROAD && tileType === game.CONSTANTS.TILE_ROAD)) continue;

        const { cells, avgH } = floodFill(tileGrid, heightGrid, visited, x, y, tileType, CHUNK_SIZE);

        const corners = new Set();
        for (let { x: cxCell, y: cyCell } of cells) {
          corners.add(`${cxCell},${cyCell}`);
          corners.add(`${cxCell + 1},${cyCell}`);
          corners.add(`${cxCell},${cyCell + 1}`);
          corners.add(`${cxCell + 1},${cyCell + 1}`);
        }

        const points = Array.from(corners, s => {
          const [px, py] = s.split(',').map(Number);
          return { x: px, y: py };
        });

        const hull = convexHull(points);
        if (hull.length < 3) continue;

        const baseColor = COLORS[tileType] || '#f0f';
        const shadeAmt = (avgH - 0.5) * 0.4;

        cCtx.fillStyle = baseColor;
        cCtx.beginPath();
        for (let i = 0; i < hull.length; i++) {
          const p = hull[i];
          const wx = startX + p.x;
          const wy = startY + p.y;
          // Apply PAD offset when rasterizing into the chunk canvas so polygons
          // extend into the padding area and align with neighbors.
          const px = PAD + p.x * tileSize + getVertexOffset(wx, wy, 0) * perturbScale;
          const py = PAD + p.y * tileSize + getVertexOffset(wx, wy, 1) * perturbScale;
          if (i === 0) cCtx.moveTo(px, py);
          else cCtx.lineTo(px, py);
        }
        cCtx.closePath();
        cCtx.fill();

        if (shadeAmt !== 0) {
          cCtx.fillStyle = shadeAmt > 0 ? `rgba(255,255,255,${Math.min(0.5, shadeAmt)})` : `rgba(0,0,0,${Math.min(0.5, -shadeAmt)})`;
          cCtx.beginPath();
          for (let i = 0; i < hull.length; i++) {
            const p = hull[i];
            const wx = startX + p.x;
            const wy = startY + p.y;
            const px = PAD + p.x * tileSize + getVertexOffset(wx, wy, 0) * perturbScale;
            const py = PAD + p.y * tileSize + getVertexOffset(wx, wy, 1) * perturbScale;
            if (i === 0) cCtx.moveTo(px, py);
            else cCtx.lineTo(px, py);
          }
          cCtx.closePath();
          cCtx.fill();
        }

        if (tileSize > 48) {
          cCtx.strokeStyle = 'rgba(0,0,0,0.08)';
          cCtx.lineWidth = 1;
          cCtx.beginPath();
          for (let i = 0; i < hull.length; i++) {
            const p = hull[i];
            const wx = startX + p.x;
            const wy = startY + p.y;
            const px = PAD + p.x * tileSize + getVertexOffset(wx, wy, 0) * perturbScale;
            const py = PAD + p.y * tileSize + getVertexOffset(wx, wy, 1) * perturbScale;
            if (i === 0) cCtx.moveTo(px, py);
            else cCtx.lineTo(px, py);
          }
          cCtx.closePath();
          cCtx.stroke();
        }
      }
    }

    chunkCache.set(key, { canvas: cCanvas, pad: PAD, lastUsed: performance.now() });
    return cCanvas;
  }

  return { getChunk, clearCache, pruneCache };
}