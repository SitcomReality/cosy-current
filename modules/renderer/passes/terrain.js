export function renderTerrainPass(ctx, state, game, chunkManager, CHUNK_SIZE, cycle) {
  const tileSize = state.tileSize;
  const centerX = state.width / 2;
  const centerY = state.height / 2;

  const viewLeftTile = state.camera.x - (state.width / 2) / tileSize;
  const viewRightTile = state.camera.x + (state.width / 2) / tileSize;
  const viewTopTile = state.camera.y - (state.height / 2) / tileSize;
  const viewBottomTile = state.camera.y + (state.height / 2) / tileSize;

  const startChunkX = Math.floor(viewLeftTile / CHUNK_SIZE);
  const endChunkX = Math.floor(viewRightTile / CHUNK_SIZE);
  const startChunkY = Math.floor(viewTopTile / CHUNK_SIZE);
  const endChunkY = Math.floor(viewBottomTile / CHUNK_SIZE);

  const CROSSFADE_MS = 260;

  const now = performance.now();

  for (let cy = startChunkY; cy <= endChunkY; cy++) {
    for (let cx = startChunkX; cx <= endChunkX; cx++) {
      const chunkImg = chunkManager.getChunk(cx, cy, cycle);
      const entry = (typeof chunkManager.getChunkEntry === 'function') ? chunkManager.getChunkEntry(cx, cy) : null;

      const screenX = (cx * CHUNK_SIZE - state.camera.x) * tileSize + centerX;
      const screenY = (cy * CHUNK_SIZE - state.camera.y) * tileSize + centerY;
      if (screenX > state.width || screenY > state.height ||
          screenX + chunkImg.width < 0 || screenY + chunkImg.height < 0) continue;

      if (entry && entry.prevCanvas && entry.prevStart) {
        // Crossfade between prevCanvas -> canvas over CROSSFADE_MS
        const elapsed = now - entry.prevStart;
        const t = Math.max(0, Math.min(1, elapsed / CROSSFADE_MS));
        // draw prev
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.drawImage(entry.prevCanvas, Math.round(screenX), Math.round(screenY));
        ctx.restore();
        // draw new
        ctx.save();
        ctx.globalAlpha = t;
        ctx.drawImage(entry.canvas, Math.round(screenX), Math.round(screenY));
        ctx.restore();

        // Once finished, drop prevCanvas so future draws are normal
        if (t >= 1.0) {
          // clear prev to release memory
          entry.prevCanvas = null;
          entry.prevStart = null;
          // update cache lastUsed/dayTime already handled in manager
        }
      } else {
        ctx.drawImage(chunkImg, Math.round(screenX), Math.round(screenY));
      }
    }
  }
}

