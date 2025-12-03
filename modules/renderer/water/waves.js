import { getLocalFlowAngle } from './utils.js';

export function createWaveSystem(game, noise) {
  const shorelineWaves = [];
  const MIN_LINE_LENGTH = 1;

  function update(dt, player, isPlaying) {
    if (!isPlaying) return;

    // Spawn new waves
    if (Math.random() < dt * 1.5) { 
      const searchRadius = 26; 
      // Perform a random scattering of checks instead of a full dense grid scan every frame to save perf
      // while maintaining coverage over time.
      const attempts = 15;
      
      for (let i = 0; i < attempts; i++) {
        const dx = (Math.random() - 0.5) * 2 * searchRadius;
        const dy = (Math.random() - 0.5) * 2 * searchRadius;
        
        const tx = Math.floor(player.x + dx);
        const ty = Math.floor(player.y + dy);
        const tile = game.getTile(tx, ty);

        if (tile === game.CONSTANTS.TILE_WATER) {
          // Check for nearby bank
          const hasBank = [
            game.getTile(tx - 1, ty),
            game.getTile(tx + 1, ty),
            game.getTile(tx, ty - 1),
            game.getTile(tx, ty + 1)
          ].some(t => t === game.CONSTANTS.TILE_BANK);

          if (hasBank) {
            // Spawn wave aligned with river flow
            const wx = tx + 0.5;
            const wy = ty + 0.5;
            const flowAngle = getLocalFlowAngle(noise, wx, wy);
            const angle = flowAngle + (Math.random() - 0.5) * 0.3; // small jitter
            
            const length = MIN_LINE_LENGTH * (0.8 + Math.random() * 2.0);
            
            shorelineWaves.push({
              x: wx + (Math.random() - 0.5),
              y: wy + (Math.random() - 0.5),
              angle: angle,
              length: length,
              width: 0.6 + Math.random() * 1.2,
              life: 2.5,
              maxLife: 2.5,
              opacity: 0.45 + Math.random() * 0.25
            });
          }
        }
      }
    }

    // Update existing
    let i = shorelineWaves.length;
    while (i--) {
      shorelineWaves[i].life -= dt;
      if (shorelineWaves[i].life <= 0) shorelineWaves.splice(i, 1);
    }
  }

  function render(ctx, camera, tileSize, state) {
    const centerX = state.width / 2;
    const centerY = state.height / 2;

    shorelineWaves.forEach(wave => {
      const t = wave.life / wave.maxLife;
      const fade = Math.min(1, t * 2);

      const screenX = (wave.x - camera.x) * tileSize + centerX;
      const screenY = (wave.y - camera.y) * tileSize + centerY;

      if (screenX < -50 || screenX > state.width + 50 || 
          screenY < -50 || screenY > state.height + 50) return;

      const endX = screenX + Math.cos(wave.angle) * wave.length * tileSize;
      const endY = screenY + Math.sin(wave.angle) * wave.length * tileSize;

      const pixelLineWidth = Math.max(1, wave.width * tileSize * 0.06);

      ctx.strokeStyle = `rgba(200, 230, 255, ${Math.min(1, wave.opacity * fade)})`;
      ctx.lineWidth = pixelLineWidth;
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    });
  }

  return { update, render };
}