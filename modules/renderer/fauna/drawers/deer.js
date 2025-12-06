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
  // Simplified, stylized top-down deer made from simple polygons:
  // - Rectangular body
  // - Smaller rectangular head in front
  // - Four short leg blocks
  // - Two angular antler lines
  // The calling code already applies translation/rotation, so draw in local space facing +X.

  const bodyLen = size * 0.9;
  const bodyWid = size * 0.6;
  const headLen = size * 0.32;
  const headWid = size * 0.28;
  const legLen = size * 0.18;
  const legWid = size * 0.08;

  const baseColor = c.color || '#8b5a2b';
  const rimColor = shadeColor(baseColor, -18);
  const lightPatch = shadeColor(baseColor, 18);

  // Body (rounded-rectangle-like via simple rectangle + small inset)
  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.rect(-bodyLen * 0.5, -bodyWid * 0.5, bodyLen, bodyWid);
  ctx.fill();

  // Slight rump highlight (a smaller rectangle at rear)
  ctx.fillStyle = rimColor;
  ctx.beginPath();
  ctx.rect(-bodyLen * 0.45, -bodyWid * 0.22, bodyLen * 0.18, bodyWid * 0.44);
  ctx.fill();

  // Head as small rectangle attached to front
  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.rect(bodyLen * 0.5, -headWid * 0.5, headLen, headWid);
  ctx.fill();

  // Light facial square (eye-ish cue) — tiny square on head front
  ctx.fillStyle = lightPatch;
  ctx.fillRect(bodyLen * 0.5 + headLen * 0.55, -0.5, headWid * 0.12, headWid * 0.12);

  // Legs: four small blocks under body corners (abstracted, symmetrical)
  ctx.fillStyle = rimColor;
  const legX = -bodyLen * 0.25;
  const legSpacing = bodyWid * 0.9;
  for (let i = -1; i <= 1; i += 2) {
    // front leg
    ctx.fillRect(legX + bodyLen * 0.35, i * (legSpacing * 0.5) - legWid / 2, legLen, legWid);
    // rear leg
    ctx.fillRect(legX - bodyLen * 0.35, i * (legSpacing * 0.5) - legWid / 2, legLen, legWid);
  }

  // Antlers: two simple angular strokes from the top-front of the head
  ctx.strokeStyle = rimColor;
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.lineCap = 'butt';
  ctx.beginPath();
  const antlerBaseX = bodyLen * 0.5 + headLen * 0.1;
  const antlerBaseY = -headWid * 0.4;
  // left antler
  ctx.moveTo(antlerBaseX, antlerBaseY);
  ctx.lineTo(antlerBaseX + headLen * 0.35, antlerBaseY - headWid * 0.5);
  ctx.moveTo(antlerBaseX + headLen * 0.18, antlerBaseY - headWid * 0.12);
  ctx.lineTo(antlerBaseX + headLen * 0.45, antlerBaseY - headWid * 0.22);
  // right antler
  ctx.moveTo(antlerBaseX, -antlerBaseY);
  ctx.lineTo(antlerBaseX + headLen * 0.35, -antlerBaseY + headWid * 0.5);
  ctx.moveTo(antlerBaseX + headLen * 0.18, -antlerBaseY + headWid * 0.12);
  ctx.lineTo(antlerBaseX + headLen * 0.45, -antlerBaseY + headWid * 0.22);
  ctx.stroke();
}