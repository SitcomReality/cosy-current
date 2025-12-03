// Fauna drawing helpers (non-shadow geometry)

export function drawCreature(ctx, c, screenX, screenY, size, cycle) {
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(c.angle);

  // Rotate the entire bird form by 90 degrees so wings and body are oriented together.
  // This replaces the previous per-bird internal rotation.
  ctx.rotate(Math.PI / 2);

  if (c.type === 'fish') {
    drawFish(ctx, c, size);
  } else if (c.type === 'eel') {
    drawEel(ctx, c, size);
  } else if (c.type === 'bird') {
    drawBird(ctx, c, size, cycle);
  } else if (c.type === 'deer') {
    drawDeer(ctx, c, size);
  } else if (c.type === 'critter') {
    drawCritter(ctx, c, size);
  } else if (c.type === 'firefly') {
    drawFirefly(ctx, c, size);
  } else if (c.type === 'crab') {
    drawCrab(ctx, c, size);
  }

  ctx.restore();
}

function drawCrab(ctx, c, size) {
  const colors = c.segmentColors || [c.color, c.color];
  const w = size * 0.8;
  const h = size * 0.6;

  // Legs (zigzag lines)
  ctx.strokeStyle = c.color; // Use base color for legs
  ctx.lineWidth = size * 0.15;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw 3 legs per side
  for (let side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const legOffset = (i - 1) * (w * 0.4);
      ctx.beginPath();
      ctx.moveTo(0, legOffset);
      ctx.lineTo(side * w * 0.8, legOffset - h * 0.3); // Knee
      ctx.lineTo(side * w * 1.2, legOffset + h * 0.2); // Foot
      ctx.stroke();
    }
    // Claw
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.4);
    ctx.lineTo(side * w * 0.6, -h * 0.8);
    ctx.lineTo(side * w * 0.9, -h * 1.2); // Pointy claw tip
    ctx.stroke();
  }

  // Shell Segments (Pointy trapezoids/polygons)
  // Stacked back-to-front
  const segCount = colors.length;
  const segStep = (h * 1.2) / segCount;

  for (let i = 0; i < segCount; i++) {
    const col = colors[i];
    const yOff = (i - (segCount - 1) / 2) * segStep * 0.8;
    const segScale = 1.0 - (i * 0.15);

    ctx.fillStyle = col;
    ctx.beginPath();

    const sw = w * (0.8 - i * 0.1); 
    const sh = segStep * 1.2;

    const localY = (i * segStep) - (h * 0.5);

    ctx.moveTo(-sw, localY + sh);
    ctx.lineTo(-sw * 0.8, localY); // top left
    ctx.lineTo(0, localY - sh * 0.3); // top point
    ctx.lineTo(sw * 0.8, localY); // top right
    ctx.lineTo(sw, localY + sh); // bottom right
    ctx.lineTo(0, localY + sh * 0.8); // bottom center indent
    ctx.closePath();
    ctx.fill();

    // Rim
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Eyes
  ctx.fillStyle = 'black';
  ctx.beginPath();
  ctx.arc(-w * 0.3, -h * 0.6, size * 0.1, 0, Math.PI * 2);
  ctx.arc(w * 0.3, -h * 0.6, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawFish(ctx, c, size) {
  const len = size * 1.2;
  const width = size * 0.5;

  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.moveTo(len * 0.5, 0);
  ctx.lineTo(-len * 0.5, -width * 0.5);
  ctx.lineTo(-len * 0.5, width * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-len * 0.5, 0);
  ctx.lineTo(-len * 0.8, -width * 0.4);
  ctx.lineTo(-len * 0.8, width * 0.4);
  ctx.closePath();
  ctx.fill();
}

function drawEel(ctx, c, size) {
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

  // Tail tip removed so eel appears as one continuous body (no separate triangular cap)

  ctx.restore();
}

function drawBird(ctx, c, size, cycle) {
  const flapPhase = Math.sin(c.life * 8);
  const wingSpan = size * 1.5;
  const wingY = size * 0.3 * flapPhase;

  ctx.strokeStyle = c.color;
  ctx.lineWidth = Math.max(1, size * 0.15);
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(-wingSpan * 0.5, wingY);
  ctx.lineTo(0, 0);
  ctx.lineTo(wingSpan * 0.5, wingY);
  ctx.stroke();

  // Replace circular body with a straight-edged triangular body
  ctx.fillStyle = c.color;

  // Rotate the triangular body by 90 degrees so it points forward relative to wings
  ctx.save();
  ctx.rotate(Math.PI / 2);

  // Draw the body triangle without an extra internal rotation (we rotated the whole bird earlier)
  const bodyLen = size * 0.9;
  const bodyWid = Math.max(0.2, size * 0.6);
  ctx.beginPath();
  ctx.moveTo(bodyLen * 0.5, 0);                    // front tip
  ctx.lineTo(-bodyLen * 0.5, -bodyWid * 0.5);      // back top
  ctx.lineTo(-bodyLen * 0.5, bodyWid * 0.5);       // back bottom
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawDeer(ctx, c, size) {
  // Stylized straight-edged deer: compact triangular body, kite-shaped head, and angular antlers.
  // All geometry uses straight lines and flat fills to match the rigid aesthetic.

  // Body parameters
  const bodyLen = size * 0.9;
  const bodyWid = size * 0.6;
  const halfLen = bodyLen * 0.5;
  const halfWid = bodyWid * 0.5;

  // Head parameters (kite / diamond shape attached to front)
  const headLen = size * 0.45;
  const headWid = size * 0.32;

  // Antler parameters
  const antlerLen = size * 0.45;
  const antlerBranch = size * 0.18;

  ctx.save();
  ctx.translate(0, 0);
  ctx.rotate(c.angle);

  // Body: a simple forward-pointing trapezoid (flat-shaded)
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.moveTo(halfLen, 0);                         // front tip
  ctx.lineTo(-halfLen + halfLen * 0.25, -halfWid); // back-top
  ctx.lineTo(-halfLen, 0);                        // back center
  ctx.lineTo(-halfLen + halfLen * 0.25, halfWid);  // back-bottom
  ctx.closePath();
  ctx.fill();

  // Back patch / rump as slightly darker inset polygon
  ctx.fillStyle = shadeColor(c.color, -12);
  ctx.beginPath();
  ctx.moveTo(-halfLen + halfLen * 0.25, -halfWid * 0.6);
  ctx.lineTo(-halfLen + halfLen * 0.05, 0);
  ctx.lineTo(-halfLen + halfLen * 0.25, halfWid * 0.6);
  ctx.closePath();
  ctx.fill();

  // Head: kite (diamond) attached to front-left of body (pointing forward)
  const headX = halfLen + headLen * 0.0;
  const headY = 0;
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.moveTo(headX + headLen * 0.5, headY);            // front tip
  ctx.lineTo(headX, headY - headWid * 0.6);            // top
  ctx.lineTo(headX - headLen * 0.5, headY);            // rear tip (joins body)
  ctx.lineTo(headX, headY + headWid * 0.6);            // bottom
  ctx.closePath();
  ctx.fill();

  // Eye: small square (rigid)
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillRect(headX + headLen * 0.15 - 1, headY - 2, 3, 3);

  // Antlers: angular, mirrored lines from top of head
  ctx.strokeStyle = shadeColor(c.color, -30);
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.lineCap = 'butt';
  ctx.beginPath();
  // Left antler
  ctx.moveTo(headX, headY - headWid * 0.6);
  ctx.lineTo(headX - antlerLen * 0.2, headY - antlerLen * 0.6);
  ctx.lineTo(headX - antlerLen * 0.45, headY - antlerLen * 0.35);
  ctx.moveTo(headX - antlerLen * 0.15, headY - antlerLen * 0.35);
  ctx.lineTo(headX - antlerLen * 0.55, headY - antlerLen * 0.05);

  // Right antler (mirrored)
  ctx.moveTo(headX, headY - headWid * 0.6);
  ctx.lineTo(headX + antlerLen * 0.2, headY - antlerLen * 0.6);
  ctx.lineTo(headX + antlerLen * 0.45, headY - antlerLen * 0.35);
  ctx.moveTo(headX + antlerLen * 0.15, headY - antlerLen * 0.35);
  ctx.lineTo(headX + antlerLen * 0.55, headY - antlerLen * 0.05);

  ctx.stroke();

  // Tail: small rigid wedge at back
  ctx.fillStyle = shadeColor(c.color, -8);
  ctx.beginPath();
  ctx.moveTo(-halfLen, 0);
  ctx.lineTo(-halfLen - size * 0.12, -size * 0.08);
  ctx.lineTo(-halfLen - size * 0.12, size * 0.08);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

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

function drawCritter(ctx, c, size) {
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, 0);
  ctx.lineTo(-size * 0.3, -size * 0.4);
  ctx.lineTo(-size * 0.3, size * 0.4);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = c.color;
  ctx.lineWidth = Math.max(1, size * 0.1);
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, 0);
  ctx.lineTo(-size * 0.6, size * 0.2);
  ctx.stroke();
}

function drawFirefly(ctx, c, size) {
  const glowIntensity = 0.5 + 0.5 * Math.sin(c.life * 3 + c.id.charCodeAt(0));
  ctx.shadowColor = c.color;
  ctx.shadowBlur = size * 4 * glowIntensity;
  ctx.fillStyle = c.color;
  ctx.globalAlpha = 0.8;

  ctx.beginPath();
  ctx.moveTo(size * 0.3, 0);
  ctx.lineTo(-size * 0.2, -size * 0.2);
  ctx.lineTo(-size * 0.2, size * 0.2);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = size * 6 * glowIntensity;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}