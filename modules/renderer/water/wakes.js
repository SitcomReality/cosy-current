export function createWakeSystem(game) {
  const wakeSegments = [];
  const WAKE_SEGMENT_LIFE = 3; 
  const MIN_LINE_LENGTH = 1;

  // Constants
  const WAKE_SPAWN_INTERVAL = 0.2;
  let nextWakeInterval = WAKE_SPAWN_INTERVAL;
  let wakeTimer = 0;

  function spawnWake(x, y, angle, speed) {
    if (speed < 0.5) return; 

    // Only spawn wakes when actually over river water
    const tile = game.getTile(Math.floor(x), Math.floor(y));
    const isWater = tile === game.CONSTANTS.TILE_WATER;
    if (!isWater) return;

    const intensity = Math.min(1, speed / 5);
    const baseSpread = 3.2;

    // Create V-shaped wake pattern
    for (let side of [-1, 1]) {
      const wakeAngle = angle + Math.PI + side * (Math.PI / 6);
      const length = MIN_LINE_LENGTH * (1 + Math.random() * 2) * intensity;
      const width = 1 + intensity * 2;

      const offsetDist = baseSpread * 0.3;
      const perpX = Math.cos(angle + side * Math.PI / 2);
      const perpY = Math.sin(angle + side * Math.PI / 2);

      wakeSegments.push({
        centerX: x,
        centerY: y,
        perpX,
        perpY,
        baseOffset: offsetDist,
        angle: wakeAngle,
        length: length,
        width: width,
        life: WAKE_SEGMENT_LIFE,
        maxLife: WAKE_SEGMENT_LIFE,
        opacity: 0.6 * intensity
      });
    }

    // Center trail
    wakeSegments.push({
      centerX: x,
      centerY: y,
      perpX: 0,
      perpY: 0,
      baseOffset: 0,
      angle: angle + Math.PI,
      length: MIN_LINE_LENGTH * 0.5 * intensity,
      width: 1,
      life: WAKE_SEGMENT_LIFE * 0.7,
      maxLife: WAKE_SEGMENT_LIFE * 0.7,
      opacity: 0.4 * intensity
    });
  }

  function update(dt, player, isPlaying) {
    if (!isPlaying) return;

    // Timer logic
    wakeTimer += dt;
    if (wakeTimer >= nextWakeInterval) {
      wakeTimer = 0;
      spawnWake(player.x, player.y, player.angle, player.speed);
      nextWakeInterval = WAKE_SPAWN_INTERVAL * (0.8 + Math.random() * 0.4);
    }

    // Update segments
    wakeSegments.forEach(seg => seg.life -= dt);
    // Remove dead
    let i = wakeSegments.length;
    while (i--) {
      if (wakeSegments[i].life <= 0) wakeSegments.splice(i, 1);
    }
  }

  function render(ctx, camera, tileSize, state) {
    const centerX = state.width / 2;
    const centerY = state.height / 2;

    ctx.lineCap = 'round'; 

    wakeSegments.forEach(seg => {
      const t = seg.life / seg.maxLife;
      const fadeIn = Math.min(1, (seg.maxLife - seg.life) * 3);
      const fadeOut = Math.min(1, t * 2);
      const fade = Math.min(fadeIn, fadeOut);

      // Expand lateral offset
      const spreadFactor = 1 + (1 - t) * 2; 
      const lateralOffset = (seg.baseOffset || 0) * spreadFactor;

      const worldX = seg.centerX + (seg.perpX || 0) * lateralOffset;
      const worldY = seg.centerY + (seg.perpY || 0) * lateralOffset;

      const screenX = (worldX - camera.x) * tileSize + centerX;
      const screenY = (worldY - camera.y) * tileSize + centerY;

      if (screenX < -100 || screenX > state.width + 100 || 
          screenY < -100 || screenY > state.height + 100) return;

      const endX = screenX + Math.cos(seg.angle) * seg.length * tileSize;
      const endY = screenY + Math.sin(seg.angle) * seg.length * tileSize;

      ctx.strokeStyle = `rgba(255, 255, 255, ${seg.opacity * fade})`;
      ctx.lineWidth = seg.width;
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    });
  }

  return { update, render };
}