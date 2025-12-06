export function renderAtmospherePass(ctx, state, cycle, LIGHT_ANGLE_WIDTH) {
  if (cycle.ambientColor === 'transparent') return;

  ctx.save();
  try {
    const LIGHT_RADIUS = 14;
    const lightIntensity = cycle.raftLightIntensity || 0;
    const effectiveLightRadius = LIGHT_RADIUS * lightIntensity;
    const w = state.width;
    const h = state.height;
    const tileSize = state.tileSize;
    const centerX = w / 2;
    const centerY = h / 2;

    const screenX = (state.player.x - state.camera.x) * tileSize + centerX;
    const screenY = (state.player.y - state.camera.y) * tileSize + centerY;
    const r = effectiveLightRadius * tileSize;
    const a = state.player.angle;
    const halfA = LIGHT_ANGLE_WIDTH;

    ctx.fillStyle = cycle.ambientColor;
    if (!cycle.raftLightActive || effectiveLightRadius <= 0.01) {
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, 0);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();

      ctx.moveTo(screenX, screenY);
      ctx.arc(screenX, screenY, r, a - halfA, a + halfA, false);
      ctx.closePath();

      ctx.fill('evenodd');

      const g = ctx.createRadialGradient(screenX, screenY, r * 0.35, screenX, screenY, r);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, cycle.ambientColor);

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.6 * lightIntensity;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(screenX, screenY, r, a - halfA, a + halfA, false);
      ctx.lineTo(screenX, screenY);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  } finally {
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }
}

