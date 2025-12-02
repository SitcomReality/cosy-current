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

// Updated drawTree: now accepts cycle and shadowDir so tree shading follows sun direction/day phase
export function drawTree(ctx, state, tileSize, tree, treeColors, cycle, shadowDir) {
  const { x: tx, y: ty, h, type } = tree;
  const centerX = state.width / 2;
  const centerY = state.height / 2;
  const sx = (tx - state.camera.x) * tileSize + centerX;
  const sy = (ty - state.camera.y) * tileSize + centerY;
  const baseW = tileSize * 0.4 * h;
  const treeH = tileSize * 1.0 * h;

  // Resolve base (full-light) and dark colors
  const lightColor = type === 'forest' ? treeColors.treeForest : treeColors.treeGrass;
  const darkColor = 'rgba(10,10,10,0.85)'; // deep desaturated shadow color used at night/backside

  // Determine sun direction (sun points opposite of shadow direction)
  const sunX = -shadowDir.x;
  const sunY = -shadowDir.y;

  // dayFactor provided by daycycle: 0 == night, 1 == full day (midday)
  const dayFactor = (cycle && typeof cycle.dayFactor === 'number') ? cycle.dayFactor : 1;

  // If night (dayFactor very low), draw a single flat dark silhouette
  if (dayFactor <= 0.02) {
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.moveTo(sx - baseW/2, sy);
    ctx.lineTo(sx + baseW/2, sy);
    ctx.lineTo(sx, sy - treeH);
    ctx.fill();
    return;
  }

  // Draw base full-light triangle first
  ctx.fillStyle = lightColor;
  ctx.beginPath();
  ctx.moveTo(sx - baseW/2, sy);
  ctx.lineTo(sx + baseW/2, sy);
  ctx.lineTo(sx, sy - treeH);
  ctx.fill();

  // Compute shaded (dark) coverage fraction: 0 at midday, 1 at night
  // Use 1 - dayFactor to get amount of darkness; modulate by sun horizontal contribution so shading enters from correct side smoothly
  const darkness = Math.min(1, Math.max(0, 1 - dayFactor));

  // Horizontal bias of sun: -1 => coming fully from left (light on left), +1 => from right
  const horiz = Math.max(-1, Math.min(1, sunX));

  // Coverage width in pixels (how much of the base is covered by shadow)
  const coverWidth = baseW * darkness;

  // Build dark polygon that covers a tapered portion of the triangle from the side opposite the sun
  // If sun is to the right (horiz>0) the shadow grows from the left edge rightwards; if sun to left, shadow grows from right edge leftwards.
  ctx.fillStyle = darkColor;
  ctx.beginPath();

  const half = baseW / 2;
  if (horiz >= 0) {
    // Light comes from right -> shadow on left, expand rightward by coverWidth
    const shadowRightX = sx - half + Math.min(baseW, coverWidth);
    // Create polygon that covers left base to tip, tapering towards the tip
    ctx.moveTo(sx - half, sy);
    ctx.lineTo(shadowRightX, sy);
    // Interpolate a point towards the tip to make a smooth taper
    ctx.lineTo(sx - half * (1 - (coverWidth/baseW)), sy - treeH * (0.6 + 0.4 * (coverWidth/baseW)));
    ctx.lineTo(sx, sy - treeH);
    ctx.closePath();
    ctx.fill();
  } else {
    // Light comes from left -> shadow on right, expand leftward by coverWidth
    const shadowLeftX = sx + half - Math.min(baseW, coverWidth);
    ctx.moveTo(sx + half, sy);
    ctx.lineTo(shadowLeftX, sy);
    ctx.lineTo(sx + half * (1 - (coverWidth/baseW)), sy - treeH * (0.6 + 0.4 * (coverWidth/baseW)));
    ctx.lineTo(sx, sy - treeH);
    ctx.closePath();
    ctx.fill();
  }

  // Subtle highlight: a thin sliver near the lit edge when dayFactor is high
  if (dayFactor > 0.5) {
    const highlightStrength = (dayFactor - 0.5) * 2; // 0..1
    ctx.fillStyle = `rgba(255,255,255,${0.06 * highlightStrength})`;
    ctx.beginPath();
    if (horiz >= 0) {
      // lit edge on right: sliver near right base
      ctx.moveTo(sx + half - 2, sy);
      ctx.lineTo(sx + half, sy - treeH * 0.05);
      ctx.lineTo(sx + half - 6, sy - treeH * 0.08);
    } else {
      ctx.moveTo(sx - half + 2, sy);
      ctx.lineTo(sx - half, sy - treeH * 0.05);
      ctx.lineTo(sx - half + 6, sy - treeH * 0.08);
    }
    ctx.closePath();
    ctx.fill();
  }
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

export function drawPlayer(ctx, state, tileSize, cycle, shadowDir) {
  const p = state.player;
  const centerX = state.width / 2;
  const centerY = state.height / 2;
  const px = (p.x - state.camera.x) * tileSize + centerX;
  const py = (p.y - state.camera.y) * tileSize + centerY;

  ctx.save();
  ctx.translate(px, py);

  if (cycle.shadowAlpha > 0.01 && cycle.shadowLength > 0.0001) {
    ctx.save();
    const shadowLen = cycle.shadowLength;
    ctx.translate(shadowDir.x * tileSize * shadowLen, shadowDir.y * tileSize * shadowLen);
    ctx.fillStyle = `rgba(0,0,0,${cycle.shadowAlpha})`;
    ctx.rotate(p.angle);
    ctx.fillRect(-tileSize, -tileSize*0.6, tileSize*2, tileSize*1.2);
    ctx.restore();
  }

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