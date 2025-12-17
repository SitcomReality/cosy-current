export function renderWeatherPass(ctx, state, cycle) {
  const { precipIntensity, wind } = state.weather;
  
  // If mostly dry, skip drawing
  if (precipIntensity <= 0.05) return;

  const width = state.width;
  const height = state.height;

  // Initialize renderer state cache if missing
  if (!state.weather._renderState) {
    state.weather._renderState = {
      drops: [],
      splashes: [],
      lastTime: performance.now()
    };
    
    // Pre-populate drops pool
    const MAX_DROPS = 400;
    for (let i = 0; i < MAX_DROPS; i++) {
      state.weather._renderState.drops.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 800 + Math.random() * 400,
        len: 25 + Math.random() * 20,
        z: Math.random() // Depth factor for parallax/opacity
      });
    }
  }

  const rs = state.weather._renderState;
  const now = performance.now();
  const dt = Math.min((now - rs.lastTime) / 1000, 0.1);
  rs.lastTime = now;

  // 1. Update & Draw Rain Drops (Foreground)
  const activeDrops = Math.floor(rs.drops.length * precipIntensity);
  
  // Calculate wind offset for the frame
  // Wind -1..1 maps to -X..+X pixels per second horizontal speed
  const maxWindSpeed = 400;
  const windX = wind * maxWindSpeed;
  
  // Slant angle for drawing
  // If wind is 0, slant is 0. If wind is 1, slant is significant.
  const slantX = wind * 40; 

  ctx.lineWidth = 2;
  ctx.beginPath();
  
  // Use a rain color that fits the low-poly palette (light blue-ish)
  // Opacity scales with intensity and individual drop depth
  const baseAlpha = 0.3 + precipIntensity * 0.4;
  
  for (let i = 0; i < activeDrops; i++) {
    const d = rs.drops[i];
    
    // Move
    d.x += windX * dt;
    d.y += d.speed * dt;
    
    // Wrap
    if (d.y > height) {
      d.y = -d.len;
      d.x = Math.random() * width;
    }
    if (d.x > width) d.x -= width;
    if (d.x < 0) d.x += width;
    
    // Draw rigid straight line
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - slantX, d.y - d.len);
  }
  
  ctx.strokeStyle = `rgba(200, 230, 255, ${baseAlpha})`;
  ctx.stroke();

  // 2. Update & Draw Splashes (Surface Interaction)
  // Rigid geometric squares/diamonds expanding
  
  // Spawn new splashes based on intensity
  // Chance per frame
  const spawnRate = precipIntensity * 20; // splashes per frame approx
  const spawnCount = Math.floor(spawnRate + Math.random());
  
  for (let i = 0; i < spawnCount; i++) {
    rs.splashes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      life: 0.3, // seconds
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
    
    // Animate: expand and fade
    const progress = 1 - (s.life / s.maxLife);
    const currentSize = s.size * (0.5 + 0.5 * progress);
    const alpha = s.life / s.maxLife;
    
    ctx.save();
    ctx.translate(s.x, s.y);
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

