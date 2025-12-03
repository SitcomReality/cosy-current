// Aquatic flora drawing helpers: shadows and plant geometry

// Helper to blend two hex colors
function lerpColor(aHex, bHex, t) {
  const parse = (hex) => {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  };
  const c1 = parse(aHex);
  const c2 = parse(bHex);
  const blend = (i) => Math.round(c1[i] + (c2[i] - c1[i]) * t);
  const r = blend(0);
  const g = blend(1);
  const b = blend(2);
  return `rgb(${r},${g},${b})`;
}

export function drawAquaticShadow(ctx, state, tileSize, prop, cycle, shadowDir) {
  const { x: tx, y: ty, h, type } = prop;
  const centerX = state.width / 2;
  const centerY = state.height / 2;
  const sx = (tx - state.camera.x) * tileSize + centerX;
  const sy = (ty - state.camera.y) * tileSize + centerY;

  const alpha = Math.max(0, Math.min(0.9, cycle.shadowAlpha * 1.5)); // Slightly lighter than trees
  if (alpha <= 0.0001) return;
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;

  const lengthFactor = cycle.shadowLength;
  if (lengthFactor <= 0.0001) return;

  const len = tileSize * h * lengthFactor * 1.2;
  const tipX = sx + shadowDir.x * len;
  const tipY = sy + shadowDir.y * len;

  // Base width varies by type
  let baseFactor = 0.2;
  if (type === 'reeds') baseFactor = 0.25;
  if (type === 'kelp') baseFactor = 0.15;
  if (type === 'seagrass') baseFactor = 0.3;

  const baseW = tileSize * h * baseFactor;
  const halfBaseW = baseW / 2;

  // Draw simple triangle shadow on riverbed
  ctx.beginPath();
  ctx.moveTo(sx - halfBaseW, sy);
  ctx.lineTo(sx + halfBaseW, sy);
  ctx.lineTo(tipX, tipY);
  ctx.closePath();
  ctx.fill();
}

export function drawAquaticPlant(ctx, state, tileSize, prop, floraColors) {
  const { x: tx, y: ty, h, type, depth, phase } = prop;
  const centerX = state.width / 2;
  const centerY = state.height / 2;
  const sx = (tx - state.camera.x) * tileSize + centerX;
  const sy = (ty - state.camera.y) * tileSize + centerY;

  // Cull
  const m = tileSize * 2;
  if (sx < -m || sx > state.width + m || sy < -m || sy > state.height + m) return;

  // Resolve color with depth tint
  let baseColor;
  if (type === 'reeds') baseColor = floraColors.reeds;
  else if (type === 'kelp') baseColor = floraColors.kelp;
  else baseColor = floraColors.seagrass; // seagrass

  // Apply tint based on depth (deeper = more tinted)
  // depth is 0..1. Mix factor maxes out at ~0.7 to keep some local color
  const finalColor = lerpColor(baseColor, floraColors.tint, depth * 0.75);

  ctx.fillStyle = finalColor;
  ctx.strokeStyle = finalColor;

  // Base size from height, with per-species max scaling
  let size = h * tileSize;

  // Reeds & kelp should be smaller than mid-depth seagrass visually
  if (type === 'reeds') {
    size *= 0.7; // shrink shallow reeds
  } else if (type === 'kelp') {
    size *= 0.8; // slightly smaller deep kelp
  } else {
    // seagrass keeps original max size for its species
    size *= 1.0;
  }

  // Per-plant variation in overall scale using phase as a stable pseudo-random
  const basePhase = typeof phase === 'number' ? phase : Math.random() * Math.PI * 2;
  const rand01 = (Math.sin(basePhase * 3.17 + tx * 0.37 + ty * 0.53) + 1) * 0.5; // 0..1
  const scaleJitter = 0.75 + rand01 * 0.7; // ~0.75..1.45
  size *= scaleJitter;

  // Horizontal flip chance for asymmetrical species; keep everything visually upright.
  // Use deterministic pseudo-random so flipping is stable per plant.
  const randFlip = (Math.sin(basePhase * 5.03 + tx * 0.91 - ty * 0.27) + 1) * 0.5; // 0..1
  const flipX = (type === 'kelp' || type === 'seagrass') && randFlip > 0.5 ? -1 : 1;

  ctx.save();
  ctx.translate(sx, sy);
  if (flipX === -1) {
    ctx.scale(-1, 1);
  }

  // Draw Geometry (all straight-edged, no curves/rounded shapes)
  if (type === 'reeds') {
    // Cluster of 3-4 straight, segmented stalks forming zig-zag polygons
    const stalkCount = 3 + (rand01 > 0.6 ? 1 : 0);
    const spread = size * 0.18;
    const stalkHeight = size;

    ctx.lineWidth = Math.max(1, size * 0.08);
    ctx.lineCap = 'butt';

    for (let i = 0; i < stalkCount; i++) {
      const t = (i - (stalkCount - 1) / 2);
      const xOff = t * spread;
      const heightVar = stalkHeight * (0.7 + Math.abs(t) * 0.12);
      const kink = (t * 0.35) * heightVar;

      // Simple 3-point polyline: base -> mid kink -> tip
      const midY = -heightVar * 0.5;
      const tipY = -heightVar;

      ctx.beginPath();
      ctx.moveTo(xOff, 0);
      ctx.lineTo(xOff + kink * 0.15, midY);
      ctx.lineTo(xOff + kink * 0.3, tipY);
      ctx.stroke();
    }
  } else if (type === 'kelp') {
    // Tall jagged ribbon made from straight segments, no curves
    // Introduce more shape variability using pseudo-random parameters derived from basePhase/position.
    const randSeg = (Math.sin(basePhase * 4.21 + tx * 0.19 + ty * 0.31) + 1) * 0.5; // 0..1
    const randW = (Math.sin(basePhase * 2.77 - tx * 0.13 + ty * 0.47) + 1) * 0.5;
    const randH = (Math.sin(basePhase * 6.13 + tx * 0.07 - ty * 0.29) + 1) * 0.5;

    const segments = 4 + Math.floor(randSeg * 3);        // 4–6 segments
    const totalH = size * (0.9 + randH * 0.4);           // slight height variance
    const segmentH = totalH / segments;
    const baseW = size * (0.12 + randW * 0.07);          // subtle width variation

    // Build a jagged, less-regular spine; combine a few straight-edged "kinks".
    const spine = [];
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const y = -u * totalH;

      // Combine a couple of phase-shifted waves with randomized strengths to avoid identical bends.
      const swayBase = Math.sin(basePhase + u * Math.PI * (1.2 + randSeg * 0.6));
      const swayDetail = Math.sin(basePhase * 1.7 + u * Math.PI * (2.0 + randW * 0.8));
      const swayStepped = (Math.floor((u * 4 + randH * 3)) % 2 === 0 ? 1 : -1); // coarse step for harsher kinks

      const sway =
        swayBase * (0.25 + randSeg * 0.35) +
        swayDetail * (0.15 + randW * 0.25) +
        swayStepped * 0.15;

      const x = sway * baseW * 1.6;
      spine.push({ x, y });
    }

    // Build left/right polygon points along the spine
    const left = [];
    const right = [];
    for (let i = 0; i < spine.length; i++) {
      const p = spine[i];
      const next = spine[Math.min(i + 1, spine.length - 1)];
      const prev = spine[Math.max(i - 1, 0)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      let nx = -dy;
      let ny = dx;
      const nLen = Math.hypot(nx, ny) || 1;
      nx /= nLen;
      ny /= nLen;

      // Slight taper towards tip and slightly thicker mid-body for a leaf-like silhouette
      const t = i / (spine.length - 1);
      const midBias = 1.0 - Math.abs(t - 0.5) * 1.2; // fuller in the middle
      const thickness = baseW * (0.6 + (1 - t) * 0.5) * (0.8 + midBias * 0.4);

      left.push({ x: p.x + nx * thickness, y: p.y + ny * thickness });
      right.push({ x: p.x - nx * thickness, y: p.y - ny * thickness });
    }

    ctx.beginPath();
    for (let i = 0; i < left.length; i++) {
      const p = left[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    for (let i = right.length - 1; i >= 0; i--) {
      const p = right[i];
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();

    // Optional rigid "leaf" shards along one side using small triangles
    const shardCount = 2;
    for (let i = 0; i < shardCount; i++) {
      const idx = 1 + Math.floor((spine.length - 3) * (i / (shardCount - 1 || 1)));
      const p = spine[idx];
      const shardLen = baseW * (0.7 + randW * 0.5);
      const shardWid = baseW * (0.5 + randSeg * 0.4);
      const dir = (i % 2 === 0) ? 1 : -1;

      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + dir * shardLen, p.y - shardWid * 0.4);
      ctx.lineTo(p.x + dir * shardLen * 0.6, p.y + shardWid * 0.6);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // Seagrass: small fan of straight blades forming angular polygons, always upright
    const blades = 5;
    const baseLen = size * 0.7;
    const spread = Math.PI / 3; // total angular spread for the fan

    ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.lineCap = 'butt';

    for (let i = 0; i < blades; i++) {
      const t = (i - (blades - 1) / 2) / ((blades - 1) / 2 || 1);
      const angle = -Math.PI / 2 + t * spread;
      const len = baseLen * (0.75 + (1 - Math.abs(t)) * 0.3);

      const tipX = Math.cos(angle) * len;
      const tipY = Math.sin(angle) * len;

      // Create a thin, straight-edged blade as a 4-point polygon
      const sideOffset = size * 0.06;
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);

      const b0x = 0 + perpX * sideOffset;
      const b0y = 0 + perpY * sideOffset;
      const b1x = 0 - perpX * sideOffset;
      const b1y = 0 - perpY * sideOffset;
      const t0x = tipX + perpX * sideOffset * 0.6;
      const t0y = tipY + perpY * sideOffset * 0.6;
      const t1x = tipX - perpX * sideOffset * 0.6;
      const t1y = tipY - perpY * sideOffset * 0.6;

      ctx.beginPath();
      ctx.moveTo(b0x, b0y);
      ctx.lineTo(t0x, t0y);
      ctx.lineTo(t1x, t1y);
      ctx.lineTo(b1x, b1y);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}
