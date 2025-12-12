// Moved and slightly refactored chunk manager (original monolith extracted here).
// Plant spawn chances reduced by ~50%.

import { convexHull, floodFill } from '../hull.js';
import { lerpColorHex } from './color.js';
import { renderWaterBands } from './waterBands.js';
import { createChunkPropsManager } from './props.js';

// Factory to create chunk manager so it can close over state/game/noise/COLORS etc.
export function createChunkManager({ CHUNK_SIZE, COLORS, WATER_PALETTE, state, game, noise, getVertexOffset }) {
  const chunkCache = new Map();

  // Props manager (trees + aquatic flora) now lives in its own module
  const propsManager = createChunkPropsManager({ CHUNK_SIZE, game, noise });

  const CHUNK_REBUILD_FADE_MS = 260; // crossfade duration for chunk lighting updates

  function clearCache() {
    chunkCache.clear();
    propsManager.clearPropsCache();
  }

  function pruneCache() {
    if (Math.random() < 0.02) {
      const now = performance.now();
      for (const [key, val] of chunkCache) {
        if (now - val.lastUsed > 2000) {
          chunkCache.delete(key);
        }
      }
      // Also prune props
      propsManager.prunePropsCache();
    }
  }

  // Expose entry for renderer so it can perform crossfade drawing
  function getChunkEntry(cx, cy) {
    const key = `${cx},${cy}`;
    return chunkCache.get(key) || null;
  }

  // Generate or return existing chunk canvas
  function getChunk(cx, cy, cycle) {
    const key = `${cx},${cy}`;
    const now = performance.now();

    if (chunkCache.has(key)) {
      const data = chunkCache.get(key);

      // Decide whether this chunk's baked lighting is "stale" and should be rebuilt.
      // We compare the stored dayTime to the current one, wrapping across 0..1.
      let rebuild = false;
      if (state.isPlaying) {
        const lastDayTime = (typeof data.lastDayTime === 'number') ? data.lastDayTime : state.dayTime;
        let diff = Math.abs(state.dayTime - lastDayTime);
        if (diff > 0.5) diff = 1 - diff; // wrap-around safe
        // If the sun has moved enough (a few in‑game seconds), refresh this chunk.
        if (diff > 0.02) { // ~3–4s at default daySpeed
          rebuild = true;
        }
      }

      if (!rebuild) {
        data.lastUsed = now;
        return data.canvas;
      }

      // Instead of immediately deleting the old canvas, keep it for a brief crossfade.
      // Mark previous canvas and allow drawing code to blend between old/new during transition.
      // We'll fall through to regeneration and replace data.canvas but keep data.prevCanvas, prevStart.
      // Do not delete yet.
    }

    const pxSize = CHUNK_SIZE * state.tileSize;
    const cCanvas = document.createElement('canvas');
    cCanvas.width = pxSize;
    cCanvas.height = pxSize;
    const cCtx = cCanvas.getContext('2d', { alpha: false });

    // Explicitly clear the chunk canvas to prevent dark artifacts during crossfade.
    // Use the deep water color or a dark neutral color as the base background.
    cCtx.fillStyle = WATER_PALETTE.deep || '#0f172a';
    cCtx.fillRect(0, 0, pxSize, pxSize);

    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;
    const tileSize = state.tileSize;

    const tileGrid = Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(0));
    const heightGrid = Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(0));
    const visited = Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(false));
    // New: depth bands for water, and visited flags for band flood-fill
    const depthBandGrid = Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(-1));
    const visitedWater = Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(false));

    // Number of quantized depth bands for water
    const WATER_BAND_COUNT = 4;

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = startX + x;
        const worldY = startY + y;

        const tileType = game.getTile(worldX, worldY);
        tileGrid[y][x] = tileType;
        heightGrid[y][x] = game.getHeight(worldX, worldY);

        // Precompute water depth band per cell
        if (tileType === game.CONSTANTS.TILE_WATER) {
          const riverInfo = noise.getRiverSystem(worldX, worldY);
          const v = Math.max(0, Math.min(1, riverInfo.value)); // 0 = deep, 1 = shallow
          let band = Math.floor(v * WATER_BAND_COUNT);
          if (band >= WATER_BAND_COUNT) band = WATER_BAND_COUNT - 1;
          if (band < 0) band = 0;
          depthBandGrid[y][x] = band;
        }
      }
    }

    // Post-process to remove isolated single-tile terrain "specks"
    // If a cell has no 8-neighborhood neighbor with the same tile type,
    // flatten it into the most common neighboring tile type.
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
            // Pick the most common neighboring tile type to flatten into
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

    const perturbScale = tileSize * 0.15;

    // Helper: compute a vertex position with deterministic perturbation,
    // but keep vertices that lie on chunk boundaries perfectly aligned
    function getPerturbedVertex(worldX, worldY, localGridX, localGridY) {
      // Vertices lying exactly on chunk grid lines (in tile space) are shared
      // between adjacent chunks; do not perturb them so edges stay flush.
      const onChunkBoundary = 
        (worldX % CHUNK_SIZE === 0) ||
        (worldY % CHUNK_SIZE === 0);

      const baseX = localGridX * tileSize;
      const baseY = localGridY * tileSize;

      if (onChunkBoundary) {
        return { x: baseX, y: baseY };
      }

      const ox = getVertexOffset(worldX, worldY, 0) * perturbScale;
      const oy = getVertexOffset(worldX, worldY, 1) * perturbScale;
      return { x: baseX + ox, y: baseY + oy };
    }

    // Phase 1: Water Rendering as quantized depth bands using hull polygons
    if (WATER_PALETTE && game.CONSTANTS.TILE_WATER !== undefined) {
      renderWaterBands({
        cCtx,
        CHUNK_SIZE,
        startX,
        startY,
        tileGrid,
        depthBandGrid,
        visitedWater,
        visited,
        WATER_BAND_COUNT,
        game,
        WATER_PALETTE,
        getPerturbedVertex,
        noise,
        cycle
      });
    }

    // Phase 2: Hull polygons for terrain components
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tileType = tileGrid[y][x];
        // Skip already processed tiles and any special road tiles (if defined),
        // but DO NOT skip tileType === 0 so deep water renders as normal terrain.
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

        // Base color: each tile type uses a single flat color; shallow water
        // no longer blends toward sand or deep water so it forms one uniform band.
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
          const v = getPerturbedVertex(wx, wy, p.x, p.y);
          if (i === 0) cCtx.moveTo(v.x, v.y);
          else cCtx.lineTo(v.x, v.y);
        }
        cCtx.closePath();
        cCtx.fill();
        cCtx.stroke(); // Apply stroke to terrain hull for overlap

        if (shadeAmt !== 0) {
          cCtx.fillStyle = shadeAmt > 0
            ? `rgba(255,255,255,${Math.min(0.5, shadeAmt)})`
            : `rgba(0,0,0,${Math.min(0.5, -shadeAmt)})`;
          cCtx.beginPath();
          for (let i = 0; i < hull.length; i++) {
            const p = hull[i];
            const wx = startX + p.x;
            const wy = startY + p.y;
            const v = getPerturbedVertex(wx, wy, p.x, p.y);
            if (i === 0) cCtx.moveTo(v.x, v.y);
            else cCtx.lineTo(v.x, v.y);
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
            const v = getPerturbedVertex(wx, wy, p.x, p.y);
            if (i === 0) cCtx.moveTo(v.x, v.y);
            else cCtx.lineTo(v.x, v.y);
          }
          cCtx.closePath();
          cCtx.stroke();
        }
      }
    }

    // If there was a previous entry, preserve its canvas for a short crossfade
    if (chunkCache.has(key)) {
      const old = chunkCache.get(key);
      // move old.canvas to prevCanvas for blending; keep lastDayTime for continuity
      const prevCanvas = old.canvas;
      chunkCache.delete(key);
      chunkCache.set(key, { canvas: cCanvas, prevCanvas, prevStart: performance.now(), lastUsed: performance.now(), lastDayTime: state.dayTime });
    } else {
      chunkCache.set(key, { canvas: cCanvas, lastUsed: performance.now(), lastDayTime: state.dayTime });
    }

    return cCanvas;
  }

  return { 
    getChunk, 
    getChunkProps: propsManager.getChunkProps, 
    clearCache, 
    pruneCache,
    getChunkEntry
  };
}