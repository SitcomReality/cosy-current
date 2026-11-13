// Moved and slightly refactored chunk manager (original monolith extracted here).
// Plant spawn chances reduced by ~50%.

import { convexHull, floodFill } from '../hull.js';
import { lerpColorHex } from './color.js';
import { renderWaterBands } from './waterBands.js';
import { createChunkPropsManager } from './props.js';
import { traceCellLoops, simplifyClosedLoop, traceLoopPath } from './boundary.js';

// Simplification tolerances are in tiles. Large enough to turn the 1-tile
// staircase into clean diagonals, small enough not to swallow a 1-tile beach.
const TERRAIN_SIMPLIFY_TOLERANCE = 0.35;

// Factory to create chunk manager so it can close over state/game/noise/COLORS etc.
export function createChunkManager({ CHUNK_SIZE, COLORS, WATER_PALETTE, state, game, noise, getVertexOffset }) {
  const chunkCache = new Map();

  // Props manager (trees + aquatic flora) now lives in its own module
  const propsManager = createChunkPropsManager({ CHUNK_SIZE, game, noise });

  // ---- Developer renderer experiments (dev panel / ?dev URL flags) ----

  function getTerrainMode() {
    return (state.devOptions && state.devOptions.terrainMode) || 'hull';
  }

  function getHybridRing() {
    const n = Number(state.devOptions && state.devOptions.hybridRing);
    return Number.isFinite(n) ? Math.max(1, Math.min(3, Math.round(n))) : 1;
  }

  function getShadingMode() {
    return (state.devOptions && state.devOptions.shadingMode) || 'baked';
  }

  // Keep every visible water chunk on the same baked-sun value. Without this,
  // each chunk rebuilds on its own schedule and neighboring water can have
  // been lit at slightly different dayTimes.
  function prepareFrame(startChunkX, endChunkX, startChunkY, endChunkY, cycle) {
    if (getShadingMode() !== 'world') return;
    if (!state.isPlaying || !cycle || cycle.shadowAlpha <= 0.01) return;

    let anyStale = false;
    for (let cy = startChunkY; cy <= endChunkY && !anyStale; cy++) {
      for (let cx = startChunkX; cx <= endChunkX; cx++) {
        const data = chunkCache.get(`${cx},${cy}`);
        if (!data || !data.hasWater) continue;
        const lastDayTime = (typeof data.lastDayTime === 'number') ? data.lastDayTime : state.dayTime;
        let diff = Math.abs(state.dayTime - lastDayTime);
        if (diff > 0.5) diff = 1 - diff;
        if (diff > 0.02) {
          anyStale = true;
          break;
        }
      }
    }
    if (!anyStale) return;

    for (let cy = startChunkY; cy <= endChunkY; cy++) {
      for (let cx = startChunkX; cx <= endChunkX; cx++) {
        const data = chunkCache.get(`${cx},${cy}`);
        if (data && data.hasWater) data.forceRebuild = true;
      }
    }
  }

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

  // Generate or return existing chunk canvas
  function getChunk(cx, cy, cycle) {
    const key = `${cx},${cy}`;
    const now = performance.now();
    const TRANSITION_DURATION = 250; // ms, brief but visible cross-fade

    let previousCanvas = null;

    if (chunkCache.has(key)) {
      const data = chunkCache.get(key);

      // Decide whether this chunk's baked lighting is "stale" and should be rebuilt.
      // Only rebuild when:
      //   - the game is playing,
      //   - this chunk actually contains water (so water bands exist), and
      //   - the sun is casting visible shadows (daytime).
      let rebuild = false;
      if (data.forceRebuild) {
        rebuild = true;
        data.forceRebuild = false;
      }
      const shadingMode = getShadingMode();
      if (!rebuild && shadingMode !== 'flat' && state.isPlaying && data.hasWater && cycle && cycle.shadowAlpha > 0.01) {
        const lastDayTime = (typeof data.lastDayTime === 'number') ? data.lastDayTime : state.dayTime;
        let diff = Math.abs(state.dayTime - lastDayTime);
        if (diff > 0.5) diff = 1 - diff; // wrap-around safe
        // If the sun has moved enough (a few in‑game seconds), refresh this chunk.
        if (diff > 0.02) { // ~3–4s at default daySpeed
          rebuild = true;
        }
      }

      // If no rebuild needed, just return existing data
      if (!rebuild) {
        data.lastUsed = now;
        return data;
      }

      // We are going to rebuild: keep the previous canvas for cross-fade
      previousCanvas = data.canvas;

      // Drop stale entry so we fall through to regeneration below.
      chunkCache.delete(key);
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
    // New: depth bands for water, and visited flags for band flood-fill
    const depthBandGrid = Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(-1));
    const visitedWater = Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(false));

    // Number of quantized depth bands for water
    const WATER_BAND_COUNT = 4;
    // Track whether this chunk actually contains any water tiles at all
    let hasWater = false;

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = startX + x;
        const worldY = startY + y;

        tileGrid[y][x] = game.getTile(worldX, worldY);
        heightGrid[y][x] = game.getHeight(worldX, worldY);
      }
    }

    // Post-process to remove isolated single-tile terrain "specks"
    // If a cell has no 8-neighborhood neighbor with the same tile type,
    // flatten it into the most common neighboring tile type.
    //
    // Neighbours outside the chunk are sampled from the world too. The old
    // chunk-local version could flatten a border tile that was actually part
    // of a region continuing into the next chunk, creating a 1-tile mismatch
    // exactly on the seam.
    {
      const dirs8 = [
        [-1, -1], [0, -1], [1, -1],
        [-1,  0],          [1,  0],
        [-1,  1], [0,  1], [1,  1]
      ];
      const newTileGrid = tileGrid.map(row => row.slice());
      // Border cells share out-of-chunk neighbours; cache those getTile calls.
      const outsideTiles = new Map();
      for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const current = tileGrid[y][x];
          let hasSameNeighbor = false;
          const neighborCounts = new Map();

          for (const [dx, dy] of dirs8) {
            const nx = x + dx;
            const ny = y + dy;
            let nType;
            if (nx >= 0 && nx < CHUNK_SIZE && ny >= 0 && ny < CHUNK_SIZE) {
              nType = tileGrid[ny][nx];
            } else {
              const nKey = `${nx},${ny}`;
              nType = outsideTiles.get(nKey);
              if (nType === undefined) {
                nType = game.getTile(startX + nx, startY + ny);
                outsideTiles.set(nKey, nType);
              }
            }

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

    // Water depth bands are computed after speck cleanup so a tile that was
    // flattened from/to water gets the correct band (or none).
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        if (tileGrid[y][x] !== game.CONSTANTS.TILE_WATER) continue;
        hasWater = true;
        const worldX = startX + x;
        const worldY = startY + y;
        const riverInfo = noise.getRiverSystem(worldX, worldY);
        const v = Math.max(0, Math.min(1, riverInfo.value)); // 0 = deep, 1 = shallow
        let band = Math.floor(v * WATER_BAND_COUNT);
        if (band >= WATER_BAND_COUNT) band = WATER_BAND_COUNT - 1;
        if (band < 0) band = 0;
        depthBandGrid[y][x] = band;
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

    const terrainMode = getTerrainMode();
    const usePolygons = terrainMode === 'polygon';
    const useHybrid = terrainMode === 'hybrid';
    const hybridRing = useHybrid ? getHybridRing() : 0;
    const shadingMode = getShadingMode();
    const terrainRingEntries = [];

    // Exact-tile mask for the hybrid renderer. The outermost cells are always
    // exact; `hybridRing` controls how deep the patch extends.
    let ringMask = null;
    if (useHybrid) {
      ringMask = Array.from({ length: CHUNK_SIZE }, (_, y) =>
        Array.from({ length: CHUNK_SIZE }, (_, x) => {
          const dist = Math.min(x, CHUNK_SIZE - 1 - x, y, CHUNK_SIZE - 1 - y);
          return dist < hybridRing;
        })
      );
    }

    function traceComponentPath(loops) {
      traceLoopPath(cCtx, loops, (localX, localY) => {
        const worldX = startX + localX;
        const worldY = startY + localY;
        return getPerturbedVertex(worldX, worldY, localX, localY);
      });
    }

    function drawRingEntry(entry) {
      // Fill only. A stroke here outlines the ring's inner boundary and makes
      // the hybrid patch look like a rectangular frame; the opaque hull
      // underneath already covers any hairline gaps between ring cells.
      cCtx.fillStyle = entry.color;
      cCtx.beginPath();
      traceComponentPath(entry.loops);
      cCtx.fill();

      if (entry.shadeAmt) {
        const shadeColor = entry.shadeAmt > 0
          ? `rgba(255,255,255,${Math.min(0.5, entry.shadeAmt)})`
          : `rgba(0,0,0,${Math.min(0.5, -entry.shadeAmt)})`;
        cCtx.fillStyle = shadeColor;
        cCtx.fill();
      }
    }

    // Phase 1: Water Rendering as quantized depth bands
    let waterRingEntries = [];
    if (WATER_PALETTE && game.CONSTANTS.TILE_WATER !== undefined) {
      waterRingEntries = renderWaterBands({
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
        cycle,
        usePolygons,
        shadingMode,
        ringMask
      });
    }

    // Phase 2: Terrain components (convex hull by default, traced boundary
    // polygons in the experimental dev mode).
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tileType = tileGrid[y][x];
        // Skip already processed tiles and any special road tiles (if defined),
        // but DO NOT skip tileType === 0 so deep water renders as normal terrain.
        if (visited[y][x] || (game.CONSTANTS.TILE_ROAD && tileType === game.CONSTANTS.TILE_ROAD)) continue;

        const { cells, avgH } = floodFill(tileGrid, heightGrid, visited, x, y, tileType, CHUNK_SIZE);

        // Base color: each tile type uses a single flat color; shallow water
        // no longer blends toward sand or deep water so it forms one uniform band.
        const baseColor = COLORS[tileType] || '#f0f';

        const shadeAmt = (avgH - 0.5) * 0.4;

        if (usePolygons) {
          let loops = traceCellLoops(cells, tileGrid, tileType, CHUNK_SIZE);
          loops = loops
            .map(loop => simplifyClosedLoop(loop, TERRAIN_SIMPLIFY_TOLERANCE))
            .filter(loop => loop.length >= 3);
          if (!loops.length) continue;

          cCtx.fillStyle = baseColor;
          cCtx.strokeStyle = baseColor;
          cCtx.lineWidth = 2;
          cCtx.lineJoin = 'miter';
          cCtx.beginPath();
          traceComponentPath(loops);
          cCtx.fill();
          cCtx.stroke();

          if (shadeAmt !== 0) {
            const shadeColor = shadeAmt > 0
              ? `rgba(255,255,255,${Math.min(0.5, shadeAmt)})`
              : `rgba(0,0,0,${Math.min(0.5, -shadeAmt)})`;
            cCtx.fillStyle = shadeColor;
            cCtx.fill();
            cCtx.strokeStyle = shadeColor;
            cCtx.stroke();
          }
          // No dark outline here: its chunk-edge segments would redraw the grid.
          continue;
        }

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

        if (tileSize > 48 && !useHybrid) {
          cCtx.strokeStyle = 'rgba(0,0,0,0.08)';
          cCtx.lineWidth = 1;
          cCtx.beginPath();
          for (let i = 0; i < hull.length; i++) {
            const a = hull[i];
            const b = hull[(i + 1) % hull.length];
            const awx = startX + a.x;
            const awy = startY + a.y;
            const bwx = startX + b.x;
            const bwy = startY + b.y;

            // Don't outline the segments that lie on the chunk border; the
            // neighbouring chunk draws its own, and together they read as a
            // faint grid line even when the 1px position gap is fixed.
            const onChunkEdge =
              (awx === bwx && awx % CHUNK_SIZE === 0) ||
              (awy === bwy && awy % CHUNK_SIZE === 0);
            if (onChunkEdge) continue;

            const va = getPerturbedVertex(awx, awy, a.x, a.y);
            const vb = getPerturbedVertex(bwx, bwy, b.x, b.y);
            cCtx.moveTo(va.x, va.y);
            cCtx.lineTo(vb.x, vb.y);
          }
          cCtx.stroke();
        }

        if (useHybrid) {
          const ringCells = [];
          for (let i = 0; i < cells.length; i++) {
            const c = cells[i];
            if (ringMask[c.y][c.x]) ringCells.push(c);
          }
          if (ringCells.length) {
            const loops = traceCellLoops(ringCells, tileGrid, tileType, CHUNK_SIZE);
            if (loops.length) {
              terrainRingEntries.push({ loops, color: baseColor, shadeAmt });
            }
          }
        }
      }
    }

    // Hybrid: redraw the outer ring of tiles exactly, over the hulls, so
    // adjacent chunks meet on the real tile boundary. Water first, then land.
    if (useHybrid) {
      for (let i = 0; i < waterRingEntries.length; i++) drawRingEntry(waterRingEntries[i]);
      for (let i = 0; i < terrainRingEntries.length; i++) drawRingEntry(terrainRingEntries[i]);
    }

    chunkCache.set(key, {
      canvas: cCanvas,
      prevCanvas: previousCanvas,
      transitionStart: previousCanvas ? performance.now() : 0,
      transitionDuration: previousCanvas ? TRANSITION_DURATION : 0,
      lastUsed: performance.now(),
      lastDayTime: state.dayTime,
      hasWater
    });
    return chunkCache.get(key);
  }

  return { 
    getChunk, 
    getChunkProps: propsManager.getChunkProps, 
    prepareFrame,
    clearCache, 
    pruneCache 
  };
}