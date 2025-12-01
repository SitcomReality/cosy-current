export function createRenderer({ canvas, state, game, noise }) {
  const ctx = canvas.getContext('2d', { alpha: false });

  // Color Definitions (R, G, B)
  const PALETTE = {
    DEEP_WATER: [15, 23, 42],   // #0f172a
    WATER:      [14, 165, 233], // #0ea5e9
    BANK:       [210, 180, 140], // #d2b48c - Tan/Sand
    GRASS:      [34, 197, 94],  // #22c55e
    FOREST:     [21, 128, 61],  // #15803d
    HILL:       [100, 116, 139], // #64748b
    SNOW:       [241, 245, 249]  // #f1f5f9
  };

  // Optimization: Chunk Caching
  // Instead of calculating noise for every pixel every frame, we render
  // blocks of tiles (chunks) to offscreen canvases and draw those.
  const CHUNK_SIZE = 16; // 16x16 tiles per chunk
  const chunkCache = new Map(); // key: "x,y", value: { canvas, lastUsed }

  // Rendering Fidelity
  // Samples per game tile. Higher = smoother, slower. 
  // 8 is a good balance for pixel-art-ish but smooth feel.
  const SAMPLES_PER_TILE = 8; 

  function resize() {
    const dpr = state.pixelRatio;
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = state.width * dpr;
    canvas.height = state.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Use bilinear smoothing for that painted look
    ctx.imageSmoothingEnabled = true;
    
    // Invalidate cache on resize if tile scaling depends on it (it doesn't currently, but safe practice)
    chunkCache.clear();
  }

  function lerp(a, b, t) {
    return a + (b - a) * Math.min(1, Math.max(0, t));
  }

  function lerpColor(c1, c2, t) {
    // simple RGB lerp
    const r = Math.round(lerp(c1[0], c2[0], t));
    const g = Math.round(lerp(c1[1], c2[1], t));
    const b = Math.round(lerp(c1[2], c2[2], t));
    return [r, g, b];
  }

  // Get color at specific world coordinates
  function getTerrainColor(wx, wy) {
    const river = noise.getRiverSystem(wx, wy);
    const h = game.getHeight(wx, wy);

    let c = [0,0,0];

    // River Logic
    if (river.value < 1.2) {
      if (river.value < 0.5) {
        // Center channel (deep)
        c = lerpColor(PALETTE.DEEP_WATER, PALETTE.WATER, river.value * 2.0);
      } else if (river.value < 1.0) {
        // Shallow
        c = lerpColor(PALETTE.WATER, PALETTE.BANK, (river.value - 0.5) * 2.0);
      } else {
        // Wet Bank
        c = lerpColor(PALETTE.BANK, PALETTE.GRASS, (river.value - 1.0) * 5.0);
      }
    } else {
      // Land Logic based on Height
      // Height is roughly 0..1, typically starting around 0.1 near rivers
      if (h < 0.3) {
        c = lerpColor(PALETTE.GRASS, PALETTE.FOREST, (h - 0.1) * 5.0);
      } else if (h < 0.6) {
        c = lerpColor(PALETTE.FOREST, PALETTE.HILL, (h - 0.3) * 3.33);
      } else if (h < 0.85) {
        c = lerpColor(PALETTE.HILL, PALETTE.SNOW, (h - 0.6) * 4.0);
      } else {
        c = PALETTE.SNOW;
      }
    }
    
    // Apply a simple noise overlay for texture
    const noiseVal = noise.sample2D(wx * 20, wy * 20); // High frequency
    const tint = 10 * noiseVal;
    return [
      Math.max(0, Math.min(255, c[0] + tint)),
      Math.max(0, Math.min(255, c[1] + tint)),
      Math.max(0, Math.min(255, c[2] + tint))
    ];
  }

  function getChunk(cx, cy) {
    const key = `${cx},${cy}`;
    if (chunkCache.has(key)) {
      const data = chunkCache.get(key);
      data.lastUsed = performance.now();
      return data.canvas;
    }

    // Generate Chunk Texture
    // We create a small texture (SAMPLES_PER_TILE pixels per world tile)
    // and let the canvas upscaling smooth it out.
    const texSize = CHUNK_SIZE * SAMPLES_PER_TILE;
    const texCanvas = document.createElement('canvas');
    texCanvas.width = texSize;
    texCanvas.height = texSize;
    const texCtx = texCanvas.getContext('2d', { alpha: false });
    const imgData = texCtx.createImageData(texSize, texSize);
    const data = imgData.data;

    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;

    // Fill pixels
    for (let y = 0; y < texSize; y++) {
      for (let x = 0; x < texSize; x++) {
        // Map pixel to world coordinate
        // + 0.5 to sample center of sub-pixel
        const wx = startX + (x + 0.5) / SAMPLES_PER_TILE;
        const wy = startY + (y + 0.5) / SAMPLES_PER_TILE;

        const [r, g, b] = getTerrainColor(wx, wy);

        const idx = (y * texSize + x) * 4;
        data[idx] = r;
        data[idx+1] = g;
        data[idx+2] = b;
        data[idx+3] = 255;
      }
    }

    texCtx.putImageData(imgData, 0, 0);

    // Now assume this small texture is the chunk.
    // We can draw it directly in renderFrame with scaling, 
    // OR scale it up here to a cached canvas of the correct display size.
    // Scaling here prevents blurriness changes during zoom if we want a fixed look,
    // but scaling in renderFrame is more efficient for memory if tileSize is huge.
    // Given the request for "smooth", let's cache the result at the current tileSize
    // so we don't rely on browser upscaling of a tiny texture every frame which might
    // look too blurry or pixelated depending on the browser's smoothing algorithm.
    // ACTUALLY: The request is to conceal the grid. A high-quality upscale here is best.
    
    // Create final cached canvas
    // We make it slightly larger (1px border) or just standard? 
    // Standard is fine, we rely on the texture being smooth.
    const finalSize = CHUNK_SIZE * state.tileSize;
    const cCanvas = document.createElement('canvas');
    cCanvas.width = finalSize;
    cCanvas.height = finalSize;
    const cCtx = cCanvas.getContext('2d');
    
    cCtx.imageSmoothingEnabled = true;
    cCtx.imageSmoothingQuality = 'high';
    cCtx.drawImage(texCanvas, 0, 0, finalSize, finalSize);

    // Optional: Draw Grid lines? No, we want to conceal grid.

    chunkCache.set(key, { canvas: cCanvas, lastUsed: performance.now() });
    return cCanvas;
  }

  function renderFrame(timestamp) {
    // 1. Draw Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, state.width, state.height);

    if (!state.isPlaying) {
      drawMenuBackground(timestamp);
      return;
    }

    const tileSize = state.tileSize;
    const centerX = state.width / 2;
    const centerY = state.height / 2;
    
    // Ensure smoothing is on for the main canvas to blend chunks
    ctx.imageSmoothingEnabled = true;

    // Calculate Viewport
    const visibleWidth = state.width;
    const visibleHeight = state.height;
    
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
        
        const chunkWorldX = cx * CHUNK_SIZE;
        const chunkWorldY = cy * CHUNK_SIZE;
        
        const screenX = (chunkWorldX - state.camera.x) * tileSize + centerX;
        const screenY = (chunkWorldY - state.camera.y) * tileSize + centerY;

        // Use Math.round to position chunks to prevent sub-pixel gaps 
        // that let the background bleed through
        const w = Math.ceil(CHUNK_SIZE * tileSize);
        ctx.drawImage(chunkImg, Math.floor(screenX), Math.floor(screenY), w, w);
      }
    }
    
    // Prune Cache
    if (Math.random() < 0.02) {
      const now = performance.now();
      for (const [key, val] of chunkCache) {
        if (now - val.lastUsed > 3000) {
          chunkCache.delete(key);
        }
      }
    }

    // 2. Render Entities
    state.entities.forEach(ent => {
       const screenX = (ent.x - state.camera.x) * tileSize + centerX;
       const screenY = (ent.y - state.camera.y) * tileSize + centerY;
       
       if (screenX < -tileSize*2 || screenX > state.width + tileSize*2 || 
           screenY < -tileSize*2 || screenY > state.height + tileSize*2) return;

       if (ent.type === game.CONSTANTS.ENTITY_CITY) {
         // City
         const r = tileSize * 0.8;
         ctx.fillStyle = '#10b981';
         ctx.shadowColor = '#10b981';
         ctx.shadowBlur = 20;
         ctx.beginPath();
         ctx.arc(screenX, screenY, r, 0, Math.PI*2);
         ctx.fill();
         ctx.shadowBlur = 0;
         
         // Icon
         ctx.fillStyle = '#064e3b';
         ctx.fillRect(screenX - r/2, screenY - r/2, r, r);
       } else if (ent.type === game.CONSTANTS.ENTITY_RELIC) {
         // Relic
         const r = tileSize * 0.6;
         ctx.fillStyle = '#f59e0b';
         ctx.shadowColor = '#f59e0b';
         ctx.shadowBlur = 15;
         ctx.beginPath();
         ctx.arc(screenX, screenY, r, 0, Math.PI*2);
         ctx.fill();
         ctx.shadowBlur = 0;
         
         ctx.fillStyle = '#78350f';
         ctx.beginPath();
         ctx.moveTo(screenX, screenY - r/2);
         ctx.lineTo(screenX + r/2, screenY + r/2);
         ctx.lineTo(screenX - r/2, screenY + r/2);
         ctx.fill();
       }
    });

    // 3. Render Player (Houseboat)
    const p = state.player;
    const px = (p.x - state.camera.x) * tileSize + centerX;
    const py = (p.y - state.camera.y) * tileSize + centerY;
    
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.angle);
    
    // Boat Dimensions
    const boatLen = tileSize * 1.2;
    const boatWid = tileSize * 0.6;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(4, 4, boatLen/2, boatWid/2, 0, 0, Math.PI*2);
    ctx.fill();

    // Hull
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.ellipse(0, 0, boatLen/2, boatWid/2, 0, 0, Math.PI*2);
    ctx.fill();

    // Deck/Cabin
    ctx.fillStyle = '#475569';
    ctx.fillRect(-boatLen/4, -boatWid/4, boatLen/2, boatWid/2);
    
    // Light
    ctx.fillStyle = '#fef08a';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(boatLen/2, 0, boatWid/3, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    ctx.restore();
  }

  function drawMenuBackground(t) {
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

  function clearCache() {
    chunkCache.clear();
  }

  return { start, stop, resize, renderFrame, clearCache };
}