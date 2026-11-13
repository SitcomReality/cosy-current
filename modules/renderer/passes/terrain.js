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

  // Chunk bitmaps are rasterized at floor(CHUNK_SIZE * tileSize) pixels, but
  // tileSize is fractional after wheel zoom. Rounding each chunk's top-left
  // independently (and then drawing at the bitmap's natural size) can leave a
  // 1px column/row of the page background between chunks.
  //
  // Derive both edges of the destination rect from the same world-space chunk
  // boundary instead. Adjacent chunks then compute exactly the same shared
  // edge, regardless of fractional tileSize / camera / devicePixelRatio. The
  // bitmap is stretched by at most a pixel, which is invisible with smoothing
  // disabled. The +1px overlap hides the antialiased edge of the chunk bitmap.
  const dpr = state.pixelRatio || 1;
  const snapToDevicePixel = (v) => Math.round(v * dpr) / dpr;

  // If this renderer supports the experimental world-space shading mode, make
  // all visible water chunks rebuild against the same sun position rather than
  // baking each one at a slightly different dayTime.
  if (chunkManager.prepareFrame) {
    chunkManager.prepareFrame(startChunkX, endChunkX, startChunkY, endChunkY, cycle);
  }

  for (let cy = startChunkY; cy <= endChunkY; cy++) {
    for (let cx = startChunkX; cx <= endChunkX; cx++) {
      const chunkData = chunkManager.getChunk(cx, cy, cycle);
      if (!chunkData || !chunkData.canvas) continue;

      const chunkImg = chunkData.canvas;
      const screenX = (cx * CHUNK_SIZE - state.camera.x) * tileSize + centerX;
      const screenY = (cy * CHUNK_SIZE - state.camera.y) * tileSize + centerY;
      if (screenX > state.width || screenY > state.height ||
          screenX + chunkImg.width < 0 || screenY + chunkImg.height < 0) continue;

      const left = snapToDevicePixel(screenX);
      const top = snapToDevicePixel(screenY);
      const right = snapToDevicePixel(screenX + CHUNK_SIZE * tileSize);
      const bottom = snapToDevicePixel(screenY + CHUNK_SIZE * tileSize);
      const drawW = right - left + 1;
      const drawH = bottom - top + 1;

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
        // Draw old chunk fully opaque as the base layer to prevent background bleed-through
        ctx.drawImage(chunkData.prevCanvas, left, top, drawW, drawH);

        // Draw new chunk faded in on top
        ctx.save();
        ctx.globalAlpha = t;
        ctx.drawImage(chunkImg, left, top, drawW, drawH);
        ctx.restore();
      } else {
        // No transition active, draw normally
        ctx.drawImage(chunkImg, left, top, drawW, drawH);
      }
    }
  }
}

