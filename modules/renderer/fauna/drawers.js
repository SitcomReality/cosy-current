// Fauna drawing helpers (non-shadow geometry)

export function drawCreature(ctx, c, screenX, screenY, size, cycle) {
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(c.angle);

  // Rotate the entire bird form by 90 degrees so wings and body are oriented together.
  // This replaces the previous per-bird internal rotation.
  // ctx.rotate(Math.PI / 2);

  if (c.type === 'fish') {
    drawFish(ctx, c, size);
  } else if (c.type === 'eel') {
    drawEel(ctx, c, size);
  } else if (c.type === 'bird') {
    // Apply the extra 90° rotation only to birds so other creatures stay aligned
    ctx.rotate(Math.PI / 2);
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
  // Flip the body triangle 180° relative to its current orientation so the point faces the other direction
  ctx.rotate(Math.PI / 2 + Math.PI);

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
  // Brighter, tiny square center with thin yellow outline and stronger glow
  const baseColor = '#ffffff';
  const rimColor = '#fef08a'; // soft yellow outline
  // Pulsing factor for subtle glow animation
  const pulse = 0.65 + 0.35 * Math.sin(c.life * 4 + (c.id ? c.id.charCodeAt(0) : 0));
  // Reduced multiplier for glow from 10 -> 5 for less intense blur
  const glow = Math.max(1, size * 5 * pulse); // was 10

  ctx.save();
  ctx.translate(0, 0);

  // Glow (bigger than before)
  ctx.shadowColor = rimColor;
  ctx.shadowBlur = glow;
  ctx.globalAlpha = 0.95;

  // Tiny filled white square at center
  const coreSize = Math.max(2, Math.min(4, size * 0.25)); // Increased minimum core size for visibility
  ctx.fillStyle = baseColor;
  ctx.fillRect(-coreSize / 2, -coreSize / 2, coreSize, coreSize);

  // Thin yellow outline
  ctx.shadowBlur = glow * 0.6; // slightly smaller blur for outline
  ctx.strokeStyle = rimColor;
  ctx.lineWidth = Math.max(0.5, coreSize * 0.25);
  ctx.strokeRect(-coreSize / 2, -coreSize / 2, coreSize, coreSize);

  // Reset shadow and alpha
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}