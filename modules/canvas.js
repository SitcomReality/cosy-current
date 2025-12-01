export function createRenderer({ canvas, state, game }) {
  const ctx = canvas.getContext('2d', { alpha: false });

  // Technopunk Fantasy Palette -> more natural, readable terrain
  const COLORS = {
    // Map renderer colors to the current tile set used by game.js
    [game.CONSTANTS.TILE_RIVER_DEEP]: '#0f172a', // Deep river/ocean
    [game.CONSTANTS.TILE_RIVER_SHALLOW]: '#0ea5e9', // Shallow river
    [game.CONSTANTS.TILE_BANK]: '#fdba74',       // Bank / shore
    [game.CONSTANTS.TILE_GRASS]: '#22c55e',      // Grasslands
    [game.CONSTANTS.TILE_FOREST]: '#15803d',     // Forest
    [game.CONSTANTS.TILE_HILL]: '#64748b',       // Hill / highland
    [game.CONSTANTS.TILE_MOUNTAIN]: '#94a3b8'    // Mountain (formerly rock/snow)
  };

  // Optimization: Chunk Caching
  // Instead of calculating noise for every pixel every frame, we render
  // blocks of tiles (chunks) to offscreen canvases and draw those.
  const CHUNK_SIZE = 16; // 16x16 tiles per chunk
  const chunkCache = new Map(); // key: "x,y", value: { canvas, lastUsed }

  function resize() {
    const dpr = state.pixelRatio;
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = state.width * dpr;
    canvas.height = state.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    
    // Invalidate cache on resize if tile scaling depends on it (it doesn't currently, but safe practice)
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
    // slightly larger to prevent bleeding lines
    const drawSize = tileSize + 1;

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = startX + x;
        const worldY = startY + y;
        
        const tileType = game.getTile(worldX, worldY);
        const drawX = x * tileSize;
        const drawY = y * tileSize;

        cCtx.fillStyle = COLORS[tileType] || '#f0f';

        if (tileType === game.CONSTANTS.TILE_ROAD) {
          cCtx.fillRect(drawX, drawY, drawSize, drawSize);
        } else {
          // Terrain Detail
          const h = game.getHeight(worldX, worldY);
          const shade = (h - 0.5) * 0.5; // -0.25 to 0.25

          // Base
          cCtx.fillRect(drawX, drawY, drawSize, drawSize);

          // Simple flat shading overlay
          if (shade > 0) {
             cCtx.fillStyle = `rgba(255,255,255,${shade})`;
             cCtx.fillRect(drawX, drawY, drawSize, drawSize);
          } else {
             cCtx.fillStyle = `rgba(0,0,0,${-shade})`;
             cCtx.fillRect(drawX, drawY, drawSize, drawSize);
          }
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
    
    // Prune Cache (every ~60 frames)
    if (Math.random() < 0.02) {
      const now = performance.now();
      for (const [key, val] of chunkCache) {
        if (now - val.lastUsed > 2000) { // 2 seconds unused
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