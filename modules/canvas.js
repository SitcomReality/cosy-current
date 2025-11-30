export function createRenderer({ canvas, state, game }) {
  const ctx = canvas.getContext('2d', { alpha: false });

  // Technopunk Fantasy Palette -> more natural, readable terrain
  const COLORS = {
    [game.CONSTANTS.TILE_DEEP_WATER]: '#0f172a', // Deep ocean
    [game.CONSTANTS.TILE_WATER]: '#0ea5e9',      // Coastal water
    [game.CONSTANTS.TILE_SAND]: '#fdba74',       // Sand / shore
    [game.CONSTANTS.TILE_GRASS]: '#22c55e',      // Grasslands
    [game.CONSTANTS.TILE_FOREST]: '#15803d',     // Forest
    [game.CONSTANTS.TILE_ROCK]: '#64748b',       // Rock / highland
    [game.CONSTANTS.TILE_SNOW]: '#f8fafc',       // Snow peaks
    [game.CONSTANTS.TILE_ROAD]: '#334155'        // Road (Dark Slate)
  };

  function resize() {
    const dpr = state.pixelRatio;
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = state.width * dpr;
    canvas.height = state.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function renderFrame(timestamp) {
    // Clear background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, state.width, state.height);

    if (!state.isPlaying) {
      drawMenuBackground(timestamp);
      return;
    }

    const tileSize = state.tileSize;
    // Overdraw slightly to ensure no gaps and smoother look
    const drawSize = tileSize + 1; 
    
    const centerX = state.width / 2;
    const centerY = state.height / 2;
    
    // Calculate View
    const colsVisible = Math.ceil(state.width / tileSize) + 4;
    const rowsVisible = Math.ceil(state.height / tileSize) + 4;
    const startCol = Math.floor(state.camera.x - colsVisible/2);
    const endCol = Math.floor(state.camera.x + colsVisible/2);
    const startRow = Math.floor(state.camera.y - rowsVisible/2);
    const endRow = Math.floor(state.camera.y + rowsVisible/2);

    // 1. Render Terrain
    // We use circles for terrain to break the blocky grid look
    for (let y = startRow; y <= endRow; y++) {
      for (let x = startCol; x <= endCol; x++) {
        // Basic Tile
        const tileType = game.getTile(x, y);
        const screenX = Math.floor((x - state.camera.x) * tileSize + centerX);
        const screenY = Math.floor((y - state.camera.y) * tileSize + centerY);
        
        ctx.fillStyle = COLORS[tileType] || '#f0f';
        
        if (tileType === game.CONSTANTS.TILE_ROAD) {
           // Draw Road as connected blocks
           // Roads are flat, no shading
           ctx.fillRect(screenX, screenY, drawSize, drawSize);
           
           // Add lane markings? 
           // Too detailed for this scale probably, but let's try a subtle dot
           // ctx.fillStyle = '#475569';
           // ctx.fillRect(screenX + tileSize/2 - 1, screenY + tileSize/2 - 1, 2, 2);
        } else {
           // Draw Terrain as overlapping circles for organic look
           const h = game.getHeight(x, y);
           
           // Shading
           const shade = (h - 0.5) * 0.5; // -0.25 to 0.25
           // Apply shade to base color (simple opacity overlay)
           
           ctx.beginPath();
           // Draw slightly larger circle to blend
           ctx.arc(screenX + tileSize/2, screenY + tileSize/2, tileSize * 0.7, 0, Math.PI*2);
           ctx.fill();
           
           // Fill gaps with rect behind?
           // Performance-wise, drawing rect AND circle is heavy.
           // Let's just draw rects but with color variation? 
           // User explicitly asked for "smoother". 
           // Let's just use the Rect but with very slight random offset? No.
           // Let's stick to the rects but rely on the noise scale being smoother now.
           // The "Blocky" complaint was likely due to 32px tiles and high freq noise.
           // Now we have 12px tiles and low freq noise. It will look like pixel art map.
           
           ctx.fillRect(screenX, screenY, drawSize, drawSize);
           
           // Shadow layer
           if (shade > 0) {
             ctx.fillStyle = `rgba(255,255,255,${shade})`;
             ctx.fillRect(screenX, screenY, drawSize, drawSize);
           } else {
             ctx.fillStyle = `rgba(0,0,0,${-shade})`;
             ctx.fillRect(screenX, screenY, drawSize, drawSize);
           }
        }
      }
    }

    // 2. Render Entities (Towns, Relics)
    state.entities.forEach(ent => {
       const screenX = (ent.x - state.camera.x) * tileSize + centerX;
       const screenY = (ent.y - state.camera.y) * tileSize + centerY;
       
       if (screenX < -tileSize || screenX > state.width || screenY < -tileSize || screenY > state.height) return;

       if (ent.type === game.CONSTANTS.ENTITY_CITY) {
         // Neon Castle
         ctx.fillStyle = 'rgba(16, 185, 129, 0.2)'; // Glow
         ctx.beginPath();
         ctx.arc(screenX + tileSize/2, screenY + tileSize/2, tileSize * 2, 0, Math.PI*2);
         ctx.fill();

         ctx.fillStyle = '#10b981';
         ctx.fillRect(screenX, screenY, tileSize, tileSize);
         ctx.fillStyle = '#065f46';
         ctx.fillRect(screenX + tileSize/2 - 2, screenY + tileSize/4 - 10, 4, 10); // Tower
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
    
    const carScale = 1.5; // Car is larger than a single tile now
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-tileSize*carScale/2 + 2, -tileSize*carScale/4 + 2, tileSize*carScale, tileSize*carScale/2);

    // Body
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-tileSize*carScale/2, -tileSize*carScale/4, tileSize*carScale, tileSize*carScale/2);
    
    // Engine Glow
    ctx.fillStyle = '#0ea5e9';
    ctx.shadowColor = '#0ea5e9';
    ctx.shadowBlur = 10;
    ctx.fillRect(-tileSize/2 - 4, -tileSize/4 + 2, 4, tileSize/2 - 4);
    
    // Headlights
    ctx.fillStyle = '#fef08a';
    ctx.shadowColor = '#fef08a';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(tileSize/2, -5);
    ctx.lineTo(tileSize + 20, -15);
    ctx.lineTo(tileSize + 20, 15);
    ctx.lineTo(tileSize/2, 5);
    ctx.fill();

    ctx.restore();
  }

  function drawMenuBackground(t) {
    const scale = 200;
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#0f172a';
    const offset = t * 0.02;
    for(let i=0; i<5; i++) {
      ctx.beginPath();
      ctx.arc(
        (Math.sin(offset + i) * 0.5 + 0.5) * state.width,
        (Math.cos(offset * 0.7 + i) * 0.5 + 0.5) * state.height,
        100 + i * 50, 0, Math.PI*2
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  function start() {
    resize();
    window.addEventListener('resize', resize);
  }

  function stop() {
    window.removeEventListener('resize', resize);
  }

  return { start, stop, resize, renderFrame };
}