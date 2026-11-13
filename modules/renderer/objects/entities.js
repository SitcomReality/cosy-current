// Entity drawing helpers: influence rings and icons

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

// Draw natural landmark types with straight-line aesthetic
function drawFallenTree(ctx, x, y, size) {
  // Trunk - long horizontal log
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#5c4033';
  ctx.beginPath();
  // Long horizontal trunk
  ctx.moveTo(-size * 1.5, -size * 0.2);
  ctx.lineTo(size * 1.5, -size * 0.2);
  ctx.lineTo(size * 1.5, size * 0.2);
  ctx.lineTo(-size * 1.5, size * 0.2);
  ctx.closePath();
  ctx.fill();
  
  // Branches - short angular protrusions
  ctx.fillStyle = '#4a3728';
  for (let i = -1; i <= 1; i++) {
    const bx = i * size * 0.7;
    const branchH = size * 0.5;
    ctx.beginPath();
    ctx.moveTo(bx, -size * 0.2);
    ctx.lineTo(bx - size * 0.15, -size * 0.2 - branchH);
    ctx.lineTo(bx + size * 0.15, -size * 0.2 - branchH);
    ctx.lineTo(bx + size * 0.3, -size * 0.2);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(bx, size * 0.2);
    ctx.lineTo(bx - size * 0.15, size * 0.2 + branchH);
    ctx.lineTo(bx + size * 0.15, size * 0.2 + branchH);
    ctx.lineTo(bx + size * 0.3, size * 0.2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawRockArch(ctx, x, y, size) {
  // Stone arch - two pillars with a lintel
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#6b7280';
  
  // Left pillar
  ctx.beginPath();
  ctx.moveTo(-size * 0.6, size * 0.8);
  ctx.lineTo(-size * 0.6, -size * 0.2);
  ctx.lineTo(-size * 0.3, -size * 0.2);
  ctx.lineTo(-size * 0.3, size * 0.8);
  ctx.closePath();
  ctx.fill();
  
  // Right pillar
  ctx.beginPath();
  ctx.moveTo(size * 0.3, size * 0.8);
  ctx.lineTo(size * 0.3, -size * 0.2);
  ctx.lineTo(size * 0.6, -size * 0.2);
  ctx.lineTo(size * 0.6, size * 0.8);
  ctx.closePath();
  ctx.fill();
  
  // Lintel (top beam)
  ctx.beginPath();
  ctx.moveTo(-size * 0.7, -size * 0.2);
  ctx.lineTo(size * 0.7, -size * 0.2);
  ctx.lineTo(size * 0.7, -size * 0.5);
  ctx.lineTo(-size * 0.7, -size * 0.5);
  ctx.closePath();
  ctx.fill();
  
  // Highlight on lintel
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(-size * 0.7, -size * 0.5, size * 1.4, size * 0.1);
  ctx.restore();
}

function drawHotSpring(ctx, x, y, size) {
  // Steam vents + pool - all straight lines
  ctx.save();
  ctx.translate(x, y);
  
  // Pool - octagonal
  ctx.fillStyle = '#0ea5e9';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const r = size * 0.6;
    const px = Math.cos(ang) * r;
    const py = Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  
  // Steam - three vertical lines with angular offset
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const sx = i * size * 0.25;
    ctx.beginPath();
    ctx.moveTo(sx, -size * 0.6);
    ctx.lineTo(sx - size * 0.1, -size * 1.2);
    ctx.lineTo(sx + size * 0.1, -size * 1.5);
    ctx.lineTo(sx - size * 0.1, -size * 1.8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRiverConfluence(ctx, x, y, size) {
  // Y-shaped river junction
  ctx.save();
  ctx.translate(x, y);
  
  // Main river stem (vertical)
  ctx.fillStyle = '#0ea5e9';
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, size * 0.8);
  ctx.lineTo(-size * 0.3, -size * 0.1);
  ctx.lineTo(size * 0.3, -size * 0.1);
  ctx.lineTo(size * 0.3, size * 0.8);
  ctx.closePath();
  ctx.fill();
  
  // Left branch
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, -size * 0.1);
  ctx.lineTo(-size * 0.8, -size * 0.6);
  ctx.lineTo(-size * 1.1, -size * 0.5);
  ctx.lineTo(-size * 0.8, -size * 0.3);
  ctx.closePath();
  ctx.fill();
  
  // Right branch
  ctx.beginPath();
  ctx.moveTo(size * 0.3, -size * 0.1);
  ctx.lineTo(size * 0.8, -size * 0.6);
  ctx.lineTo(size * 1.1, -size * 0.5);
  ctx.lineTo(size * 0.8, -size * 0.3);
  ctx.closePath();
  ctx.fill();
  
  // Highlight on water
  ctx.fillStyle = '#7dd3fc';
  ctx.fillRect(-size * 0.3, -size * 0.1, size * 0.6, size * 0.15);
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

    if (ent.type === game.CONSTANTS.ENTITY_LANDMARK) {
      // Draw subtle influence ring
      drawJaggedInfluence(ctx, screenX + tileSize/2, screenY + tileSize/2, influenceRadiusPx, ent.id + '_landmark', {
        outline: true,
        strokeColor: 'rgba(16,185,129,0.35)', // emerald green tint
        lineWidth: 8
      }, edgeFade);
      
      ctx.save();
      ctx.globalAlpha = edgeFade;
      ctx.translate(screenX + tileSize/2, screenY + tileSize/2);
      
      // Draw the landmark based on type
      switch (ent.landmarkType) {
        case game.CONSTANTS.LANDMARK_TYPES.FALLEN_TREE:
          drawFallenTree(ctx, 0, 0, tileSize * 0.5);
          break;
        case game.CONSTANTS.LANDMARK_TYPES.ROCK_ARCH:
          drawRockArch(ctx, 0, 0, tileSize * 0.5);
          break;
        case game.CONSTANTS.LANDMARK_TYPES.HOT_SPRING:
          drawHotSpring(ctx, 0, 0, tileSize * 0.5);
          break;
        case game.CONSTANTS.LANDMARK_TYPES.RIVER_CONFLUENCE:
          drawRiverConfluence(ctx, 0, 0, tileSize * 0.5);
          break;
        default:
          drawFallenTree(ctx, 0, 0, tileSize * 0.5);
      }
      ctx.restore();
    }
    // ENTITY_RELIC decorative markers removed - they're now only collectable items
  });
}