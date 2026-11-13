// Tree drawing helpers: wind lean, shadows, and geometry.
//
// Trees lean downwind and sway gently around that lean. The lean is applied as
// a shear around the trunk base, so the existing faceted lighting geometry keeps
// working. Shadows use the same lean for their tip, so the shadow visibly
// follows the canopy.

const ZERO_LEAN = { x: 0, y: 0 };

export function getTreeLean(tree, state, tileSize, out) {
  const result = out || { x: 0, y: 0 };
  const wind = state.weather && state.weather.wind;
  if (!wind || wind.strength <= 0.015) {
    result.x = 0;
    result.y = 0;
    return result;
  }

  const treeH = tileSize * tree.h;
  const phase = typeof tree.phase === 'number'
    ? tree.phase
    : ((tree.x * 12.9898 + tree.y * 78.233) % (Math.PI * 2));

  const time = state.time || 0;
  const reducedMotion = state.settings && state.settings.reducedMotion;
  const sway = reducedMotion
    ? 0
    : (Math.sin(time * 1.35 + phase) * 0.16 +
       Math.sin(time * 2.3 + phase * 1.7) * 0.06);

  const gust = 1 + sway;
  const dirX = Math.cos(wind.angle);
  const dirY = Math.sin(wind.angle);
  const leanAmount = treeH * 0.22 * wind.strength * gust;

  result.x = dirX * leanAmount;
  // Wind toward/away from the camera should read as a small height change,
  // not a tree falling sideways.
  result.y = dirY * leanAmount * 0.22;
  return result;
}

export function drawTreeShadow(ctx, state, camera, tileSize, tree, cycle, shadowDir, lean = ZERO_LEAN) {
  const { x: tx, y: ty, h } = tree;
  const centerX = state.width / 2;
  const centerY = state.height / 2;
  const sx = (tx - state.camera.x) * tileSize + centerX;
  const sy = (ty - state.camera.y) * tileSize + centerY;

  // Allow cycle.shadowAlpha to reach 0 so shadows can fully fade out at night.
  const alpha = Math.max(0, Math.min(0.9, cycle.shadowAlpha * 1.8));
  if (alpha <= 0.0001) return;
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;

  const lengthFactor = cycle.shadowLength;
  if (lengthFactor <= 0.0001) return;

  const baseW = tileSize * 0.5 * h;
  const len = tileSize * h * lengthFactor * 1.6;

  const leanX = lean.x || 0;
  const leanY = lean.y || 0;

  // The tip follows the canopy's leaned position; the base stays rooted.
  const tipX = sx + leanX + shadowDir.x * len;
  const tipY = sy + leanY * 0.6 + shadowDir.y * len;

  const halfBaseW = baseW / 2;

  // Tree base points: horizontal base flush with the tree's screen position.
  const p1x = sx - halfBaseW;
  const p1y = sy;
  const p2x = sx + halfBaseW;
  const p2y = sy;

  ctx.beginPath();
  ctx.moveTo(p1x, p1y);
  ctx.lineTo(p2x, p2y);
  ctx.lineTo(tipX, tipY);
  ctx.closePath();
  ctx.fill();
}

export function drawTree(ctx, state, tileSize, tree, treeColors, cycle, lean = ZERO_LEAN) {
  const { x: tx, y: ty, h, type } = tree;
  const centerX = state.width / 2;
  const centerY = state.height / 2;
  const sx = (tx - state.camera.x) * tileSize + centerX;
  const sy = (ty - state.camera.y) * tileSize + centerY;
  const baseW = tileSize * 0.4 * h;
  const treeH = tileSize * 1.0 * h;
  const halfBaseW = baseW / 2;

  const leanX = lean.x || 0;
  const leanY = lean.y || 0;

  // 1. Determine colors and shading factors
  const darkColor = type === 'forest' ? treeColors.treeForest : treeColors.treeGrass;
  const litColor = type === 'forest' ? treeColors.treeForestLit : treeColors.treeGrassLit;

  const S = cycle.shadeProgression; // 0 (dawn start) to 1 (dusk end)

  // Move to the tree base, then shear the whole tree around it. A point at the
  // apex (0, -treeH) maps to (leanX, -treeH + leanY).
  ctx.save();
  ctx.translate(sx, sy);
  if (leanX !== 0 || leanY !== 0) {
    ctx.transform(1, 0, -leanX / treeH, 1 - leanY / treeH, 0, 0);
  }

  // Local drawing coordinates: base is (0, 0), apex is (0, -treeH).
  // Night condition: If S is at extremes, treat as fully shaded (dark color only).
  if (S < 0.05 || S > 0.95) {
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.moveTo(-halfBaseW, 0);
    ctx.lineTo(halfBaseW, 0);
    ctx.lineTo(0, -treeH);
    ctx.fill();
    ctx.restore();
    return;
  }

  let X_b; // Boundary position, normalized to [-1.1, 1.1] where tree base span is [-1, 1]
  let lightSideIsLeft; // True if light hits the left face (Afternoon S >= 0.5)

  if (S < 0.5) {
    // Morning: S_m = 0 to 1. Light from SE (Right side). Light is on the right side.
    const S_m = S * 2;
    // X_b sweeps from 1.1 (full shade) down to -1.1 (full light)
    X_b = 1.1 - 2.2 * S_m;
    lightSideIsLeft = false;
  } else {
    // Afternoon: S_a = 0 to 1. Light from NW (Left side). Light is on the left side.
    const S_a = (S - 0.5) * 2;
    // X_b sweeps from 1.1 (full light) down to -1.1 (full shade)
    X_b = 1.1 - 2.2 * S_a;
    lightSideIsLeft = true;
  }

  // Draw base: full Dark color (shaded side)
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.moveTo(-halfBaseW, 0);
  ctx.lineTo(halfBaseW, 0);
  ctx.lineTo(0, -treeH);
  ctx.fill();

  // If X_b is outside [-1, 1], we are fully illuminated near noon.
  if (X_b <= -1.0 || X_b >= 1.0) {
    // If we reached here, we are in full illumination (near noon)
    ctx.fillStyle = litColor;
    ctx.fill(); // Redraw the whole area with lit color
    ctx.restore();
    return;
  }

  // Calculate vertical intersection point P_y_top
  // Px_boundary is the local X coordinate of the vertical shadow line.
  const Px_boundary = X_b * halfBaseW;
  const slope = treeH / halfBaseW;
  let P_y_top;

  // Determine P_y_top based on which side of the cone Px_boundary falls on
  if (Px_boundary < 0) {
    // Intersection with the left hypotenuse: y = -slope * (x + halfBaseW)
    P_y_top = -slope * (Px_boundary + halfBaseW);
  } else {
    // Intersection with the right hypotenuse: y = -slope * (halfBaseW - x)
    P_y_top = -slope * (halfBaseW - Px_boundary);
  }

  // Clamp P_y_top between peak and base
  P_y_top = Math.max(-treeH, Math.min(0, P_y_top));

  // Draw Lit side polygon overlay
  ctx.fillStyle = litColor;

  ctx.beginPath();

  if (lightSideIsLeft) {
    // Afternoon: Light on Left side. Polygon includes P_left and P_top.
    ctx.moveTo(-halfBaseW, 0); // P_left base corner
    ctx.lineTo(0, -treeH); // P_top
    ctx.lineTo(Px_boundary, P_y_top);
    ctx.lineTo(Px_boundary, 0);
  } else {
    // Morning: Light on Right side. Polygon includes P_right and P_top.
    ctx.moveTo(halfBaseW, 0); // P_right base corner
    ctx.lineTo(0, -treeH); // P_top
    ctx.lineTo(Px_boundary, P_y_top);
    ctx.lineTo(Px_boundary, 0);
  }

  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
