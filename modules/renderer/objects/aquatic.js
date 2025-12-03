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

  const size = h * tileSize;

  // Draw Geometry
  if (type === 'reeds') {
    // Cluster of vertical lines
    const spread = size * 0.2;
    ctx.lineWidth = Math.max(1, size * 0.08);
    ctx.lineCap = 'round';

    // Draw 3 reeds
    for(let i=-1; i<=1; i++) {
      const hVar = size * (0.8 + Math.abs(i)*0.1);
      const xOff = i * spread * 0.6;
      const tipBend = i * spread * 0.3;

      ctx.beginPath();
      ctx.moveTo(sx + xOff, sy);
      ctx.quadraticCurveTo(sx + xOff, sy - hVar * 0.6, sx + xOff + tipBend, sy - hVar);
      ctx.stroke();
    }

  } else if (type === 'kelp') {
    // Tall wavy ribbon
    ctx.lineWidth = Math.max(2, size * 0.12);
    ctx.lineCap = 'round';

    // Use phase for a static wave shape (no animation requested, just shape)
    const waveAmp = size * 0.15;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    // Draw a bezier curve that snakes up
    ctx.bezierCurveTo(
      sx + waveAmp, sy - size * 0.33,
      sx - waveAmp, sy - size * 0.66,
      sx, sy - size
    );
    ctx.stroke();

    // Maybe a couple of leaf blobs
    ctx.beginPath();
    ctx.ellipse(sx + waveAmp*0.5, sy - size * 0.4, size*0.1, size*0.06, 0.5, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(sx - waveAmp*0.5, sy - size * 0.7, size*0.1, size*0.06, -0.5, 0, Math.PI*2);
    ctx.fill();

  } else {
    // Seagrass: bushy bottom clump
    const blades = 5;
    ctx.lineWidth = Math.max(1, size * 0.06);

    for(let i=0; i<blades; i++) {
      const angle = -Math.PI/2 + (i - (blades-1)/2) * 0.3;
      const len = size * (0.6 + (i%2)*0.2);

      const tx2 = sx + Math.cos(angle) * len;
      const ty2 = sy + Math.sin(angle) * len;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx, sy - len*0.5, tx2, ty2);
      ctx.stroke();
    }
  }
}
