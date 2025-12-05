// Tree drawing helpers: shadows and geometry

export function drawTreeShadow(ctx, state, camera, tileSize, tree, cycle, shadowDir) {
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

  const tipX = sx + shadowDir.x * len;
  const tipY = sy + shadowDir.y * len;

  const halfBaseW = baseW / 2;

  // Tree base points (P1, P2): defining a horizontal base flush with the tree's screen position (sx, sy)
  // This makes the shadow base horizontal regardless of sun angle, creating a skewed triangle.
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

export function drawTree(ctx, state, tileSize, tree, treeColors, cycle, light) {
  const { x: tx, y: ty, h, type } = tree;
  const centerX = state.width / 2;
  const centerY = state.height / 2;
  const sx = (tx - state.camera.x) * tileSize + centerX;
  const sy = (ty - state.camera.y) * tileSize + centerY;
  const baseW = tileSize * 0.4 * h;
  const treeH = tileSize * 1.0 * h;
  const halfBaseW = baseW / 2;

  // 1. Determine colors and shading factors
  const darkColor = type === 'forest' ? treeColors.treeForest : treeColors.treeGrass;
  const litColor = type === 'forest' ? treeColors.treeForestLit : treeColors.treeGrassLit;

  const S = cycle.shadeProgression; // 0 (dawn start) to 1 (dusk end)

  // Night condition: If S is at extremes, treat as fully shaded (dark color only).
  // Check if we are outside the active day cycle [0.05, 0.95]
  if (S < 0.05 || S > 0.95) {
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.moveTo(sx - halfBaseW, sy);
    ctx.lineTo(sx + halfBaseW, sy);
    ctx.lineTo(sx, sy - treeH);
    ctx.fill();
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
  ctx.moveTo(sx - halfBaseW, sy);
  ctx.lineTo(sx + halfBaseW, sy);
  ctx.lineTo(sx, sy - treeH);
  ctx.fill();

  // If X_b is outside [-1, 1], we are fully illuminated near noon.
  if (X_b <= -1.0 || X_b >= 1.0) {
    // If we reached here, we are in full illumination (near noon)
    ctx.fillStyle = litColor;
    ctx.fill(); // Redraw the whole area with lit color
    return;
  }

  // Calculate vertical intersection point P_y_top
  // Px_boundary is the screen X coordinate of the vertical shadow line.
  const Px_boundary = sx + X_b * halfBaseW;
  const slope = treeH / halfBaseW;
  let P_y_top;

  // Determine P_y_top based on which side of the cone Px_boundary falls on
  if (Px_boundary < sx) {
    // Intersection with the left hypotenuse: y = sy - slope * (x - x_left_base)
    P_y_top = sy - slope * (Px_boundary - (sx - halfBaseW));
  } else {
    // Intersection with the right hypotenuse: y = sy - slope * (x_right_base - x)
    P_y_top = sy - slope * ((sx + halfBaseW) - Px_boundary);
  }

  // Clamp P_y_top between peak and base
  P_y_top = Math.max(sy - treeH, Math.min(sy, P_y_top));

  // Draw Lit side polygon overlay
  ctx.fillStyle = litColor;

  ctx.beginPath();

  if (lightSideIsLeft) {
    // Afternoon: Light on Left side. Polygon includes P_left and P_top.
    ctx.moveTo(sx - halfBaseW, sy); // P_left base corner
    ctx.lineTo(sx, sy - treeH); // P_top
    ctx.lineTo(Px_boundary, P_y_top);
    ctx.lineTo(Px_boundary, sy);
  } else {
    // Morning: Light on Right side. Polygon includes P_right and P_top.
    ctx.moveTo(sx + halfBaseW, sy); // P_right base corner
    ctx.lineTo(sx, sy - treeH); // P_top
    ctx.lineTo(Px_boundary, P_y_top);
    ctx.lineTo(Px_boundary, sy);
  }

  ctx.closePath();
  ctx.fill();
}