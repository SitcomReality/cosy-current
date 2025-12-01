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

  // Simple hex color helpers for shallow-water blending
  function hexToRgb(hex) {
    if (!hex) return { r: 0, g: 0, b: 0 };
    let h = hex.replace('#', '');
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    const num = parseInt(h, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpColorHex(aHex, bHex, t) {
    const a = hexToRgb(aHex);
    const b = hexToRgb(bHex);
    const r = Math.round(lerp(a.r, b.r, t));
    const g = Math.round(lerp(a.g, b.g, t));
    const bch = Math.round(lerp(a.b, b.b, t));
    return `rgb(${r},${g},${bch})`;
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

    // Precompute handy tile constants for readability
    const TILE_RIVER_DEEP = game.CONSTANTS.TILE_RIVER_DEEP;
    const TILE_RIVER_SHALLOW = game.CONSTANTS.TILE_RIVER_SHALLOW;
    const TILE_BANK = game.CONSTANTS.TILE_BANK;

    // Derived colors for shallow water blending:
    // - bankMix: sand color slightly pulled toward deep water so it still feels wet
    // - deepColor: base deep-water color
    const deepColor = COLORS[TILE_RIVER_DEEP];
    const bankColor = COLORS[TILE_BANK];
    const bankMix = lerpColorHex(bankColor, deepColor, 0.4);

    // Phase 0: per-tile shallow water rendering with depth gradient
    // Shallow tiles fade from light, sand-tinted water near banks
    // to almost deep-water color where they border the deep channel.
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tileType = tileGrid[y][x];
        if (tileType === TILE_RIVER_SHALLOW) {
          const worldX = startX + x + 0.5;
          const worldY = startY + y + 0.5;
          const riverInfo = noise.getRiverSystem(worldX, worldY);

          // riverInfo.value is 0 at river center, ~0.6 at deep/shallow edge, ~1 at bank edge.
          // Normalize so t = 0 at deep edge (close to deep water), t = 1 at bank edge (close to sand).
          let t = (riverInfo.value - 0.6) / 0.4;
          if (!Number.isFinite(t)) t = 0;
          t = Math.max(0, Math.min(1, t));

          const color = lerpColorHex(deepColor, bankMix, t);
          cCtx.fillStyle = color;
          cCtx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);

          // Mark as visited so hull-based phase does not re-render shallow tiles
          visited[y][x] = true;
        }
      }
    }

    // Phase 1: Crisp roads (compatibility: previously TILE_ROAD existed; check constant)
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tileType = tileGrid[y][x];
        // If game no longer defines TILE_ROAD, skip
        if (game.CONSTANTS.TILE_ROAD && tileType === game.CONSTANTS.TILE_ROAD) {
          cCtx.fillStyle = COLORS[tileType] || '#f0f';
          cCtx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          visited[y][x] = true;
        }
      }
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
        // tiles are handled in the dedicated shallow-water pass above.
        let baseColor = COLORS[tileType] || '#f0f';

        const shadeAmt = (avgH - 0.5) * 0.4;

        cCtx.fillStyle = baseColor;
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

    chunkCache.set(key, { canvas: cCanvas, lastUsed: performance.now() });
    return cCanvas;
  }

  return { getChunk, clearCache, pruneCache };
}