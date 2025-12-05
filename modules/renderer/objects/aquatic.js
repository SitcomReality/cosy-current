// Aquatic flora drawing helpers: shadows and plant geometry
import { shortestAngleDiff } from '/modules/fauna/utils.js';

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

export function drawAquaticShadow(ctx, state, tileSize, prop, cycle, shadowDir, light) {
  const { x: tx, y: ty, h, type } = prop;
  const centerX = state.width / 2;
  const centerY = state.height / 2;
  const sx = (tx - state.camera.x) * tileSize + centerX;
  const sy = (ty - state.camera.y) * tileSize + centerY;

  let alpha = Math.max(0, Math.min(0.9, cycle.shadowAlpha * 1.5)); // Sunlight alpha
  let lengthFactor = cycle.shadowLength;
  
  // Raft Light Shadow Calculation Override
  if (light && light.enabled) {
    const dxL = tx - light.x;
    const dyL = ty - light.y;
    const distSq = dxL * dxL + dyL * dyL;
    const rangeSq = 25 * 25; 

    if (distSq < rangeSq) {
      // Check cone angle for shadows (a bit wider than visualization cone)
      const angleToProp = Math.atan2(dyL, dxL);
      const angleDiff = Math.abs(shortestAngleDiff(angleToProp, light.angle));
      const coneAngle = Math.PI / 3; // 60 degrees total arc

      if (angleDiff < coneAngle) {
         const lenL = Math.hypot(dxL, dyL) || 1;
         shadowDir = { x: dxL / lenL, y: dyL / lenL };
         
         // Scale shadow visibility based on proximity to light source
         const dist = Math.sqrt(distSq);
         const intensity = 1.0 - (dist / 25.0);
         
         alpha = 0.5 * intensity; // Max shadow alpha 0.5 under raft light
         lengthFactor = 0.5 * intensity; // Max shadow length factor 0.5
      }
    }
  }

  if (alpha <= 0.0001) return;
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;

  if (lengthFactor <= 0.0001) return;

  const len = tileSize * h * lengthFactor * 1.2;

  // For kelp, compute a deterministic "base offset" (in pixels) that matches
  // how drawAquaticPlant builds the spine so the shadow base lines up with the plant base.
  let baseOffsetPxX = 0;
  if (type === 'kelp') {
    // Recreate the minimal pseudo-random parameters used when drawing kelp so we can
    // estimate the horizontal offset of the first spine point (the base).
    // This uses the same derivatives from prop.phase/pos as drawAquaticPlant.
    const basePhase = typeof prop.phase === 'number' ? prop.phase : Math.random() * Math.PI * 2;
    const txf = tx, tyf = ty;

    const randSeg = (Math.sin(basePhase * 4.21 + txf * 0.19 + tyf * 0.31) + 1) * 0.5; // 0..1
    const randW = (Math.sin(basePhase * 2.77 - txf * 0.13 + tyf * 0.47) + 1) * 0.5;
    const randH = (Math.sin(basePhase * 6.13 + txf * 0.07 - tyf * 0.29) + 1) * 0.5;

    // Recreate segments and sizes similar to drawAquaticPlant but only enough to get spine[0].x
    const segments = 4 + Math.floor(randSeg * 3);        // 4–6 segments
    // totalH in drawAquaticPlant before halving is: size * (0.9 + randH * 0.4)
    // there they then halve it: totalH *= 0.5;
    const sizePixels = (1.0 + 0.0) * h * tileSize; // approximate h->pixel mapping used there; keep factor 1.0
    let totalH = sizePixels * (0.9 + randH * 0.4);
    totalH *= 0.5; // match the reduced kelp height used in drawing
    const baseW = sizePixels * (0.12 + randW * 0.07) * 0.5; // also halved like drawing

    // Compute first spine point x (i === 0 in draw)
    // In draw: const y = -u * totalH; for i=0 u=0 => y=0, then sway computed
    const i = 0;
    const u = i / segments; // 0
    const swayBase = Math.sin(basePhase + u * Math.PI * (1.2 + randSeg * 0.6));
    const swayDetail = Math.sin(basePhase * 1.7 + u * Math.PI * (2.0 + randW * 0.8));
    const swayStepped = (Math.floor((u * 4 + randH * 3)) % 2 === 0 ? 1 : -1);
    const sway =
      swayBase * (0.25 + randSeg * 0.35) +
      swayDetail * (0.15 + randW * 0.25) +
      swayStepped * 0.15;
    // spine x is sway * baseW * 1.6 in drawAquaticPlant
    const spineX = sway * baseW * 1.6;

    // Apply same flipX rule used in drawAquaticPlant for kelp (deterministic pseudo-random)
    const randFlip = (Math.sin(basePhase * 5.03 + txf * 0.91 - tyf * 0.27) + 1) * 0.5; // 0..1
    const flipX = randFlip > 0.5 ? -1 : 1;

    baseOffsetPxX = spineX * flipX;
  }

  // Shift the shadow base horizontally by the computed base offset for kelp so shadow aligns with the plant base
  const sxBase = sx + baseOffsetPxX;

  const tipX = sxBase + shadowDir.x * len;
  const tipY = sy + shadowDir.y * len;

  // Base width varies by type
  let baseFactor = 0.2;
  if (type === 'reeds') baseFactor = 0.25;
  if (type === 'kelp') baseFactor = 0.15;
  if (type === 'seagrass') baseFactor = 0.3;

  const baseW = tileSize * h * baseFactor;
  const halfBaseW = baseW / 2;

  // Draw simple triangle shadow on riverbed, using sxBase so kelp base aligns horizontally
  ctx.beginPath();
  ctx.moveTo(sxBase - halfBaseW, sy);
  ctx.lineTo(sxBase + halfBaseW, sy);
  ctx.lineTo(tipX, tipY);
  ctx.closePath();
  ctx.fill();
}

export function drawAquaticPlant(ctx, state, tileSize, prop, floraColors, light) {
  const { x: tx, y: ty, h, type, depth, phase } = prop;
  const centerX = state.width / 2;
  const centerY = state.height / 2;
  const sx = (tx - state.camera.x) * tileSize + centerX;
  const sy = (ty - state.camera.y) * tileSize + centerY;

  // Cull
  const m = tileSize * 2;
  if (sx < -m || sx > state.width + m || sy < -m || sy > state.height + m) return;

  // Resolve base color
  let baseColor;
  if (type === 'reeds') baseColor = floraColors.reeds;
  else if (type === 'kelp') baseColor = floraColors.kelp;
  else baseColor = floraColors.seagrass; // seagrass

  // Determine lighting and depth tint
  let finalColor;
  let depthTintFactor = depth * 0.75; // Max 0.75 depth tint

  if (light && light.enabled) {
    const dx = tx - light.x;
    const dy = ty - light.y;
    const distSq = dx * dx + dy * dy;
    const range = 25; // 25 tiles radius
    const rangeSq = range * range;
    
    if (distSq < rangeSq) {
      const angleToLight = Math.atan2(dy, dx);
      const angleDiff = Math.abs(shortestAngleDiff(angleToLight, light.angle));
      const coneAngle = Math.PI / 3; // 60 degrees total arc

      if (angleDiff < coneAngle) {
        // Intensity 1.0 near raft, 0.0 at edge
        const dist = Math.sqrt(distSq);
        const intensity = 1.0 - (dist / range);

        // Reduce depth tint when lit by raft
        depthTintFactor *= (1.0 - intensity * 0.7); 
      }
    }
  }

  // Apply tint based on depth (deeper = more tinted)
  finalColor = lerpColor(baseColor, floraColors.tint, depthTintFactor);

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
    let totalH = size * (0.9 + randH * 0.4);           // slight height variance
    const segmentH = totalH / segments;
    let baseW = size * (0.12 + randW * 0.07);          // subtle width variation

    // Reduce maximum kelp height and width by half for a smaller silhouette
    totalH *= 0.5;
    baseW *= 0.5;

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

      // Ensure the bottom edge (base) sits horizontally: force the first pair to have y=0
      if (i === 0) {
        // compute horizontal offsets for left/right at base
        left.push({ x: p.x + nx * thickness, y: 0 });
        right.push({ x: p.x - nx * thickness, y: 0 });
      } else {
        left.push({ x: p.x + nx * thickness, y: p.y + ny * thickness });
        right.push({ x: p.x - nx * thickness, y: p.y - ny * thickness });
      }
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
