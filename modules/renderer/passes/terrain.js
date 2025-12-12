export function renderTerrainPass(ctx, state, game, chunkManager, CHUNK_SIZE, cycle, now) {
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

  for (let cy = startChunkY; cy <= endChunkY; cy++) {
    for (let cx = startChunkX; cx <= endChunkX; cx++) {
      const chunkData = chunkManager.getChunk(cx, cy, cycle);
      if (!chunkData || !chunkData.canvas) continue;

      const chunkImg = chunkData.canvas;
      const screenX = (cx * CHUNK_SIZE - state.camera.x) * tileSize + centerX;
      const screenY = (cy * CHUNK_SIZE - state.camera.y) * tileSize + centerY;
      if (screenX > state.width || screenY > state.height ||
          screenX + chunkImg.width < 0 || screenY + chunkImg.height < 0) continue;

      const x = Math.round(screenX);
      const y = Math.round(screenY);

      // If we have a previous canvas, cross-fade from prev -> current over transitionDuration
      const hasPrev = !!chunkData.prevCanvas && chunkData.transitionDuration > 0;
      let t = 1;
      if (hasPrev) {
        const elapsed = now - (chunkData.transitionStart || 0);
        if (elapsed >= chunkData.transitionDuration) {
          t = 1;
          // Transition finished; drop prevCanvas to free memory and stop blending
          chunkData.prevCanvas = null;
          chunkData.transitionDuration = 0;
        } else if (elapsed <= 0) {
          t = 0;
        } else {
          t = Math.max(0, Math.min(1, elapsed / chunkData.transitionDuration));
        }
      }

      if (hasPrev && t < 1 && chunkData.prevCanvas) {
        // Draw old chunk faded out
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.drawImage(chunkData.prevCanvas, x, y);
        ctx.restore();

        // Draw new chunk faded in
        ctx.save();
        ctx.globalAlpha = t;
        ctx.drawImage(chunkImg, x, y);
        ctx.restore();
      } else {
        // No transition active, draw normally
        ctx.drawImage(chunkImg, x, y);
      }
    }
  }
}

