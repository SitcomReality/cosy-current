import { convexHull, floodFill } from './hull.js';

// Factory to create chunk manager so it can close over state/game/noise/COLORS etc.
export function createChunkManager({ CHUNK_SIZE, COLORS, WATER_PALETTE, state, game, noise, getVertexOffset }) {
  const chunkCache = new Map();
  const chunkPropsCache = new Map();

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
      
      // Also prune props
      for (const [key, val] of chunkPropsCache) {
        if (now - val.lastUsed > 2000) {
          chunkPropsCache.delete(key);
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
  
  // Get tree/prop data for a chunk
  function getChunkProps(cx, cy) {
    const key = `${cx},${cy}`;
    if (chunkPropsCache.has(key)) {
      const data = chunkPropsCache.get(key);
      data.lastUsed = performance.now();
      return data.props;
    }

    const props = [];
    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;

    // Deterministic seed for this chunk
    const chunkSeed = (cx * 73856093) ^ (cy * 19349663);

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = startX + x;
        const worldY = startY + y;
        const tile = game.getTile(worldX, worldY);

        // Simple hash
        const h = Math.sin(worldX * 12.9898 + worldY * 78.233 + chunkSeed) * 43758.5453;
        const rand = h - Math.floor(h);

        // Trees
        if (tile === game.CONSTANTS.TILE_FOREST) {
          if (rand < 0.50) { // reduced from 65% -> 50% to avoid overcrowding when larger
             // Add some jitter to position
             const jx = (Math.sin(h) * 0.5) + 0.5; 
             const jy = (Math.cos(h) * 0.5) + 0.5;
             props.push({ 
               x: worldX + jx * 0.8, 
               y: worldY + jy * 0.8, 
               h: 2.0 + rand * 1.6, // doubled size range (was 1.0 + rand * 0.8)
               type: 'forest' 
             });
          }
        } else if (tile === game.CONSTANTS.TILE_GRASS) {
          if (rand < 0.05) { // 5% density kept for grass props
             const jx = (Math.sin(h) * 0.5) + 0.5; 
             const jy = (Math.cos(h) * 0.5) + 0.5;
             props.push({ 
               x: worldX + jx * 0.8, 
               y: worldY + jy * 0.8, 
               h: 2.0 + rand * 1.6, // now matches forest size range and doubled from previous grass sizes
               type: 'grass' 
             });
          }
        } else if (tile === game.CONSTANTS.TILE_WATER) {
          // Aquatic flora generation
          // r.value: 0.0 (deep) -> 1.0 (bank)
          const r = noise.getRiverSystem(worldX, worldY);
          
          // Probability checks based on depth
          // We want more plants near edges, fewer in deep center channel to keep navigation clear-ish
          let chance = 0;
          let type = null;
          let hMult = 1.0;

          if (r.value > 0.85) {
             // Very shallow/bank: Reeds
             chance = 0.25;
             type = 'reeds';
             hMult = 0.8;
          } else if (r.value > 0.4) {
             // Mid depth: Seagrass
             chance = 0.15;
             type = 'seagrass';
             hMult = 0.6;
          } else {
             // Deep: Kelp
             chance = 0.08;
             type = 'kelp';
             hMult = 1.2;
          }

          if (rand < chance) {
             const jx = (Math.sin(h) * 0.5) + 0.5; 
             const jy = (Math.cos(h) * 0.5) + 0.5;
             
             // Calculate depth factor (0=surface/bank, 1=deepest) for tinting
             const depthFactor = Math.max(0, Math.min(1, (1.0 - r.value) * 1.2));

             props.push({ 
               x: worldX + jx * 0.8, 
               y: worldY + jy * 0.8, 
               h: (1.0 + rand * 1.0) * hMult, 
               type: type,
               depth: depthFactor,
               // Store a random phase for any sway animation if we add it later
               phase: rand * Math.PI * 2
             });
          }
        }
      }
    }

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

    // Helper: flood-fill within a numeric band grid (e.g., depthBandGrid)
    function floodFillBand(grid, visitedGrid, sx, sy, bandValue) {
      const cells = [];
      const stack = [[sx, sy]];
      const dirs = [[0,1],[1,0],[0,-1],[-1,0]];

      while (stack.length) {
        const [cxCell, cyCell] = stack.pop();
        if (cxCell < 0 || cxCell >= CHUNK_SIZE || cyCell < 0 || cyCell >= CHUNK_SIZE) continue;
        if (visitedGrid[cyCell][cxCell]) continue;
        if (grid[cyCell][cxCell] !== bandValue) continue;

        visitedGrid[cyCell][cxCell] = true;
        cells.push({ x: cxCell, y: cyCell });

        for (let [dx, dy] of dirs) {
          stack.push([cxCell + dx, cyCell + dy]);
        }
      }

      return cells;
    }

    // Phase 1: Water Rendering as quantized depth bands using hull polygons
    if (WATER_PALETTE && game.CONSTANTS.TILE_WATER !== undefined) {
      for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          if (tileGrid[y][x] !== game.CONSTANTS.TILE_WATER) continue;
          if (visitedWater[y][x]) continue;

          const band = depthBandGrid[y][x];
          if (band < 0) continue;

          const cells = floodFillBand(depthBandGrid, visitedWater, x, y, band);
          if (!cells.length) continue;

          const corners = new Set();
          for (let { x: cxCell, y: cyCell } of cells) {
            corners.add(`${cxCell},${cyCell}`);
            corners.add(`${cxCell + 1},${cyCell}`);
            corners.add(`${cxCell},${cyCell + 1}`);
            corners.add(`${cxCell + 1},${cyCell + 1}`);
            // Also mark main visited grid so terrain phase skips water
            visited[cyCell][cxCell] = true;
          }

          const points = Array.from(corners, s => {
            const [px, py] = s.split(',').map(Number);
            return { x: px, y: py };
          });

          const hull = convexHull(points);
          if (hull.length < 3) continue;

          // Compute representative depth for this band for coloring
          const bandCenterT = (band + 0.5) / WATER_BAND_COUNT; // 0..1 shallowness
          const color = lerpColorHex(WATER_PALETTE.deep, WATER_PALETTE.shallow, bandCenterT);

          cCtx.fillStyle = color;
          cCtx.strokeStyle = color;
          cCtx.lineWidth = 2;
          cCtx.lineJoin = 'miter';
          cCtx.lineCap = 'butt';

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
          cCtx.stroke();
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

    chunkCache.set(key, { canvas: cCanvas, lastUsed: performance.now() });
    return cCanvas;
  }

  return { getChunk, getChunkProps, clearCache, pruneCache };
}