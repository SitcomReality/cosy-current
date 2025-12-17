// Base size parameter is size (pixel radius equivalent).
// Note: These drawers assume ctx translation is already applied to screenX, screenY.

// --- Utility Functions ---

function hexToRgba(hex, alpha) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const num = parseInt(h, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function lerpColor(c1, c2, t) {
  const hexToRgb = (hex) => {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const num = parseInt(h, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };
  const rgbToHex = (r, g, b) => '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toLowerCase();
  
  const cA = hexToRgb(c1);
  const cB = hexToRgb(c2);
  
  const r = Math.round(cA[0] + (cB[0] - cA[0]) * t);
  const g = Math.round(cA[1] + (cB[1] - cA[1]) * t);
  const b = Math.round(cA[2] + (cB[2] - cA[2]) * t);
  
  return rgbToHex(r, g, b);
}

// --- Specific Drawers ---

// wood (Driftwood)
export function drawWood(ctx, color, size) {
  const len = size * 2.5;
  const wid = size * 0.8;
  const darkBrown = '#78350f'; 
  const lightBrown = color; 

  ctx.fillStyle = lightBrown;
  ctx.beginPath();
  // Irregular polygon representing a broken log
  ctx.moveTo(-len * 0.5, -wid * 0.4);
  ctx.lineTo(len * 0.5, -wid * 0.2);
  ctx.lineTo(len * 0.4, wid * 0.6);
  ctx.lineTo(-len * 0.6, wid * 0.2);
  ctx.closePath();
  ctx.fill();

  // Highlight/grain lines (rectangles/lines)
  ctx.fillStyle = darkBrown;
  ctx.fillRect(-len * 0.4, -wid * 0.1, len * 0.3, wid * 0.2);
  ctx.fillRect(len * 0.1, wid * 0.15, len * 0.3, wid * 0.2);
}

// scrap (Rusted Scrap)
export function drawScrap(ctx, color, size) {
  // Jagged shard of rusted metal
  const s = size * 1.5;
  const rustColor = '#b91c1c';
  const steelColor = color; 

  // Rusted base
  ctx.fillStyle = rustColor;
  ctx.beginPath();
  ctx.moveTo(s * 0.5, -s * 0.1);
  ctx.lineTo(s * 0.1, -s * 0.6);
  ctx.lineTo(-s * 0.5, -s * 0.3);
  ctx.lineTo(-s * 0.3, s * 0.5);
  ctx.lineTo(s * 0.2, s * 0.3);
  ctx.closePath();
  ctx.fill();
  
  // Steel highlight/edge/hole
  ctx.fillStyle = steelColor;
  ctx.beginPath();
  ctx.moveTo(-s * 0.4, -s * 0.2);
  ctx.lineTo(-s * 0.3, -s * 0.1);
  ctx.lineTo(-s * 0.1, s * 0.3);
  ctx.lineTo(-s * 0.2, s * 0.4);
  ctx.closePath();
  ctx.fill();
  
  // Hole (dark spot)
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(s * 0.1, -s * 0.1, s * 0.15, s * 0.15);
}

// cloth (Tattered Cloth)
export function drawCloth(ctx, color, size) {
  // Wavy flag/sheet shape
  const w = size * 2.0;
  const h = size * 1.5;
  const p = size * 0.4; // Perturbation for waves
  const c = color; 

  ctx.fillStyle = c;
  ctx.beginPath();
  // Bottom edge
  ctx.moveTo(-w / 2, h * 0.3);
  ctx.lineTo(w / 2, h * 0.2);
  // Top edge (irregular)
  ctx.lineTo(w * 0.4, -h * 0.5 + p * 0.5);
  ctx.lineTo(w * 0.1, -h * 0.5 - p);
  ctx.lineTo(-w * 0.3, -h * 0.5 + p * 0.5);
  ctx.closePath();
  ctx.fill();
  
  // Fold line
  ctx.strokeStyle = lerpColor(c, '#000000', 0.1);
  ctx.lineWidth = Math.max(1, size * 0.1);
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, h * 0.1);
  ctx.lineTo(w * 0.4, -h * 0.2);
  ctx.stroke();
}

// plastic (Hard Plastic)
export function drawPlastic(ctx, color, size) {
  // Sharp polygonal block / container fragment
  const s = size * 1.5;
  const c = color;

  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(s * 0.5, 0);
  ctx.lineTo(s * 0.2, -s * 0.5);
  ctx.lineTo(-s * 0.5, -s * 0.2);
  ctx.lineTo(-s * 0.3, s * 0.5);
  ctx.closePath();
  ctx.fill();

  // Inner compartment or detail (darker color)
  ctx.fillStyle = lerpColor(c, '#000000', 0.25);
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, -s * 0.1);
  ctx.lineTo(s * 0.1, -s * 0.3);
  ctx.lineTo(s * 0.3, 0);
  ctx.lineTo(s * 0.1, s * 0.3);
  ctx.lineTo(-s * 0.2, s * 0.1);
  ctx.closePath();
  ctx.fill();
}

// ancient_coin (Ancient Coin)
export function drawAncientCoin(ctx, color, size) {
  // Octagonal Coin shape 
  const s = size * 1.8;
  const sides = 8;
  
  ctx.fillStyle = color; // GOLD_COLOR
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const ang = (i / sides) * Math.PI * 2;
    const x = Math.cos(ang) * s;
    const y = Math.sin(ang) * s;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  
  // Inner rim
  ctx.fillStyle = lerpColor(color, '#000000', 0.15);
  const rimS = s * 0.8;
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const ang = (i / sides) * Math.PI * 2;
    const x = Math.cos(ang) * rimS;
    const y = Math.sin(ang) * rimS;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // Central emblem (pyramid shape)
  ctx.fillStyle = lerpColor(color, '#ffffff', 0.3);
  const innerS = s * 0.4;
  ctx.beginPath();
  ctx.moveTo(0, -innerS);
  ctx.lineTo(innerS * 0.6, innerS * 0.4);
  ctx.lineTo(-innerS * 0.6, innerS * 0.4);
  ctx.closePath();
  ctx.fill();
}

// river_gem (River Gem)
export function drawRiverGem(ctx, color, size) {
  // Sharp faceted diamond
  const s = size * 1.8;
  
  // Main body (rotated 45 degrees for diamond look)
  ctx.fillStyle = color; // COLLECTABLE_COLOR
  ctx.rotate(Math.PI / 4);
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s, 0);
  ctx.lineTo(0, s);
  ctx.lineTo(-s, 0);
  ctx.closePath();
  ctx.fill();
  
  // Facets 
  ctx.fillStyle = hexToRgba('#ffffff', 0.4);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(s * 0.6, 0);
  ctx.lineTo(0, -s * 0.6);
  ctx.closePath();
  ctx.fill();
  
  ctx.fillStyle = hexToRgba('#000000', 0.2);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-s * 0.4, 0);
  ctx.lineTo(0, s * 0.4);
  ctx.closePath();
  ctx.fill();

  ctx.rotate(-Math.PI / 4); // Restore rotation
}

// message_bottle (Message in a Bottle)
export function drawMessageBottle(ctx, color, size) {
  const baseW = size * 1.2;
  const baseH = size * 3.0;
  const neckW = size * 0.4;
  const neckH = size * 0.8;
  const bottleColor = '#3b82f6'; 

  // Body (slightly transparent)
  ctx.fillStyle = hexToRgba(bottleColor, 0.4);
  
  // Bottle polygon
  ctx.beginPath();
  ctx.moveTo(-baseW / 2, baseH / 2 - neckH);
  ctx.lineTo(baseW / 2, baseH / 2 - neckH);
  ctx.lineTo(baseW / 2 * 0.8, -baseH / 2 + neckH * 0.5);
  ctx.lineTo(-baseW / 2 * 0.8, -baseH / 2 + neckH * 0.5);
  ctx.closePath();
  ctx.fill();
  
  // Paper inside (simple folded paper trapezoid)
  ctx.fillStyle = '#fef3c7';
  const paperH = baseH * 0.7;
  const paperW = baseW * 0.6;
  ctx.beginPath();
  ctx.moveTo(-paperW / 2, paperH / 2 - baseH * 0.1);
  ctx.lineTo(paperW / 2, paperH / 2 - baseH * 0.1);
  ctx.lineTo(paperW / 2 * 0.8, -paperH / 2 + baseH * 0.1);
  ctx.lineTo(-paperW / 2 * 0.8, -paperH / 2 + baseH * 0.1);
  ctx.closePath();
  ctx.fill();

  // Neck and cork/cap
  const capColor = '#78350f';
  ctx.fillStyle = capColor; 
  ctx.fillRect(-neckW / 2, -baseH / 2 + neckH * 0.5 - neckH, neckW, neckH);
}

// old_compass (Broken Compass)
export function drawOldCompass(ctx, color, size) {
  // Compass housing (octagon to avoid curves)
  const s = size * 2.0;
  const sides = 8;
  
  ctx.fillStyle = color; // COLLECTABLE_COLOR
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const ang = (i / sides) * Math.PI * 2;
    const x = Math.cos(ang) * s;
    const y = Math.sin(ang) * s;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  
  // Inner face (square)
  const faceS = s * 0.7;
  ctx.fillStyle = '#d1d5db';
  ctx.fillRect(-faceS / 2, -faceS / 2, faceS, faceS);
  
  // Needle (broken, points randomly)
  ctx.rotate(Math.random() * Math.PI * 2);
  const needleL = faceS * 0.6;
  
  ctx.fillStyle = '#ef4444'; // Red half
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(needleL, 0);
  ctx.lineTo(needleL * 0.8, needleL * 0.1);
  ctx.lineTo(needleL * 0.8, -needleL * 0.1);
  ctx.closePath();
  ctx.fill();
  
  ctx.fillStyle = '#1f2937'; // Broken dark half
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-needleL * 0.5, 0);
  ctx.lineTo(-needleL * 0.3, needleL * 0.1);
  ctx.lineTo(-needleL * 0.3, -needleL * 0.1);
  ctx.closePath();
  ctx.fill();
}


// --- Dispatch Map ---

export const COLLECTABLE_DRAWERS = {
  wood: drawWood,
  scrap: drawScrap,
  cloth: drawCloth,
  plastic: drawPlastic,
  ancient_coin: drawAncientCoin,
  river_gem: drawRiverGem,
  message_bottle: drawMessageBottle,
  old_compass: drawOldCompass
};

