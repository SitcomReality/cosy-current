// Directional lightning.
//
// Two separate pieces:
//   * a brief jagged bolt drawn before the rain, and
//   * an additive flash wash drawn after the atmosphere so it brightens
//     everything, including the night/storm tint.
//
// Strikes always use the slowly-drifting storm bearing as their preferred
// direction (with a little jitter), so flashes don't come from random sides of
// the screen.

function makeRng(seed) {
  let s = Math.floor(seed * 1e9) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function getLightning(state) {
  const w = state.weather;
  if (!w || !w.lightning) return null;
  const L = w.lightning;
  if (!(L.flash > 0.01)) return null;
  return L;
}

// The bolt lives near the "horizon" (top of the screen in this oblique
// projection), leaning toward the storm bearing. It is intentionally brief and
// only appears on roughly half of strikes.
export function renderLightningBoltPass(ctx, state) {
  const L = getLightning(state);
  if (!L || L.boltSeed <= 0.55) return;
  if (state.settings && state.settings.reducedMotion) return;

  const w = state.width;
  const h = state.height;
  const flash = Math.min(1, L.flash);
  const alpha = flash * 0.50;

  const rng = makeRng(L.boltSeed);
  const startX = w * 0.5 + L.dirX * w * 0.38;
  const startY = -10;
  const endX = w * 0.5 + L.dirX * w * 0.52 + (rng() - 0.5) * w * 0.07;
  const endY = h * 0.28;

  const segments = 7;
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const taper = Math.sin(u * Math.PI); // 0 at both ends, max in the middle
    const jitter = (rng() - 0.5) * w * 0.075 * taper;
    points.push({
      x: startX + (endX - startX) * u + jitter,
      y: startY + (endY - startY) * u + (rng() - 0.5) * h * 0.018 * taper
    });
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  // Wide, faint glow.
  ctx.strokeStyle = `rgba(190, 215, 255, ${alpha * 0.22})`;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();

  // Narrow core.
  ctx.strokeStyle = `rgba(235, 245, 255, ${alpha})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();

  ctx.restore();
}

// Additive flash, brightest on the side of the screen the strike is coming
// from. This is what makes the whole scene lift for a moment at night.
export function renderLightningFlashPass(ctx, state) {
  const L = getLightning(state);
  if (!L) return;

  const w = state.width;
  const h = state.height;
  const reducedMotion = state.settings && state.settings.reducedMotion;
  const flash = Math.min(1, L.flash) * (reducedMotion ? 0.45 : 1);
  const lift = Math.pow(flash, 1.35);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1;

  // Uniform lift so the entire frame brightens, not just the strike side.
  // Keep this modest: the directional gradient does most of the work.
  ctx.fillStyle = `rgba(190, 215, 255, ${0.035 * lift})`;
  ctx.fillRect(0, 0, w, h);

  // Directional sheet-lightning wash.
  const cx = w * 0.5 + L.dirX * w * 0.70;
  const cy = h * 0.5 + L.dirY * h * 0.70;
  const radius = Math.hypot(w, h) * 0.95;
  const g = ctx.createRadialGradient(cx, cy, radius * 0.02, cx, cy, radius);
  g.addColorStop(0, `rgba(220, 235, 255, ${0.30 * lift})`);
  g.addColorStop(0.35, `rgba(195, 220, 255, ${0.16 * lift})`);
  g.addColorStop(0.70, `rgba(170, 200, 250, ${0.06 * lift})`);
  g.addColorStop(1, `rgba(150, 180, 240, ${0.01 * lift})`);

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
