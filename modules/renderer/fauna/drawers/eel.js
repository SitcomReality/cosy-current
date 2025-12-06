export function drawEel(ctx, c, size) {
  const segments = c.segmentCount || 4;
  const totalLen = size * 2.0;
  const segLen = totalLen / Math.max(1, segments);
  // Reduced thickness to make eels sleeker
  const baseThickness = size * 0.16;

  // Build smooth spine points with per-segment sinusoidal offsets.
  // The head is at +half totalLen, tail at -half totalLen in local coords.
  const points = [];
  const speedFactor = 3.8; // how fast the wave travels
  const time = c.life * speedFactor;
  const phaseOffset = 0.7; // phase difference between segments
  const waveAmp = baseThickness * 2.2; // base amplitude
  for (let i = 0; i < segments; i++) {
    const t = i / Math.max(1, segments - 1); // 0..1 along body
    const x = -totalLen * 0.5 + segLen * (i + 0.5);
    // Attenuate amplitude towards head so head is steadier and tail more wavy
    const attenuation = 0.25 + 0.75 * (1 - t);
    const phase = time + i * phaseOffset;
    // Subtle, smooth offset along Y
    const y = Math.sin(phase) * waveAmp * attenuation;
    points.push({ x, y, t });
  }

  // To make body follow a smooth curve, interpolate additional intermediate points.
  const smoothPts = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    smoothPts.push(p0);
    smoothPts.push({
      x: (p0.x + p1.x) * 0.5,
      y: (p0.y + p1.y) * 0.5,
      t: (p0.t + p1.t) * 0.5
    });
  }
  smoothPts.push(points[points.length - 1]);

  // Build polygonal straight-edged mesh from the spine by computing normals and placing
  // left/right vertices per spine point, then connecting them with straight lines.
  const leftVerts = [];
  const rightVerts = [];

  for (let i = 0; i < smoothPts.length; i++) {
    const p = smoothPts[i];
    const next = smoothPts[Math.min(i + 1, smoothPts.length - 1)];
    const prev = smoothPts[Math.max(i - 1, 0)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    let nx = -dy;
    let ny = dx;
    const lenN = Math.hypot(nx, ny) || 1;
    nx /= lenN;
    ny /= lenN;

    // Taper thickness from head (thinner) to mid-body then tail
    const thickness = baseThickness * (1.1 + 0.8 * (1 - p.t));

    leftVerts.push({ x: p.x + nx * thickness, y: p.y + ny * thickness });
    rightVerts.push({ x: p.x - nx * thickness, y: p.y - ny * thickness });
  }

  const poly = [];
  for (let i = 0; i < leftVerts.length; i++) poly.push(leftVerts[i]);
  for (let i = rightVerts.length - 1; i >= 0; i--) poly.push(rightVerts[i]);

  ctx.save();
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';

  // Outline
  ctx.beginPath();
  for (let i = 0; i < poly.length; i++) {
    const v = poly[i];
    if (i === 0) ctx.moveTo(v.x, v.y);
    else ctx.lineTo(v.x, v.y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fill();

  // Fill
  ctx.beginPath();
  for (let i = 0; i < poly.length; i++) {
    const v = poly[i];
    if (i === 0) ctx.moveTo(v.x, v.y);
    else ctx.lineTo(v.x, v.y);
  }
  ctx.closePath();
  ctx.fillStyle = c.color;
  ctx.fill();

  // Head: triangular cap
  if (smoothPts.length >= 2) {
    const tailIdx = smoothPts.length - 1;
    const headPt = smoothPts[tailIdx];
    const prevPt = smoothPts[tailIdx - 1];
    const dx = headPt.x - prevPt.x;
    const dy = headPt.y - prevPt.y;
    const ang = Math.atan2(dy, dx);

    const headLen = segLen * 0.6;
    const headWid = baseThickness * 2.2;

    const hx1 = headPt.x;
    const hy1 = headPt.y;
    const hx2 = headPt.x - Math.cos(ang) * headLen + Math.sin(ang) * headWid * 0.5;
    const hy2 = headPt.y - Math.sin(ang) * headLen - Math.cos(ang) * headWid * 0.5;
    const hx3 = headPt.x - Math.cos(ang) * headLen - Math.sin(ang) * headWid * 0.5;
    const hy3 = headPt.y - Math.sin(ang) * headLen + Math.cos(ang) * headWid * 0.5;

    ctx.beginPath();
    ctx.moveTo(hx1, hy1);
    ctx.lineTo(hx2, hy2);
    ctx.lineTo(hx3, hy3);
    ctx.closePath();
    ctx.fillStyle = c.color;
    ctx.fill();

    const eyeX = headPt.x - Math.cos(ang) * (headLen * 0.25) + Math.sin(ang) * (headWid * 0.12);
    const eyeY = headPt.y - Math.sin(ang) * (headLen * 0.25) - Math.cos(ang) * (headWid * 0.12);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(eyeX - 1, eyeY - 1, 2, 2);
  }

  ctx.restore();
}