// Utility helpers extracted from the original chunk manager.

export function hexToRgb(hex) {
  if (!hex) return { r: 0, g: 0, b: 0 };
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const num = parseInt(h, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerpColorHex(aHex, bHex, t) {
  const a = hexToRgb(aHex);
  const b = hexToRgb(bHex);
  t = Math.max(0, Math.min(1, t));
  const r = Math.round(lerp(a.r, b.r, t));
  const g = Math.round(lerp(a.g, b.g, t));
  const bch = Math.round(lerp(a.b, b.b, t));
  return `rgb(${r},${g},${bch})`;
}

// Vertex perturbation helper (re-export of central behavior)
export function getPerturbedVertex(worldX, worldY, localGridX, localGridY, CHUNK_SIZE, tileSize, getVertexOffset) {
  const onChunkBoundary =
    (worldX % CHUNK_SIZE === 0) ||
    (worldY % CHUNK_SIZE === 0);

  const baseX = localGridX * tileSize;
  const baseY = localGridY * tileSize;

  if (onChunkBoundary) {
    return { x: baseX, y: baseY };
  }

  const perturbScale = tileSize * 0.15;
  const ox = getVertexOffset(worldX, worldY, 0) * perturbScale;
  const oy = getVertexOffset(worldX, worldY, 1) * perturbScale;
  return { x: baseX + ox, y: baseY + oy };
}