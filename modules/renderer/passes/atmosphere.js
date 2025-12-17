export function renderAtmospherePass(ctx, state, cycle, LIGHT_ANGLE_WIDTH) {
  if (cycle.ambientColor === 'transparent') return;

  ctx.save();
  try {
    const LIGHT_RADIUS = 14;
    const lightIntensity = cycle.raftLightIntensity || 0;
    const w = state.width;
    const h = state.height;
    const tileSize = state.tileSize;
    const centerX = w / 2;
    const centerY = h / 2;

    const screenX = (state.player.x - state.camera.x) * tileSize + centerX;
    const screenY = (state.player.y - state.camera.y) * tileSize + centerY;
    const a = state.player.angle;
    const halfA = LIGHT_ANGLE_WIDTH;

    // Determine light shape and radius based on light type
    const lightType = (state.raft && state.raft.lightType) || 'cone';
    let effectiveRadius = LIGHT_RADIUS;
    let isRadial = false;

    if (lightType === 'beam') {
      effectiveRadius = LIGHT_RADIUS * 1.4; // Longer range
    } else if (lightType === 'radial') {
      effectiveRadius = LIGHT_RADIUS * 0.8; // Shorter range but all directions
      isRadial = true;
    }

    const effectiveLightRadius = effectiveRadius * lightIntensity;
    const r = effectiveLightRadius * tileSize;

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

      if (isRadial) {
        // Radial light: full 360° circle
        ctx.moveTo(screenX, screenY);
        ctx.arc(screenX, screenY, r, 0, Math.PI * 2, false);
      } else {
        // Cone/Beam light: directional arc
        ctx.moveTo(screenX, screenY);
        ctx.arc(screenX, screenY, r, a - halfA, a + halfA, false);
      }
      ctx.closePath();

      ctx.fill('evenodd');

      const g = ctx.createRadialGradient(screenX, screenY, r * 0.35, screenX, screenY, r);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, cycle.ambientColor);

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.6 * lightIntensity;
      ctx.fillStyle = g;
      ctx.beginPath();
      if (isRadial) {
        ctx.arc(screenX, screenY, r, 0, Math.PI * 2, false);
      } else {
        ctx.arc(screenX, screenY, r, a - halfA, a + halfA, false);
      }
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

