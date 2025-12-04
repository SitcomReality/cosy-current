// Refactored chunk manager that composes smaller modules to keep concerns separated.

import { convexHull, floodFill } from '../hull.js';
import { getVertexOffset } from '../vertex.js';
import { lerpColorHex as _lerpColorHex } from './helpers.js';
import { createPropsGenerator } from './propsGenerator.js';
import { renderWaterBands } from './depthBands.js';
import { hexToRgb, lerpColorHex } from './helpers.js'; // some helpers reused

export function createChunkManager({ CHUNK_SIZE, COLORS, WATER_PALETTE, state, game, noise, getVertexOffset: externalVertexOffset }) {
  const chunkCache = new Map();
  const chunkPropsCache = new Map();

  const propsGen = createPropsGenerator({ CHUNK_SIZE, game, noise });

  function clearCache() {
    chunkCache.clear();
    chunkPropsCache.clear();
  }

  function pruneCache() {
    if (Math.random() < 0.02) {
      const now = performance.now();
      for (const [key, val] of chunkCache) {
        if (now - val.lastUsed > 2000) {
          chunkCache.delete(key);
        }
      }
      for (const [key, val] of chunkPropsCache) {
        if (now - val.lastUsed > 2000) {
          chunkPropsCache.delete(key);
        }
      }
    }
  }

  function getChunkProps(cx, cy) {
    const key = `${cx},${cy}`;
    if (chunkPropsCache.has(key)) {
      const data = chunkPropsCache.get(key);
      data.lastUsed = performance.now();
      return data.props;
    }

    const props = propsGen.getChunkProps(cx, cy);

    chunkPropsCache.set(key, { props, lastUsed: performance.now() });
    return props;
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
    const cCanvas = document.createElement('canvas');
    cCanvas.width = pxSize;
    cCanvas.height = pxSize;
    const cCtx = cCanvas.getContext('2d', { alpha: false });

    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;
    const tileSize = state.tileSize;

    const tileGrid = Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(0));
    const heightGrid = Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(0));
    const visited = Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(false));
    const depthBandGrid = Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(-1));
    const visitedWater = Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(false));

    const WATER_BAND_COUNT = 4;

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = startX + x;
        const worldY = startY + y;

        const tileType = game.getTile(worldX, worldY);
        tileGrid[y][x] = tileType;
        heightGrid[y][x] = game.getHeight(worldX, worldY);

        if (tileType === game.CONSTANTS.TILE_WATER) {
          const riverInfo = noise.getRiverSystem(worldX, worldY);
          const v = Math.max(0, Math.min(1, riverInfo.value));
          let band = Math.floor(v * WATER_BAND_COUNT);
          if (band >= WATER_BAND_COUNT) band = WATER_BAND_COUNT - 1;
          if (band < 0) band = 0;
          depthBandGrid[y][x] = band;
        }
      }
    }

    // Remove isolated specks (same logic as before)
    {
      const dirs8 = [
        [-1, -1], [0, -1], [1, -1],
        [-1,  0],          [1,  0],
        [-1,  1], [0,  1], [1,  1]
      ];
      const newTileGrid = tileGrid.map(row => row.slice());
      for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const current = tileGrid[y][x];
          let hasSameNeighbor = false;
          const neighborCounts = new Map();

          for (const [dx, dy] of dirs8) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_SIZE) continue;
            const nType = tileGrid[ny][nx];
            if (nType === current) {
              hasSameNeighbor = true;
            }
            neighborCounts.set(nType, (neighborCounts.get(nType) || 0) + 1);
          }

          if (!hasSameNeighbor && neighborCounts.size > 0) {
            let bestType = current;
            let bestCount = -1;
            for (const [tType, count] of neighborCounts.entries()) {
              if (count > bestCount) {
                bestCount = count;
                bestType = tType;
              }
            }
            newTileGrid[y][x] = bestType;
          }
        }
      }
      for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          tileGrid[y][x] = newTileGrid[y][x];
        }
      }
    }

    // Water Phase: quantized depth bands
    if (WATER_PALETTE && game.CONSTANTS.TILE_WATER !== undefined) {
      // Use the extracted water band renderer
      renderWaterBands(cCtx, startX, startY, CHUNK_SIZE, tileSize, tileGrid, depthBandGrid, WATER_BAND_COUNT, WATER_PALETTE, externalVertexOffset || getVertexOffset);
    }

    // Terrain hull polygons
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tileType = tileGrid[y][x];
        if (visited[y][x] || (game.CONSTANTS.TILE_ROAD && tileType === game.CONSTANTS.TILE_ROAD)) continue;

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

        let baseColor = COLORS[tileType] || '#f0f';

        const shadeAmt = (avgH - 0.5) * 0.4;

        cCtx.fillStyle = baseColor;
        cCtx.strokeStyle = baseColor;
        cCtx.lineWidth = 2;
        cCtx.beginPath();
        for (let i = 0; i < hull.length; i++) {
          const p = hull[i];
          const wx = startX + p.x;
          const wy = startY + p.y;
          // Compute perturbed vertex safely, using externalVertexOffset if provided.
          const onChunkBoundary =
            ((startX + p.x) % CHUNK_SIZE === 0) ||
            ((startY + p.y) % CHUNK_SIZE === 0);
          const baseX = p.x * tileSize;
          const baseY = p.y * tileSize;
          let vert;
          if (onChunkBoundary) {
            vert = { x: baseX, y: baseY };
          } else {
            const perturbScale = tileSize * 0.15;
            const ox = (externalVertexOffset || getVertexOffset)(startX + p.x, startY + p.y, 0) * perturbScale;
            const oy = (externalVertexOffset || getVertexOffset)(startX + p.x, startY + p.y, 1) * perturbScale;
            vert = { x: baseX + ox, y: baseY + oy };
          }

          if (i === 0) cCtx.moveTo(vert.x, vert.y);
          else cCtx.lineTo(vert.x, vert.y);
        }
        cCtx.closePath();
        cCtx.fill();
        cCtx.stroke();

        if (shadeAmt !== 0) {
          cCtx.fillStyle = shadeAmt > 0
            ? `rgba(255,255,255,${Math.min(0.5, shadeAmt)})`
            : `rgba(0,0,0,${Math.min(0.5, -shadeAmt)})`;
          cCtx.beginPath();
          for (let i = 0; i < hull.length; i++) {
            const p = hull[i];
            const wx = startX + p.x;
            const wy = startY + p.y;
            // Compute perturbed vertex safely, using externalVertexOffset if provided.
            const onChunkBoundary =
              ((startX + p.x) % CHUNK_SIZE === 0) ||
              ((startY + p.y) % CHUNK_SIZE === 0);
            const baseX = p.x * tileSize;
            const baseY = p.y * tileSize;
            let vert;
            if (onChunkBoundary) {
              vert = { x: baseX, y: baseY };
            } else {
              const perturbScale = tileSize * 0.15;
              const ox = (externalVertexOffset || getVertexOffset)(startX + p.x, startY + p.y, 0) * perturbScale;
              const oy = (externalVertexOffset || getVertexOffset)(startX + p.x, startY + p.y, 1) * perturbScale;
              vert = { x: baseX + ox, y: baseY + oy };
            }
            if (i === 0) cCtx.moveTo(vert.x, vert.y);
            else cCtx.lineTo(vert.x, vert.y);
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
            // Compute perturbed vertex safely, using externalVertexOffset if provided.
            const onChunkBoundary =
              ((startX + p.x) % CHUNK_SIZE === 0) ||
              ((startY + p.y) % CHUNK_SIZE === 0);
            const baseX = p.x * tileSize;
            const baseY = p.y * tileSize;
            let vert;
            if (onChunkBoundary) {
              vert = { x: baseX, y: baseY };
            } else {
              const perturbScale = tileSize * 0.15;
              const ox = (externalVertexOffset || getVertexOffset)(startX + p.x, startY + p.y, 0) * perturbScale;
              const oy = (externalVertexOffset || getVertexOffset)(startX + p.x, startY + p.y, 1) * perturbScale;
              vert = { x: baseX + ox, y: baseY + oy };
            }
            if (i === 0) cCtx.moveTo(vert.x, vert.y);
            else cCtx.lineTo(vert.x, vert.y);
          }
          cCtx.closePath();
          cCtx.stroke();
        }
      }
    }

    chunkCache.set(key, { canvas: cCanvas, lastUsed: performance.now() });
    return cCanvas;
  }

  return { getChunk, getChunkProps, clearCache, pruneCache };
}