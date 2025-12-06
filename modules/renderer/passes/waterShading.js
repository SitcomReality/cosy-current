import { getRiverGradient } from '../../fauna/behaviors/riverUtils.js';

export function renderWaterShadingPass(ctx, state, game, noise, cycle, shadowDir) {
  if (cycle.shadowAlpha <= 0.001 || cycle.shadowLength <= 0.0001) return;

  const sunDirX = -shadowDir.x;
  const sunDirY = -shadowDir.y;
  const sunDirLen = Math.hypot(sunDirX, sunDirY) || 1;
  const sunNX = sunDirX / sunDirLen;
  const sunNY = sunDirY / sunDirLen;

  const strengthBase = Math.max(0, Math.min(1, cycle.shadowAlpha / 0.45));
  if (strengthBase <= 0.001) return;

  const tileSize = state.tileSize;
  const centerX = state.width / 2;
  const centerY = state.height / 2;

  const viewLeftTile = state.camera.x - (state.width / 2) / tileSize;
  const viewRightTile = state.camera.x + (state.width / 2) / tileSize;
  const viewTopTile = state.camera.y - (state.height / 2) / tileSize;
  const viewBottomTile = state.camera.y + (state.height / 2) / tileSize;

  ctx.save();

  for (let ty = Math.floor(viewTopTile); ty <= Math.floor(viewBottomTile); ty++) {
    for (let tx = Math.floor(viewLeftTile); tx <= Math.floor(viewRightTile); tx++) {
      const tileType = game.getTile(tx, ty);
      if (tileType !== game.CONSTANTS.TILE_WATER) continue;

      const wx = tx + 0.5;
      const wy = ty + 0.5;
      const { gx, gy, mag } = getRiverGradient(noise, wx, wy, 2.0);

      if (mag < 0.05) continue;

      const dot = gx * sunNX + gy * sunNY;
      const angleFactor = Math.max(0, dot);

      if (angleFactor <= 0.001) continue;

      const darkness = angleFactor * strengthBase;
      if (darkness <= 0.001) continue;

      const screenX = (tx - state.camera.x) * tileSize + centerX;
      const screenY = (ty - state.camera.y) * tileSize + centerY;

      if (screenX > state.width || screenY > state.height ||
          screenX + tileSize < 0 || screenY + tileSize < 0) continue;

      const alpha = Math.min(0.5, 0.35 * darkness);
      if (alpha <= 0) continue;

      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(Math.floor(screenX), Math.floor(screenY), Math.ceil(tileSize), Math.ceil(tileSize));
    }
  }

  ctx.restore();
}

