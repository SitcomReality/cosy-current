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

  for (let cy = startChunkY; cy <= endChunkY; cy++) {
    for (let cx = startChunkX; cx <= endChunkX; cx++) {
      const chunkImg = chunkManager.getChunk(cx, cy, cycle);
      const screenX = (cx * CHUNK_SIZE - state.camera.x) * tileSize + centerX;
      const screenY = (cy * CHUNK_SIZE - state.camera.y) * tileSize + centerY;
      if (screenX > state.width || screenY > state.height ||
          screenX + chunkImg.width < 0 || screenY + chunkImg.height < 0) continue;
      ctx.drawImage(chunkImg, Math.round(screenX), Math.round(screenY));
    }
  }
}

