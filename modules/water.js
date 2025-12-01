// Water effects system: wakes, shoreline waves, ripples
// Low-poly 2D vector aesthetic using straight line segments

export function createWaterEffects({ state, game, noise }) {
  const wakeSegments = [];
  const shorelineWaves = [];

  const WAKE_SEGMENT_LIFE = 2.0; // seconds
  const WAKE_SPAWN_INTERVAL = 0.05; // spawn new segment every N seconds
  const MIN_LINE_LENGTH = state.tileSize * 0.25;

  let wakeTimer = 0;

  // Generate a wake segment from the player's current position
  function spawnWake(x, y, angle, speed) {
    if (speed < 0.5) return; // Don't generate wake when nearly stopped

    const intensity = Math.min(1, speed / 5);
    const baseSpread = state.tileSize * 0.8;

    // Create V-shaped wake pattern with straight line segments
    for (let side of [-1, 1]) {
      const wakeAngle = angle + side * (Math.PI / 6); // 30 degree spread
      const length = MIN_LINE_LENGTH * (1 + Math.random() * 2) * intensity;
      const width = 1 + intensity * 2;

      // Offset from center
      const offsetDist = baseSpread * 0.3;
      const ox = Math.cos(angle + side * Math.PI / 2) * offsetDist;
      const oy = Math.sin(angle + side * Math.PI / 2) * offsetDist;

      wakeSegments.push({
        x: x + ox,
        y: y + oy,
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
      x: x,
      y: y,
      angle: angle + Math.PI,
      length: MIN_LINE_LENGTH * 0.5 * intensity,
      width: 1,
      life: WAKE_SEGMENT_LIFE * 0.7,
      maxLife: WAKE_SEGMENT_LIFE * 0.7,
      opacity: 0.4 * intensity
    });
  }

  // Generate shoreline waves at banks
  function updateShorelineWaves(dt) {
    // Spawn new waves occasionally
    if (Math.random() < dt * 0.5) {
      const p = state.player;
      // Find nearby bank tiles
      const searchRadius = 20;
      for (let dy = -searchRadius; dy <= searchRadius; dy += 2) {
        for (let dx = -searchRadius; dx <= searchRadius; dx += 2) {
          const tx = Math.floor(p.x + dx);
          const ty = Math.floor(p.y + dy);

          const tile = game.getTile(tx, ty);
          if (tile === game.CONSTANTS.TILE_BANK) {
            // Check if adjacent to water
            const hasWater = [
              game.getTile(tx - 1, ty),
              game.getTile(tx + 1, ty),
              game.getTile(tx, ty - 1),
              game.getTile(tx, ty + 1)
            ].some(t => t === game.CONSTANTS.TILE_RIVER_DEEP || t === game.CONSTANTS.TILE_RIVER_SHALLOW);

            if (hasWater && Math.random() < 0.1) {
              // Spawn a wave segment
              const angle = Math.random() * Math.PI * 2;
              const length = MIN_LINE_LENGTH * (0.5 + Math.random() * 1.5);

              shorelineWaves.push({
                x: tx + Math.random(),
                y: ty + Math.random(),
                angle: angle,
                length: length,
                width: 0.5 + Math.random(),
                life: 1.5,
                maxLife: 1.5,
                opacity: 0.3
              });
            }
          }
        }
      }
    }

    // Update existing waves
    shorelineWaves.forEach(wave => wave.life -= dt);
    shorelineWaves.splice(0, shorelineWaves.length, ...shorelineWaves.filter(w => w.life > 0));
  }

  function update(dt) {
    if (!state.isPlaying) return;

    const p = state.player;

    // Spawn wake segments
    wakeTimer += dt;
    if (wakeTimer >= WAKE_SPAWN_INTERVAL) {
      wakeTimer = 0;
      spawnWake(p.x, p.y, p.angle, p.speed);
    }

    // Update wake segments
    wakeSegments.forEach(seg => seg.life -= dt);
    wakeSegments.splice(0, wakeSegments.length, ...wakeSegments.filter(s => s.life > 0));

    // Update shoreline waves
    updateShorelineWaves(dt);
  }

  function render(ctx, camera, tileSize) {
    const centerX = state.width / 2;
    const centerY = state.height / 2;

    // Render wake segments
    ctx.lineCap = 'round';
    wakeSegments.forEach(seg => {
      const t = seg.life / seg.maxLife;
      const fadeIn = Math.min(1, (seg.maxLife - seg.life) * 3);
      const fadeOut = Math.min(1, t * 2);
      const fade = Math.min(fadeIn, fadeOut);

      const screenX = (seg.x - camera.x) * tileSize + centerX;
      const screenY = (seg.y - camera.y) * tileSize + centerY;

      const endX = screenX + Math.cos(seg.angle) * seg.length * tileSize;
      const endY = screenY + Math.sin(seg.angle) * seg.length * tileSize;

      ctx.strokeStyle = `rgba(255, 255, 255, ${seg.opacity * fade})`;
      ctx.lineWidth = seg.width;
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    });

    // Render shoreline waves
    shorelineWaves.forEach(wave => {
      const t = wave.life / wave.maxLife;
      const fade = Math.min(1, t * 2);

      const screenX = (wave.x - camera.x) * tileSize + centerX;
      const screenY = (wave.y - camera.y) * tileSize + centerY;

      const endX = screenX + Math.cos(wave.angle) * wave.length * tileSize;
      const endY = screenY + Math.sin(wave.angle) * wave.length * tileSize;

      ctx.strokeStyle = `rgba(200, 230, 255, ${wave.opacity * fade})`;
      ctx.lineWidth = wave.width;
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    });
  }

  return { update, render };
}