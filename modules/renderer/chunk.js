import { convexHull, floodFill } from './hull.js';

// Factory to create chunk manager so it can close over state/game/noise/COLORS etc.
export function createChunkManager({ CHUNK_SIZE, COLORS, WATER_PALETTE, state, game, noise, getVertexOffset }) {
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
    // Clamp t
    t = Math.max(0, Math.min(1, t));
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

    // Phase 1: Water Rendering (Gradient Tiles)
    // We render water as individual quads to support smooth gradients based on depth
    if (WATER_PALETTE && game.CONSTANTS.TILE_WATER !== undefined) {
      for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          if (tileGrid[y][x] === game.CONSTANTS.TILE_WATER) {
            const worldX = startX + x;
            const worldY = startY + y;
            
            // Get river depth value (0=center, 1=edge)
            const riverInfo = noise.getRiverSystem(worldX, worldY);
            // Calculate gradient color
            // value is approx 0..1 inside river. 
            // 0 -> Deep, 1 -> Shallow
            const color = lerpColorHex(WATER_PALETTE.deep, WATER_PALETTE.shallow, riverInfo.value);
            
            // Get perturbed vertices for the quad
            const vTL = getPerturbedVertex(worldX, worldY, x, y);
            const vTR = getPerturbedVertex(worldX + 1, worldY, x + 1, y);
            const vBR = getPerturbedVertex(worldX + 1, worldY + 1, x + 1, y + 1);
            const vBL = getPerturbedVertex(worldX, worldY + 1, x, y + 1);

            cCtx.fillStyle = color;
            // Add a tiny stroke to prevent sub-pixel gaps between tiles
            cCtx.strokeStyle = color; 
            cCtx.lineWidth = 1;
            
            cCtx.beginPath();
            cCtx.moveTo(vTL.x, vTL.y);
            cCtx.lineTo(vTR.x, vTR.y);
            cCtx.lineTo(vBR.x, vBR.y);
            cCtx.lineTo(vBL.x, vBL.y);
            cCtx.closePath();
            
            cCtx.fill();
            cCtx.stroke();

            visited[y][x] = true;
          }
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
        // no longer blends toward sand or deep water so it forms one uniform band.
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