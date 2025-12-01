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

  // Deterministic vertex offset for low-poly look
  function getVertexOffset(x, y, corner) {
    // Use simple hash-like function for deterministic pseudo-random offsets
    const seed = (x * 73856093) ^ (y * 19349663) ^ (corner * 83492791);
    const hash = Math.sin(seed) * 43758.5453123;
    const offset = (hash - Math.floor(hash)) * 0.3; // 0 to 0.3 range
    return offset;
  }

  // Choose diagonal direction deterministically
  function getDiagonalDir(x, y) {
    // Checkerboard-like pattern with some noise
    const hash = ((x * 73) ^ (y * 31)) % 2;
    return hash === 0 ? 'tl-br' : 'tr-bl';
  }

  // =========================
  // Vector Terrain Extensions
  // =========================

  // Config (tweakable)
  const CONNECTION_SPAN = 2; // how many tiles grouped per vector cell
  const NOISE_INTENSITY = 0.35;
  const HEIGHT_AMPLITUDE = () => state.tileSize * 0.6;

  // Simple deterministic pseudo-noise for vertex placement
  function noise2D(x, y) {
    const sx = x * 0.3;
    const sy = y * 0.3;
    return (Math.sin(sx + y) * Math.cos(sy) + Math.sin(sx * 0.7) * Math.cos(sy * 0.7)) / 2;
  }

  // Vertex cache shared across chunks (per frame/chunk generation may reset)
  if (!state.vertexCache) state.vertexCache = new Map();

  // Get average height for a region (used for vertex displacement)
  function getAverageHeight(x, y, size) {
    let total = 0;
    let count = 0;
    for (let iy = 0; iy < size; iy++) {
      for (let ix = 0; ix < size; ix++) {
        const wx = Math.floor(x) + ix;
        const wy = Math.floor(y) + iy;
        total += (game.getHeight(wx, wy) || 0);
        count++;
      }
    }
    return count ? total / count : 0;
  }

  // Shared vertex generation using connection span
  function getSharedVertex(worldX, worldY) {
    const gridX = Math.floor(worldX / CONNECTION_SPAN) * CONNECTION_SPAN;
    const gridY = Math.floor(worldY / CONNECTION_SPAN) * CONNECTION_SPAN;
    const key = `${gridX},${gridY}`;
    if (!state.vertexCache.has(key)) {
      const baseX = gridX + CONNECTION_SPAN / 2;
      const baseY = gridY + CONNECTION_SPAN / 2;

      const height = getAverageHeight(gridX, gridY, CONNECTION_SPAN);
      const nx = noise2D(gridX, gridY);
      const ny = noise2D(gridX + 123, gridY + 456);

      const displaceX = nx * NOISE_INTENSITY * state.tileSize;
      const displaceY = ny * NOISE_INTENSITY * state.tileSize;

      state.vertexCache.set(key, {
        x: baseX * state.tileSize + displaceX,
        y: baseY * state.tileSize - height * HEIGHT_AMPLITUDE() + displaceY
      });
    }
    return state.vertexCache.get(key);
  }

  // Height-aware shading helper
  function getTerrainColor(tileType, height) {
    const base = COLORS[tileType] || '#f0f';
    const shade = (height - 0.5) * 0.6;
    const r = parseInt(base.slice(1, 3), 16);
    const g = parseInt(base.slice(3, 5), 16);
    const b = parseInt(base.slice(5, 7), 16);
    const nr = Math.min(255, Math.max(0, Math.round(r + shade * 255)));
    const ng = Math.min(255, Math.max(0, Math.round(g + shade * 255)));
    const nb = Math.min(255, Math.max(0, Math.round(b + shade * 255)));
    return `rgb(${nr},${ng},${nb})`;
  }

  // Render a vector cell covering CONNECTION_SPAN x CONNECTION_SPAN tiles
  function renderVectorCell(cCtx, cellWorldX, cellWorldY, localX, localY) {
    const tileSize = state.tileSize;
    const span = CONNECTION_SPAN;

    // World tile coords (integers)
    const wx = Math.floor(cellWorldX);
    const wy = Math.floor(cellWorldY);

    // Shared vertices at the 4 corners (in world tile coordinates)
    const tl = getSharedVertex(wx, wy);
    const tr = getSharedVertex(wx + span, wy);
    const bl = getSharedVertex(wx, wy + span);
    const br = getSharedVertex(wx + span, wy + span);

    // Midpoints with noise-driven offsets
    const midTop = {
      x: (tl.x + tr.x) / 2 + noise2D(wx, wy) * NOISE_INTENSITY * tileSize,
      y: (tl.y + tr.y) / 2
    };
    const midRight = {
      x: (tr.x + br.x) / 2,
      y: (tr.y + br.y) / 2 + noise2D(wx + span, wy) * NOISE_INTENSITY * tileSize
    };
    const midBottom = {
      x: (bl.x + br.x) / 2 - noise2D(wx, wy + span) * NOISE_INTENSITY * tileSize,
      y: (bl.y + br.y) / 2
    };
    const midLeft = {
      x: (tl.x + bl.x) / 2,
      y: (tl.y + bl.y) / 2 - noise2D(wx + span, wy + span) * NOISE_INTENSITY * tileSize
    };

    // Determine dominant tile type and average height for the region
    let dominantType = game.CONSTANTS.TILE_GRASS;
    let totalHeight = 0;
    let counts = {};
    for (let yy = 0; yy < span; yy++) {
      for (let xx = 0; xx < span; xx++) {
        const tx = wx + xx;
        const ty = wy + yy;
        const type = game.getTile(tx, ty);
        const h = game.getHeight(tx, ty) || 0;
        totalHeight += h;
        counts[type] = (counts[type] || 0) + 1;
      }
    }
    const avgHeight = totalHeight / (span * span);

    // pick most common tile type
    let maxCount = 0;
    for (const t in counts) {
      if (counts[t] > maxCount) {
        maxCount = counts[t];
        dominantType = parseInt(t, 10);
      }
    }

    const fillColor = getTerrainColor(dominantType, avgHeight);

    // Draw the polygon
    cCtx.fillStyle = fillColor;
    cCtx.beginPath();
    cCtx.moveTo(tl.x - localX * tileSize, tl.y - localY * tileSize);
    cCtx.lineTo(midTop.x - localX * tileSize, midTop.y - localY * tileSize);
    cCtx.lineTo(tr.x - localX * tileSize, tr.y - localY * tileSize);
    cCtx.lineTo(midRight.x - localX * tileSize, midRight.y - localY * tileSize);
    cCtx.lineTo(br.x - localX * tileSize, br.y - localY * tileSize);
    cCtx.lineTo(midBottom.x - localX * tileSize, midBottom.y - localY * tileSize);
    cCtx.lineTo(bl.x - localX * tileSize, bl.y - localY * tileSize);
    cCtx.lineTo(midLeft.x - localX * tileSize, midLeft.y - localY * tileSize);
    cCtx.closePath();
    cCtx.fill();

    // Optional highlights for large tiles
    if (state.tileSize > 48) {
      cCtx.strokeStyle = 'rgba(255,255,255,0.08)';
      cCtx.lineWidth = 1;
      cCtx.beginPath();
      cCtx.moveTo(midTop.x - localX * tileSize, midTop.y - localY * tileSize);
      cCtx.lineTo(midRight.x - localX * tileSize, midRight.y - localY * tileSize);
      cCtx.lineTo(midBottom.x - localX * tileSize, midBottom.y - localY * tileSize);
      cCtx.lineTo(midLeft.x - localX * tileSize, midLeft.y - localY * tileSize);
      cCtx.closePath();
      cCtx.stroke();
    }
  }

  // ==============================
  // Vector-aware Chunk Generator
  // ==============================
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

    // Reset vertex cache for this chunk so vertices are consistent inside chunk and shared across cells
    // We keep a global vertex cache in state to share across chunk renders in one frame, but clear per-chunk here
    // to limit memory growth (caller may clear globally on zoom).
    // For smoother seams across chunks, you could omit this clear; for now we reuse state.vertexCache across chunks.
    // state.vertexCache = new Map();

    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;
    const tileSize = state.tileSize;

    // Render vector cells in CONNECTION_SPAN blocks
    for (let y = 0; y < CHUNK_SIZE; y += CONNECTION_SPAN) {
      for (let x = 0; x < CHUNK_SIZE; x += CONNECTION_SPAN) {
        const worldX = startX + x;
        const worldY = startY + y;

        // Skip invisible or out-of-world checks are optional; game world may be infinite.
        renderVectorCell(cCtx, worldX, worldY, x, y);
      }
    }

    // Optionally overlay rivers/roads as small markers for clarity
    if (state.showRoads) {
      for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const worldX = startX + x;
          const worldY = startY + y;
          const tile = game.getTile(worldX, worldY);
          if (tile === game.CONSTANTS.TILE_RIVER_DEEP || tile === game.CONSTANTS.TILE_RIVER_SHALLOW) {
            cCtx.fillStyle = 'rgba(255,255,255,0.06)';
            cCtx.fillRect(x * tileSize + tileSize * 0.2, y * tileSize + tileSize * 0.2, tileSize * 0.6, tileSize * 0.6);
          }
        }
      }
    }

    chunkCache.set(key, { canvas: cCanvas, lastUsed: performance.now() });
    return cCanvas;
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
    state.vertexCache = new Map();
  }

  return { start, stop, resize, renderFrame, clearCache };
}