export function createRenderer({ canvas, state, game }) {
  const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no transparency on bg

  // Colors
  const COLORS = {
    [game.CONSTANTS.TILE_WATER]: '#4287f5',
    [game.CONSTANTS.TILE_SAND]: '#e3d081',
    [game.CONSTANTS.TILE_GRASS]: '#56bf5c',
    [game.CONSTANTS.TILE_FOREST]: '#2d6e32',
    [game.CONSTANTS.TILE_MOUNTAIN]: '#8c8c8c'
  };

  function resize() {
    const dpr = state.pixelRatio;
    // Fill parent container
    const parent = canvas.parentElement;
    state.width = parent.clientWidth;
    state.height = parent.clientHeight;

    canvas.width = state.width * dpr;
    canvas.height = state.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    // Disable smoothing for pixel art look if desired, though we are using shapes
    ctx.imageSmoothingEnabled = false;
  }

  function renderFrame(timestamp) {
    // Delta time calculation could go here or in app loop
    
    // Clear background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, state.width, state.height);

    const tileSize = state.tileSize;
    
    // Calculate visible tiles based on camera
    // Camera x,y is the center of the screen in world coordinates (tiles)
    const centerX = state.width / 2;
    const centerY = state.height / 2;
    
    const startCol = Math.floor(state.camera.x - (centerX / tileSize)) - 1;
    const endCol = Math.floor(state.camera.x + (centerX / tileSize)) + 1;
    const startRow = Math.floor(state.camera.y - (centerY / tileSize)) - 1;
    const endRow = Math.floor(state.camera.y + (centerY / tileSize)) + 1;

    // Render Tiles
    for (let y = startRow; y <= endRow; y++) {
      for (let x = startCol; x <= endCol; x++) {
        const tileType = game.getTile(x, y);
        
        // Screen coordinates
        const screenX = Math.floor((x - state.camera.x) * tileSize + centerX);
        const screenY = Math.floor((y - state.camera.y) * tileSize + centerY);
        
        ctx.fillStyle = COLORS[tileType] || '#f0f';
        // Add a little gap for grid effect if desired, or fill completely
        ctx.fillRect(screenX, screenY, tileSize + 1, tileSize + 1);
      }
    }

    // Render Entities
    state.entities.forEach(ent => {
       const screenX = (ent.x - state.camera.x) * tileSize + centerX;
       const screenY = (ent.y - state.camera.y) * tileSize + centerY;
       
       if (ent.type === game.CONSTANTS.ENTITY_NPC) {
         ctx.fillStyle = '#ff0000';
         ctx.beginPath();
         ctx.arc(screenX + tileSize/2, screenY + tileSize/2, tileSize/3, 0, Math.PI * 2);
         ctx.fill();
       } else if (ent.type === game.CONSTANTS.ENTITY_CITY) {
         ctx.fillStyle = '#ffffff';
         ctx.fillRect(screenX + 4, screenY + 4, tileSize - 8, tileSize - 8);
       }
    });
    
    // Center crosshair (optional)
    /*
    ctx.strokeStyle = '#fff5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - 10, centerY);
    ctx.lineTo(centerX + 10, centerY);
    ctx.moveTo(centerX, centerY - 10);
    ctx.lineTo(centerX, centerY + 10);
    ctx.stroke();
    */

    // state.animationId = requestAnimationFrame(renderFrame); // Loop handled by app.js now
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