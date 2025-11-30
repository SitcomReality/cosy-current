export function createRenderer({ canvas, state, game }) {
  const ctx = canvas.getContext('2d', { alpha: false });

  // Modern Color Palette
  const COLORS = {
    [game.CONSTANTS.TILE_WATER]: '#0f172a', // Dark deep blue
    [game.CONSTANTS.TILE_SAND]: '#9ca3af',  // Grey-ish sand (moon-like)
    [game.CONSTANTS.TILE_GRASS]: '#1f2937', // Dark grey-blue terrain
    [game.CONSTANTS.TILE_FOREST]: '#111827', // Darker forest patches
    [game.CONSTANTS.TILE_MOUNTAIN]: '#374151' // Lighter grey mountains
  };
  
  // Highlight colors for variety
  const HIGHLIGHTS = {
    [game.CONSTANTS.TILE_WATER]: '#1e293b',
    [game.CONSTANTS.TILE_GRASS]: '#374151'
  };

  function resize() {
    const dpr = state.pixelRatio;
    // Resize to window
    state.width = window.innerWidth;
    state.height = window.innerHeight;

    canvas.width = state.width * dpr;
    canvas.height = state.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    // We want crisp edges for tiles
    ctx.imageSmoothingEnabled = false;
  }

  function renderFrame(timestamp) {
    // Clear
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, state.width, state.height);

    if (!state.isPlaying) {
      // Draw a slow subtle background effect when in menu
      drawMenuBackground(timestamp);
      return;
    }

    const tileSize = state.tileSize;
    const centerX = state.width / 2;
    const centerY = state.height / 2;
    
    // Determine visible range
    // We add a buffer of 2 tiles to ensure no flickering at edges
    const colsVisible = Math.ceil(state.width / tileSize) + 2;
    const rowsVisible = Math.ceil(state.height / tileSize) + 2;
    
    const startCol = Math.floor(state.camera.x - colsVisible/2);
    const endCol = Math.floor(state.camera.x + colsVisible/2);
    const startRow = Math.floor(state.camera.y - rowsVisible/2);
    const endRow = Math.floor(state.camera.y + rowsVisible/2);

    // Render Tiles
    for (let y = startRow; y <= endRow; y++) {
      for (let x = startCol; x <= endCol; x++) {
        const tileType = game.getTile(x, y);
        
        // Screen coords
        const screenX = Math.floor((x - state.camera.x) * tileSize + centerX);
        const screenY = Math.floor((y - state.camera.y) * tileSize + centerY);
        
        // Base tile
        ctx.fillStyle = COLORS[tileType] || '#f0f';
        ctx.fillRect(screenX, screenY, tileSize + 1, tileSize + 1); // +1 to fix subpixel gaps

        // Simple texture detail (grid lines or highlights)
        // ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        // ctx.strokeRect(screenX, screenY, tileSize, tileSize);
      }
    }

    // Render Entities
    state.entities.forEach(ent => {
       const screenX = (ent.x - state.camera.x) * tileSize + centerX;
       const screenY = (ent.y - state.camera.y) * tileSize + centerY;
       
       // Cull entities off screen
       if (screenX < -tileSize || screenX > state.width || screenY < -tileSize || screenY > state.height) return;

       if (ent.type === game.CONSTANTS.ENTITY_NPC) {
         // Glow
         const g = ctx.createRadialGradient(screenX + tileSize/2, screenY + tileSize/2, 0, screenX + tileSize/2, screenY + tileSize/2, tileSize);
         g.addColorStop(0, 'rgba(79, 172, 254, 0.8)');
         g.addColorStop(1, 'rgba(79, 172, 254, 0)');
         ctx.fillStyle = g;
         ctx.fillRect(screenX - tileSize/2, screenY - tileSize/2, tileSize*2, tileSize*2);

         ctx.fillStyle = '#fff';
         ctx.beginPath();
         ctx.arc(screenX + tileSize/2, screenY + tileSize/2, tileSize/4, 0, Math.PI * 2);
         ctx.fill();
       } else if (ent.type === game.CONSTANTS.ENTITY_CITY) {
         ctx.fillStyle = '#238636';
         ctx.beginPath();
         // Hexagonish shape
         const cx = screenX + tileSize/2;
         const cy = screenY + tileSize/2;
         const r = tileSize/2.5;
         for (let i = 0; i < 6; i++) {
           ctx.lineTo(cx + r * Math.cos(i * Math.PI / 3), cy + r * Math.sin(i * Math.PI / 3));
         }
         ctx.fill();
       }
    });
  }

  function drawMenuBackground(t) {
    // Simple animated noise pattern
    const scale = 200;
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#238636';
    const offset = t * 0.02;
    // Just draw a few moving shapes
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