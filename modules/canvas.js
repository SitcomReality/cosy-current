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
  const chunkCache = new Map(); 

  // Pseudo-random vertex perturbation (world grid coords)
  function getVertexOffset(wx, wy, comp) {
    const seed = (wx * 73856093 ^ wy * 19349663) ^ comp;
    const hash = Math.sin(seed * 12.9898) * 43758.5453;
    return ((hash % 1) - 0.5) * 0.4; // -0.2 to 0.2 grid units
  }

  // Monotone chain convex hull (grid units)
  function convexHull(pts) {
    if (pts.length < 3) return [];
    const sorted = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

    const build = (points) => {
      const hull = [];
      for (let p of points) {
        while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) {
          hull.pop();
        }
        hull.push(p);
      }
      return hull;
    };

    const lower = build(sorted);
    const upper = build(sorted.slice().reverse());

    // Concat without duplicates
    const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
    return hull.length >= 3 ? hull : [];
  }

  // 4-connected floodfill (returns cells & avg height)
  function floodFill(tileGrid, heightGrid, visited, sx, sy, tileType) {
    const cells = [];
    let sumH = 0;
    const stack = [[sx, sy]];
    const dirs = [[0,1],[1,0],[0,-1],[-1,0]];

    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cx >= CHUNK_SIZE || cy < 0 || cy >= CHUNK_SIZE ||
          visited[cy][cx] || tileGrid[cy][cx] !== tileType) continue;

      visited[cy][cx] = true;
      cells.push({ x: cx, y: cy });
      sumH += heightGrid[cy][cx];

      for (let [dx, dy] of dirs) {
        stack.push([cx + dx, cy + dy]);
      }
    }

    return {
      cells,
      avgH: cells.length > 0 ? sumH / cells.length : 0
    };
  }

  function resize() {
    const dpr = state.pixelRatio;
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = state.width * dpr;
    canvas.height = state.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    
    chunkCache.clear();
  }

  function getChunk(cx, cy) {
    const key = `${cx},${cy}`;
    if (chunkCache.has(key)) {
      const data = chunkCache.get(key);
      data.lastUsed = performance.now();
      return data.canvas;
    }

    // Generate Chunk
    const pxSize = CHUNK_SIZE * state.tileSize;
    const cCanvas = document.createElement('canvas');
    cCanvas.width = pxSize;
    cCanvas.height = pxSize;
    const cCtx = cCanvas.getContext('2d', { alpha: false });

    // Fill logic
    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;
    const tileSize = state.tileSize;

    // Precompute grids for chunk
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

    // Phase 1: Crisp roads
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tileType = tileGrid[y][x];
        if (tileType === game.CONSTANTS.TILE_ROAD) {
          cCtx.fillStyle = COLORS[tileType] || '#f0f';
          cCtx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          visited[y][x] = true; // Mark to skip in terrain
        }
      }
    }

    // Phase 2: Hull polygons for terrain components
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tileType = tileGrid[y][x];
        if (visited[y][x] || tileType === 0 || tileType === game.CONSTANTS.TILE_ROAD) continue;

        const { cells, avgH } = floodFill(tileGrid, heightGrid, visited, x, y, tileType);

        // Collect unique corners (chunk-local grid 0..CHUNK_SIZE)
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

        // Base fill
        cCtx.fillStyle = baseColor;
        cCtx.beginPath();
        for (let i = 0; i < hull.length; i++) {
          const p = hull[i];
          const wx = startX + p.x;
          const wy = startY + p.y;
          const px = p.x * tileSize + getVertexOffset(wx, wy, 0) * perturbScale;
          const py = p.y * tileSize + getVertexOffset(wx, wy, 1) * perturbScale;
          if (i === 0) cCtx.moveTo(px, py);
          else cCtx.lineTo(px, py);
        }
        cCtx.closePath();
        cCtx.fill();

        // Height shading overlay
        if (shadeAmt !== 0) {
          cCtx.fillStyle = shadeAmt > 0 ? `rgba(255,255,255,${Math.min(0.5, shadeAmt)})` : `rgba(0,0,0,${Math.min(0.5, -shadeAmt)})`;
          cCtx.beginPath();
          for (let i = 0; i < hull.length; i++) {
            const p = hull[i];
            const wx = startX + p.x;
            const wy = startY + p.y;
            const px = p.x * tileSize + getVertexOffset(wx, wy, 0) * perturbScale;
            const py = p.y * tileSize + getVertexOffset(wx, wy, 1) * perturbScale;
            if (i === 0) cCtx.moveTo(px, py);
            else cCtx.lineTo(px, py);
          }
          cCtx.closePath();
          cCtx.fill();
        }

        // Optional subtle outline for large tilesizes
        if (tileSize > 48) {
          cCtx.strokeStyle = 'rgba(0,0,0,0.08)';
          cCtx.lineWidth = 1;
          cCtx.beginPath();
          for (let i = 0; i < hull.length; i++) {
            const p = hull[i];
            const wx = startX + p.x;
            const wy = startY + p.y;
            const px = p.x * tileSize + getVertexOffset(wx, wy, 0) * perturbScale;
            const py = p.y * tileSize + getVertexOffset(wx, wy, 1) * perturbScale;
            if (i === 0) cCtx.moveTo(px, py);
            else cCtx.lineTo(px, py);
          }
          cCtx.closePath();
          cCtx.stroke();
        }
      }
    }

    chunkCache.set(key, { canvas: cCanvas, lastUsed: performance.now() });
    return cCanvas;
  }

  function renderFrame(timestamp) {
    // 1. Draw Background (Chunks)
    // Clear not strictly necessary if chunks cover screen, but good for safety
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, state.width, state.height);

    if (!state.isPlaying) {
      drawMenuBackground(timestamp);
      return;
    }

    const tileSize = state.tileSize;
    const centerX = state.width / 2;
    const centerY = state.height / 2;
    
    // Viewport Calculations
    // How many chunks fit on screen?
    // We expand slightly to ensure edges are drawn
    const visibleWidth = state.width;
    const visibleHeight = state.height;
    
    // Convert Camera Center to Chunk Coordinates
    const chunkPixels = CHUNK_SIZE * tileSize;
    
    // Top-Left of screen in world pixels (relative to camera)
    // Camera is at center.
    // screen 0,0 corresponds to world: camX*tile - width/2
    const viewLeftTile = state.camera.x - (visibleWidth / 2) / tileSize;
    const viewRightTile = state.camera.x + (visibleWidth / 2) / tileSize;
    const viewTopTile = state.camera.y - (visibleHeight / 2) / tileSize;
    const viewBottomTile = state.camera.y + (visibleHeight / 2) / tileSize;

    const startChunkX = Math.floor(viewLeftTile / CHUNK_SIZE);
    const endChunkX = Math.floor(viewRightTile / CHUNK_SIZE);
    const startChunkY = Math.floor(viewTopTile / CHUNK_SIZE);
    const endChunkY = Math.floor(viewBottomTile / CHUNK_SIZE);

    // Draw Chunks
    for (let cy = startChunkY; cy <= endChunkY; cy++) {
      for (let cx = startChunkX; cx <= endChunkX; cx++) {
        const chunkImg = getChunk(cx, cy);
        
        // Calculate position on screen
        // Chunk origin in world tiles: cx * 16
        // World tile to Screen: (world - cam) * size + center
        const chunkWorldX = cx * CHUNK_SIZE;
        const chunkWorldY = cy * CHUNK_SIZE;
        
        const screenX = (chunkWorldX - state.camera.x) * tileSize + centerX;
        const screenY = (chunkWorldY - state.camera.y) * tileSize + centerY;

        // Round to avoid subpixel gaps between chunks if browser anti-aliases
        // But allow subpixel movement?
        // For performance and seamlessness, drawing rounded coordinates prevents seams.
        // Camera smoothness might suffer slightly but prevents "grid lines".
        ctx.drawImage(chunkImg, Math.floor(screenX), Math.floor(screenY));
      }
    }
    
    // Prune Cache
    if (Math.random() < 0.02) {
      const now = performance.now();
      for (const [key, val] of chunkCache) {
        if (now - val.lastUsed > 2000) {
          chunkCache.delete(key);
        }
      }
    }

    // 2. Render Entities (Towns, Relics)
    // We can't bake these into chunks because they might interact/animate (or we might want to later)
    state.entities.forEach(ent => {
       const screenX = (ent.x - state.camera.x) * tileSize + centerX;
       const screenY = (ent.y - state.camera.y) * tileSize + centerY;
       
       // Cull
       if (screenX < -tileSize*2 || screenX > state.width + tileSize*2 || 
           screenY < -tileSize*2 || screenY > state.height + tileSize*2) return;

       if (ent.type === game.CONSTANTS.ENTITY_CITY) {
         // Neon Castle
         ctx.fillStyle = 'rgba(16, 185, 129, 0.2)'; // Glow
         ctx.beginPath();
         ctx.arc(screenX + tileSize/2, screenY + tileSize/2, tileSize * 2, 0, Math.PI*2);
         ctx.fill();

         ctx.fillStyle = '#10b981';
         ctx.fillRect(screenX, screenY, tileSize, tileSize);
         // Detail
         ctx.fillStyle = '#065f46';
         ctx.fillRect(screenX + tileSize/2 - tileSize*0.1, screenY, tileSize*0.2, tileSize*0.6); 
       } else if (ent.type === game.CONSTANTS.ENTITY_RELIC) {
         // Ancient Tech
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

    // 3. Render Player (Caravan)
    const p = state.player;
    const px = (p.x - state.camera.x) * tileSize + centerX;
    const py = (p.y - state.camera.y) * tileSize + centerY;
    
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.angle);
    
    const carScale = 1.0; 
    const carLen = tileSize * 1.5;
    const carWid = tileSize * 0.8;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-carLen/2 + 4, -carWid/2 + 4, carLen, carWid);

    // Body
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-carLen/2, -carWid/2, carLen, carWid);
    
    // Detail / Windows
    ctx.fillStyle = '#334155';
    ctx.fillRect(-carLen/4, -carWid/3, carLen/2, carWid/1.5);
    
    // Engine Glow
    ctx.fillStyle = '#0ea5e9';
    ctx.shadowColor = '#0ea5e9';
    ctx.shadowBlur = 10;
    ctx.fillRect(-carLen/2 - 4, -carWid/4, 4, carWid/2);
    
    // Headlights
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

  function drawMenuBackground(t) {
    // Simple animated gradient for better performance than the circles
    const hue = (t * 0.01) % 360;
    const grad = ctx.createLinearGradient(0, 0, state.width, state.height);
    grad.addColorStop(0, `hsl(${hue}, 20%, 10%)`);
    grad.addColorStop(1, `hsl(${hue + 40}, 30%, 5%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  function start() {
    resize();
    window.addEventListener('resize', resize);
  }

  function stop() {
    window.removeEventListener('resize', resize);
  }

  // Clear chunk cache when zoom level (tileSize) changes
  function clearCache() {
    chunkCache.clear();
  }

  return { start, stop, resize, renderFrame, clearCache };
}