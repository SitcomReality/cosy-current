// Small helper: darken/lighten hex-ish color a bit (expects '#rrggbb' or already rgba)
function shadeColor(col, amt) {
  // Fast path for rgba strings: return unchanged if not hex
  if (!col || col[0] !== '#') return col;
  const num = parseInt(col.slice(1), 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0x00FF) + amt;
  let b = (num & 0x0000FF) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  const rr = (r << 16) | (g << 8) | b;
  return `#${rr.toString(16).padStart(6, '0')}`;
}

export function drawDeer(ctx, c, size) {
  // Extremely simplified top-down deer: single body rectangle and a head rectangle.
  // This keeps the silhouette readable at small sizes and matches the rigid straight-edged style.

  const bodyLen = size * 0.9;
  const bodyWid = size * 0.6;
  const headLen = size * 0.28;
  const headWid = size * 0.24;

  const baseColor = c.color || '#8b5a2b';
  const rimColor = shadeColor(baseColor, -12);

  // Body
  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.rect(-bodyLen * 0.5, -bodyWid * 0.5, bodyLen, bodyWid);
  ctx.fill();

  // Slight rim/contrast as a thin inset rectangle for a touch of depth
  ctx.fillStyle = rimColor;
  ctx.beginPath();
  ctx.rect(-bodyLen * 0.4, -bodyWid * 0.4, bodyLen * 0.8, bodyWid * 0.2);
  ctx.fill();

  // Head: simple rectangle attached to the front of the body
  ctx.fillStyle = rimColor;
  ctx.beginPath();
  ctx.rect(bodyLen * 0.5, -headWid * 0.5, headLen, headWid);
  ctx.fill();
}