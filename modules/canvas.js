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

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = startX + x;
        const worldY = startY + y;
        
        const tileType = game.getTile(worldX, worldY);
        const baseX = x * tileSize;
        const baseY = y * tileSize;

        const baseColor = COLORS[tileType] || '#f0f';

        // Get height for shading
        const h = game.getHeight(worldX, worldY);
        const shade = (h - 0.5) * 0.4; // -0.2 to 0.2

        // Apply shading to base color
        let fillColor = baseColor;
        if (shade > 0) {
          const r = parseInt(baseColor.slice(1, 3), 16);
          const g = parseInt(baseColor.slice(3, 5), 16);
          const b = parseInt(baseColor.slice(5, 7), 16);
          const nr = Math.min(255, r + shade * 255);
          const ng = Math.min(255, g + shade * 255);
          const nb = Math.min(255, b + shade * 255);
          fillColor = `rgb(${nr}, ${ng}, ${nb})`;
        } else if (shade < 0) {
          const r = parseInt(baseColor.slice(1, 3), 16);
          const g = parseInt(baseColor.slice(3, 5), 16);
          const b = parseInt(baseColor.slice(5, 7), 16);
          const nr = Math.max(0, r + shade * 255);
          const ng = Math.max(0, g + shade * 255);
          const nb = Math.max(0, b + shade * 255);
          fillColor = `rgb(${nr}, ${ng}, ${nb})`;
        }

        // Define corner vertices with slight perturbation for organic feel
        const perturbScale = tileSize * 0.15;
        const tl = {
          x: baseX + getVertexOffset(worldX, worldY, 0) * perturbScale,
          y: baseY + getVertexOffset(worldX, worldY, 1) * perturbScale
        };
        const tr = {
          x: baseX + tileSize - getVertexOffset(worldX + 1, worldY, 0) * perturbScale,
          y: baseY + getVertexOffset(worldX + 1, worldY, 1) * perturbScale
        };
        const bl = {
          x: baseX + getVertexOffset(worldX, worldY + 1, 0) * perturbScale,
          y: baseY + tileSize - getVertexOffset(worldX, worldY + 1, 1) * perturbScale
        };
        const br = {
          x: baseX + tileSize - getVertexOffset(worldX + 1, worldY + 1, 0) * perturbScale,
          y: baseY + tileSize - getVertexOffset(worldX + 1, worldY + 1, 1) * perturbScale
        };

        // Split tile into two triangles along diagonal
        const diag = getDiagonalDir(worldX, worldY);
        
        cCtx.fillStyle = fillColor;

        if (diag === 'tl-br') {
          // Triangle 1: top-left, top-right, bottom-right
          cCtx.beginPath();
          cCtx.moveTo(tl.x, tl.y);
          cCtx.lineTo(tr.x, tr.y);
          cCtx.lineTo(br.x, br.y);
          cCtx.closePath();
          cCtx.fill();

          // Triangle 2: top-left, bottom-right, bottom-left
          cCtx.beginPath();
          cCtx.moveTo(tl.x, tl.y);
          cCtx.lineTo(br.x, br.y);
          cCtx.lineTo(bl.x, bl.y);
          cCtx.closePath();
          cCtx.fill();
        } else {
          // Triangle 1: top-left, top-right, bottom-left
          cCtx.beginPath();
          cCtx.moveTo(tl.x, tl.y);
          cCtx.lineTo(tr.x, tr.y);
          cCtx.lineTo(bl.x, bl.y);
          cCtx.closePath();
          cCtx.fill();

          // Triangle 2: top-right, bottom-right, bottom-left
          cCtx.beginPath();
          cCtx.moveTo(tr.x, tr.y);
          cCtx.lineTo(br.x, br.y);
          cCtx.lineTo(bl.x, bl.y);
          cCtx.closePath();
          cCtx.fill();
        }

        // Optional: Draw subtle edge lines for definition
        if (tileSize > 48) {
          cCtx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
          cCtx.lineWidth = 0.5;
          cCtx.beginPath();
          cCtx.moveTo(tl.x, tl.y);
          cCtx.lineTo(tr.x, tr.y);
          cCtx.lineTo(br.x, br.y);
          cCtx.lineTo(bl.x, bl.y);
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