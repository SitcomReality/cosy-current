// Water effects system: wakes, shoreline waves, ripples
// Low-poly 2D vector aesthetic using straight line segments

export function createWaterEffects({ state, game, noise }) {
  const wakeSegments = [];
  const shorelineWaves = [];

  const WAKE_SEGMENT_LIFE = 2.0; // seconds
  const WAKE_SPAWN_INTERVAL = 0.1; // spawn new segment every N seconds
  // All distances in this module are expressed in world "tile" units and
  // converted to pixels in render() using the current tileSize.
  const MIN_LINE_LENGTH = 1; // tiles

  let wakeTimer = 0;

  // Generate a wake segment from the player's current position
  function spawnWake(x, y, angle, speed) {
    if (speed < 0.5) return; // Don't generate wake when nearly stopped

    // Only spawn wakes when actually over river water
    const tile = game.getTile(Math.floor(x), Math.floor(y));
    const isWater =
      tile === game.CONSTANTS.TILE_RIVER_DEEP ||
      tile === game.CONSTANTS.TILE_RIVER_SHALLOW;
    if (!isWater) return;

    const intensity = Math.min(1, speed / 5);
    const baseSpread = 2.3; // tiles

    // Create V-shaped wake pattern with straight line segments
    for (let side of [-1, 1]) {
      // Invert side wake direction so segments point backwards relative to movement
      const wakeAngle = angle + Math.PI + side * (Math.PI / 6); // flipped 180° plus spread
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
      // Find nearby bank / water-edge tiles
      const searchRadius = 20;
      for (let dy = -searchRadius; dy <= searchRadius; dy += 2) {
        for (let dx = -searchRadius; dx <= searchRadius; dx += 2) {
          const tx = Math.floor(p.x + dx);
          const ty = Math.floor(p.y + dy);

          const tile = game.getTile(tx, ty);

          // We want waves drawn just inside the water along the shore,
          // so start from shallow water tiles adjacent to banks.
          const isShallowWater =
            tile === game.CONSTANTS.TILE_RIVER_SHALLOW ||
            tile === game.CONSTANTS.TILE_RIVER_DEEP;

          if (isShallowWater) {
            // Check if adjacent to bank land
            const hasBank = [
              game.getTile(tx - 1, ty),
              game.getTile(tx + 1, ty),
              game.getTile(tx, ty - 1),
              game.getTile(tx, ty + 1)
            ].some(t => t === game.CONSTANTS.TILE_BANK);

            if (hasBank && Math.random() < 0.08) {
              // Spawn a wave segment in water at the shoreline
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

      // seg.length is in tiles, so convert to pixels using tileSize
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

      // wave.length is in tiles, so convert to pixels using tileSize
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