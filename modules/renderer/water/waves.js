import { getLocalFlowAngle } from './utils.js';

export function createWaveSystem(game, noise) {
  const shorelineWaves = [];
  const MIN_LINE_LENGTH = 1;

  // Helper: compute squared distance between two world-space points
  function distSq(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  function update(dt, player, isPlaying) {
    if (!isPlaying) return;

    // Spawn new waves
    // Increased spawn probability and attempts to make shoreline waves more frequent
    if (Math.random() < dt * 4.0) { 
      const searchRadius = 26; 
      // Perform a random scattering of checks instead of a full dense grid scan every frame to save perf
      // while maintaining coverage over time.
      const attempts = 30;
      
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

            // Movement: choose whether wave moves inward (towards the middle of the river)
            // or outward (towards the bank). We'll coordinate direction with nearby waves
            // and avoid spawning too close to them to reduce overlap and opposite motion.
            let proposedDirSign = Math.random() < 0.5 ? -1 : 1;
            const maxOffsetTiles = 0.2 + Math.random() * 1.2;

            // Check nearby existing waves
            // Use world-space radius so it scales naturally with zoom.
            const neighborRadius = 3.0;          // tiles
            const neighborRadiusSq = neighborRadius * neighborRadius;
            const minSeparation = 1.2;          // tiles; avoid waves this close
            const minSeparationSq = minSeparation * minSeparation;

            let sumDirSign = 0;
            let tooClose = false;

            for (let j = 0; j < shorelineWaves.length; j++) {
              const w = shorelineWaves[j];
              const d2 = distSq(wx, wy, w.x, w.y);

              // If we are extremely close to an existing wave, skip spawning to avoid overlap
              if (d2 < minSeparationSq) {
                tooClose = true;
                break;
              }

              // Collect direction votes from waves within a broader neighborhood
              if (d2 < neighborRadiusSq) {
                sumDirSign += w.dirSign || 0;
              }
            }

            if (tooClose) {
              // Skip this candidate; continue attempts to keep overall density similar
              continue;
            }

            // If there are neighbors, align this wave's motion direction with them
            if (sumDirSign !== 0) {
              proposedDirSign = sumDirSign > 0 ? 1 : -1;
            }

            shorelineWaves.push({
              x: wx + (Math.random() - 0.5),
              y: wy + (Math.random() - 0.5),
              angle: angle,
              length: length,
              width: 0.6 + Math.random() * 1.2,
              life: 2.5,
              maxLife: 2.5,
              opacity: 0.45 + Math.random() * 0.25,
              // New movement properties:
              dirSign: proposedDirSign,
              maxOffsetTiles
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

      // Compute how far along the life the wave is (0 at spawn, 1 at end)
      const lifeProgress = 1 - (wave.life / wave.maxLife); // 0..1
      // Ease-out (quadratic): eased = 1 - (1 - u)^2
      const eased = 1 - Math.pow(1 - lifeProgress, 2);

      // Compute perpendicular (unit) to the wave's angle to move the line sideways
      const perpX = Math.cos(wave.angle + Math.PI / 2);
      const perpY = Math.sin(wave.angle + Math.PI / 2);

      // Convert maxOffset from tiles -> pixels and apply direction and easing
      const offsetPixels = wave.maxOffsetTiles * tileSize * wave.dirSign * eased;

      // Start and end points for the base line (before perpendicular shift)
      const endX = screenX + Math.cos(wave.angle) * wave.length * tileSize;
      const endY = screenY + Math.sin(wave.angle) * wave.length * tileSize;

      // Shift both endpoints along perpendicular by offsetPixels so the entire line translates
      const sx = screenX + perpX * offsetPixels;
      const sy = screenY + perpY * offsetPixels;
      const ex = endX + perpX * offsetPixels;
      const ey = endY + perpY * offsetPixels;

      const pixelLineWidth = Math.max(1, wave.width * tileSize * 0.06);

      ctx.strokeStyle = `rgba(200, 230, 255, ${Math.min(1, wave.opacity * fade)})`;
      ctx.lineWidth = pixelLineWidth;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    });
  }

  return { update, render };
}