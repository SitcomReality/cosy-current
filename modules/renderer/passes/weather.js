export function renderWeatherPass(ctx, state, cycle) {
  const { precipIntensity } = state.weather;
  const wind = state.weather.wind || { x: 0, y: 0, strength: 0, angle: 0 };
  
  // If mostly dry, skip drawing
  if (precipIntensity <= 0.05) return;

  const width = state.width;
  const height = state.height;

  // Initialize renderer state cache if missing
  if (!state.weather._renderState) {
    state.weather._renderState = {
      drops: [],
      splashes: [],
      lastTime: performance.now(),
      lastCamX: state.camera.x,
      lastCamY: state.camera.y
    };
    
    // Pre-populate drops pool
    const MAX_DROPS = 400;
    for (let i = 0; i < MAX_DROPS; i++) {
      state.weather._renderState.drops.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 800 + Math.random() * 400,
        len: 25 + Math.random() * 20,
        z: 0.5 + Math.random() * 0.5 // Depth factor for parallax
      });
    }
  }

  const rs = state.weather._renderState;
  const now = performance.now();
  const dt = Math.min((now - rs.lastTime) / 1000, 0.1);
  rs.lastTime = now;

  // Calculate camera movement in pixels to apply relative movement to weather particles
  const dxCam = (state.camera.x - rs.lastCamX) * state.tileSize;
  const dyCam = (state.camera.y - rs.lastCamY) * state.tileSize;
  rs.lastCamX = state.camera.x;
  rs.lastCamY = state.camera.y;

  // 1. Update & Draw Rain Drops (Foreground)
  const activeDrops = Math.floor(rs.drops.length * precipIntensity);
  
  const maxWindSpeed = 400;
  const windX = wind.x * maxWindSpeed;
  const windY = wind.y * maxWindSpeed * 0.35;
  const slantX = wind.x * 40;
  const slantY = wind.y * 12;

  ctx.lineWidth = 2;
  ctx.beginPath();
  
  const baseAlpha = 0.3 + precipIntensity * 0.4;
  
  for (let i = 0; i < activeDrops; i++) {
    const d = rs.drops[i];
    
    // Horizontal wind and vertical fall speed. The y component of the wind
    // changes the apparent fall speed (toward/away from the camera) rather than
    // tilting the streak sideways.
    d.x += windX * dt;
    d.y += (d.speed + windY) * dt;

    // Apply camera parallax: closer drops (higher z) "slip" less, 
    // simulating their presence in world space volume.
    d.x -= dxCam * (d.z || 0.5);
    d.y -= dyCam * (d.z || 0.5);
    
    // Wrap particles to maintain coverage
    if (d.y > height) {
      d.y = -d.len;
      d.x = Math.random() * width;
    }
    if (d.y < -d.len) d.y = height;
    if (d.x > width) d.x -= width;
    if (d.x < 0) d.x += width;
    
    // Draw rigid straight line
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - slantX, d.y - d.len - slantY);
  }
  
  ctx.strokeStyle = `rgba(200, 230, 255, ${baseAlpha})`;
  ctx.stroke();

  // 2. Update & Draw Splashes (Surface Interaction)
  // Rigid geometric squares/diamonds expanding
  
  const spawnRate = precipIntensity * 20; 
  const spawnCount = Math.floor(spawnRate + Math.random());
  
  const tileSize = state.tileSize;
  const centerX = width / 2;
  const centerY = height / 2;

  for (let i = 0; i < spawnCount; i++) {
    // Generate initial position in screen space for distribution
    const sx = Math.random() * width;
    const sy = Math.random() * height;
    
    // Convert to world coordinates immediately so splashes stick to the ground
    const wx = (sx - centerX) / tileSize + state.camera.x;
    const wy = (sy - centerY) / tileSize + state.camera.y;

    rs.splashes.push({
      wx, wy,
      life: 0.3, 
      maxLife: 0.3,
      size: 10 + Math.random() * 15
    });
  }
  
  // Render Splashes
  ctx.fillStyle = `rgba(220, 245, 255, 0.6)`;
  for (let i = rs.splashes.length - 1; i >= 0; i--) {
    const s = rs.splashes[i];
    s.life -= dt;
    
    if (s.life <= 0) {
      rs.splashes.splice(i, 1);
      continue;
    }

    // Convert world position back to current screen position
    const sx = (s.wx - state.camera.x) * tileSize + centerX;
    const sy = (s.wy - state.camera.y) * tileSize + centerY;

    // Fast cull if splash moved too far off-screen
    if (sx < -100 || sx > width + 100 || sy < -100 || sy > height + 100) {
       continue; 
    }
    
    // Animate: expand and fade
    const progress = 1 - (s.life / s.maxLife);
    const currentSize = s.size * (0.5 + 0.5 * progress);
    const alpha = s.life / s.maxLife;
    
    ctx.save();
    ctx.translate(sx, sy);
    ctx.globalAlpha = alpha * baseAlpha;
    // Rotate 45deg for diamond shape - "rigid geometric"
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-currentSize / 2, -currentSize / 2, currentSize, currentSize);
    ctx.restore();
  }
  
  // Limit splash count safety
  if (rs.splashes.length > 200) {
    rs.splashes.splice(0, rs.splashes.length - 200);
  }
}

