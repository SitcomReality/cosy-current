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

export function drawEntities(ctx, state, tileSize, game, centerX, centerY, light) {
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