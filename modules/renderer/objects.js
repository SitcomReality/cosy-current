// Object drawing helpers: trees, shadows, entities, player

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

export function drawTree(ctx, state, tileSize, tree, treeColors, cycle) {
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

export function drawJaggedInfluence(ctx, centerX, centerY, radius, seedStr, fillColorOrOptions, alphaMul = 1) {
  // Backwards-compatible: allow passing a color string (old behavior) or an options object.
  let opts = {};
  if (typeof fillColorOrOptions === 'string' || fillColorOrOptions === undefined) {
    opts.fillColor = fillColorOrOptions || 'rgba(255,255,255,0.18)';
    opts.outline = false;
    opts.strokeColor = null;
    opts.lineWidth = 1;
  } else {
    opts = Object.assign({
      fillColor: null,
      outline: false,
      strokeColor: 'rgba(255,255,255,0.28)',
      lineWidth: 2
    }, fillColorOrOptions);
  }

  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  const sides = 6 + (h % 9);
  const jitter = 0.18 + ((h >> 8) % 40) / 200;

  ctx.save();
  ctx.globalAlpha = (ctx.globalAlpha || 1) * alphaMul;

  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const t = i / sides;
    const ang = t * Math.PI * 2;
    const vHash = (h ^ (i * 2654435761)) >>> 0;
    const vRnd = ((vHash % 1000) / 1000) * 2 - 1;
    const r = Math.max(0.1, radius * (1 + vRnd * jitter));
    const px = centerX + Math.cos(ang) * r;
    const py = centerY + Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  if (opts.outline) {
    ctx.strokeStyle = opts.strokeColor || 'rgba(255,255,255,0.28)';
    ctx.lineWidth = opts.lineWidth || 2;
    ctx.stroke();
  } else {
    ctx.fillStyle = opts.fillColor || 'rgba(255,255,255,0.18)';
    ctx.fill();
  }

  ctx.restore();
}

export function drawEntities(ctx, state, tileSize, game, centerX, centerY) {
  const MARGIN = tileSize * 2;
  state.entities.forEach(ent => {
    const screenX = (ent.x - state.camera.x) * tileSize + centerX;
    const screenY = (ent.y - state.camera.y) * tileSize + centerY;
    if (screenX < -tileSize*2 || screenX > state.width + tileSize*2 ||
        screenY < -tileSize*2 || screenY > state.height + tileSize*2) return;

    const distToEdgeX = Math.min(screenX, state.width - screenX);
    const distToEdgeY = Math.min(screenY, state.height - screenY);
    const minDistToEdge = Math.min(distToEdgeX, distToEdgeY);
    const edgeFade = Math.max(0, Math.min(1, minDistToEdge / MARGIN));

    const influenceRadiusPx = (game.CONSTANTS.INTERACTION_RADIUS || 35) * tileSize;

    if (ent.type === game.CONSTANTS.ENTITY_CITY) {
      // Draw an outlined, desaturated influence ring instead of filled green
      drawJaggedInfluence(ctx, screenX + tileSize/2, screenY + tileSize/2, influenceRadiusPx, ent.id + '_city', {
        outline: true,
        strokeColor: 'rgba(255,255,255,0.28)',
        lineWidth: 10
      }, edgeFade);
      ctx.save();
      ctx.globalAlpha = edgeFade;
      ctx.fillStyle = '#10b981';
      ctx.fillRect(screenX, screenY, tileSize, tileSize);
      ctx.fillStyle = '#065f46';
      ctx.fillRect(screenX + tileSize/2 - tileSize*0.1, screenY, tileSize*0.2, tileSize*0.6);
      ctx.restore();
    } else if (ent.type === game.CONSTANTS.ENTITY_RELIC) {
      // Draw an outlined, desaturated influence ring instead of filled orange
      drawJaggedInfluence(ctx, screenX + tileSize/2, screenY + tileSize/2, influenceRadiusPx, ent.id + '_relic', {
        outline: true,
        strokeColor: 'rgba(255,255,255,0.28)',
        lineWidth: 10
      }, edgeFade);
      ctx.save();
      ctx.globalAlpha = edgeFade;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(screenX + tileSize/2, screenY);
      ctx.lineTo(screenX + tileSize, screenY + tileSize);
      ctx.lineTo(screenX, screenY + tileSize);
      ctx.fill();
      ctx.restore();
    }
  });
}

export function drawPlayer(ctx, state, tileSize, cycle, shadowDir, noise) {
  const p = state.player;
  const centerX = state.width / 2;
  const centerY = state.height / 2;
  const px = (p.x - state.camera.x) * tileSize + centerX;
  const py = (p.y - state.camera.y) * tileSize + centerY;

  // Depth-aware Shadow Rendering
  if (cycle.shadowAlpha > 0.01 && cycle.shadowLength > 0.0001 && noise) {
    const raftHalfLen = 1.0; // Slightly larger than raft (0.9) to match original shadow size
    const raftHalfWid = 0.6;
    
    // Define perimeter points for the shadow polygon
    // We use enough points to allow the shadow to bend across depth changes
    const localPoints = [
      {x: -raftHalfLen, y: -raftHalfWid}, 
      {x: 0, y: -raftHalfWid}, 
      {x: raftHalfLen, y: -raftHalfWid},
      {x: raftHalfLen, y: 0},
      {x: raftHalfLen, y: raftHalfWid}, 
      {x: 0, y: raftHalfWid}, 
      {x: -raftHalfLen, y: raftHalfWid},
      {x: -raftHalfLen, y: 0}
    ];

    const cos = Math.cos(p.angle);
    const sin = Math.sin(p.angle);
    
    // Base shadow offset (deep water behavior)
    // Matches roughly the original linear offset behavior
    const baseOffsetLen = tileSize * cycle.shadowLength; 

    ctx.fillStyle = `rgba(0,0,0,${cycle.shadowAlpha})`;
    ctx.beginPath();

    localPoints.forEach((lp, i) => {
      // 1. Transform local point to world space relative to boat center
      const rx = lp.x * cos - lp.y * sin;
      const ry = lp.x * sin + lp.y * cos;
      const wx = p.x + rx;
      const wy = p.y + ry;

      // 2. Sample river depth at expected shadow location
      // We project out to where the shadow WOULD be in deep water to check the terrain there
      const testX = wx + shadowDir.x * (baseOffsetLen / tileSize);
      const testY = wy + shadowDir.y * (baseOffsetLen / tileSize);
      
      const riverInfo = noise.getRiverSystem(testX, testY);
      
      // Calculate depth factor: 0.0 (shallow/bank) to 1.0 (deep center)
      // riverInfo.value is 0 at center, ~1 at bank
      const depthFactor = Math.max(0, Math.min(1, 1.2 - riverInfo.value)); 
      
      // 3. Determine Shadow Scale (Larger in shallow water)
      // "At the edges... shadow should be closer to the boat and a bit larger"
      // We'll map depthFactor so that in very shallow areas the shadow collapses to near-raft footprint.
      let scale;
      if (depthFactor >= 0.6) {
        // deep water: original subtle scaling
        scale = 1.0;
      } else if (depthFactor >= 0.3) {
        // mid-depth: modest expansion
        scale = 1.0 + (0.6 - depthFactor) * 0.4; // up to ~1.12
      } else {
        // very shallow: keep shadow nearly identical to raft footprint with tiny allowance
        // interpolate from slight oversize to near-exact footprint as depthFactor -> 0
        const u = depthFactor / 0.3; // 0..1
        const oversizeAtEdge = 1.08; // small allowance when beached
        scale = 1.0 + (oversizeAtEdge - 1.0) * (1 - u);
      }
      
      // 4. Determine Shadow Offset (Closer in shallow water)
      // Deep water: uses full baseOffsetLen
      // Shallow water: offset shrinks towards almost zero so shadow sits under raft
      let offsetLen;
      if (depthFactor >= 0.6) {
        offsetLen = baseOffsetLen;
      } else if (depthFactor >= 0.3) {
        // smooth interpolation between full offset and small offset
        const u = (depthFactor - 0.3) / 0.3; // 0..1
        offsetLen = baseOffsetLen * (0.15 + 0.85 * u); // never fully zero here
      } else {
        // very shallow: nearly zero offset so shadow aligns with raft
        // keep a tiny non-zero offset so it can still peek out when beached
        offsetLen = baseOffsetLen * 0.06 * (depthFactor / 0.3 + 0.05);
      }

      // 5. Compute Final Screen Coordinates
      // Apply scaling to the local offset from boat center (simulating shadow spread/size)
      const sx = (wx - state.camera.x) * tileSize + centerX + (rx * tileSize * (scale - 1.0));
      const sy = (wy - state.camera.y) * tileSize + centerY + (ry * tileSize * (scale - 1.0));
      
      const finalX = sx + shadowDir.x * offsetLen;
      const finalY = sy + shadowDir.y * offsetLen;

      if (i === 0) ctx.moveTo(finalX, finalY);
      else ctx.lineTo(finalX, finalY);
    });

    ctx.closePath();
    ctx.fill();
  } 
  // Fallback for when noise isn't ready or shadow is off (though we usually want to skip drawing)
  else if (cycle.shadowAlpha > 0.01 && cycle.shadowLength > 0.0001) {
    // Legacy simple shadow
    ctx.save();
    const shadowLen = cycle.shadowLength;
    ctx.translate(px + shadowDir.x * tileSize * shadowLen, py + shadowDir.y * tileSize * shadowLen);
    ctx.fillStyle = `rgba(0,0,0,${cycle.shadowAlpha})`;
    ctx.rotate(p.angle);
    ctx.fillRect(-tileSize, -tileSize*0.6, tileSize*2, tileSize*1.2);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(px, py);

  ctx.rotate(p.angle);
  const raftLen = tileSize * 1.8;
  const raftWid = tileSize * 1.2;

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(-raftLen/2 + 2, -raftWid/2 + 2, raftLen, raftWid);

  ctx.fillStyle = '#92400e';
  ctx.fillRect(-raftLen/2, -raftWid/2, raftLen, raftWid);

  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const x = -raftLen/2 + (i / 4) * raftLen;
    ctx.beginPath();
    ctx.moveTo(x, -raftWid/2);
    ctx.lineTo(x, raftWid/2);
    ctx.stroke();
  }

  ctx.fillStyle = '#fef3c7';
  const cabinW = raftLen * 0.4;
  const cabinH = raftWid * 0.6;
  ctx.fillRect(-cabinW/2, -cabinH/2, cabinW, cabinH);

  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(-cabinW/4, -cabinH/4, cabinW/2, cabinH/3);

  ctx.fillStyle = '#fef08a';
  ctx.shadowColor = '#fef08a';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(raftLen/2 - 5, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}