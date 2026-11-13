// Directional lightning.
//
// Three separate pieces:
//   * a brief jagged bolt drawn before the rain,
//   * a temporary "lightning sun" that overrides the cast-shadow direction and
//     tree-face lighting for the duration of the flash, and
//   * an additive flash wash drawn after the atmosphere so it brightens
//     everything, including the night/storm tint.
//
// Strikes always use the slowly-drifting storm bearing as their preferred
// direction (with a little jitter), so flashes don't come from random sides of
// the screen. The bolt, the flash wash and the shadows all share that direction.

const SHADOW_LENGTH = 1.25;
const SHADOW_MAX_ALPHA = 0.56;

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

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

// Parse the rgba()/rgb() ambient string produced by daycycle.js and scale only
// its alpha. The lightning flash should reveal the scene, not fight a full
// night/storm tint that is still sitting on top of it.
function scaleAmbientAlpha(ambientColor, scale) {
  if (!ambientColor || ambientColor === 'transparent') return ambientColor;
  const match = ambientColor.match(/^rgba?\(([^)]+)\)$/);
  if (!match) return ambientColor;
  const parts = match[1].split(',').map((part) => Number(part.trim()));
  if (parts.length < 4 || !Number.isFinite(parts[3])) return ambientColor;
  return `rgba(${Math.round(parts[0])},${Math.round(parts[1])},${Math.round(parts[2])},${clamp01(parts[3] * scale)})`;
}

// The strike's 2D direction points *toward* the lightning source. Shadows are
// cast away from it, so the same vector drives both the flash gradient and the
// shadow direction with opposite signs.
export function getLightningLight(state) {
  const L = getLightning(state);
  if (!L) return null;

  const dirLen = Math.hypot(L.dirX, L.dirY) || 1;
  const sourceDirX = L.dirX / dirLen;
  const sourceDirY = L.dirY / dirLen;

  const reducedMotion = Boolean(state.settings && state.settings.reducedMotion);
  const flash = clamp01(L.flash);
  const intensity = flash * (reducedMotion ? 0.55 : 1);
  if (intensity <= 0.005) return null;

  // Face lighting only has a left/right vocabulary, so project the source's
  // horizontal component onto it. A strike from directly above/front is treated
  // as almost fully lit (shadeProgression ~0.5); a side strike lights that side.
  const side = Math.min(1, Math.abs(sourceDirX) * 1.6);
  const shadeProgression = 0.5 - Math.sign(sourceDirX) * 0.34 * side;

  return {
    flash,
    intensity,
    sourceDirX,
    sourceDirY,
    shadowDirX: -sourceDirX,
    shadowDirY: -sourceDirY,
    shadowLength: SHADOW_LENGTH,
    shadowAlpha: SHADOW_MAX_ALPHA * Math.pow(intensity, 0.7),
    shadeProgression: clamp01(shadeProgression),
    // A brief sun should cut through most of the night/storm tint rather than
    // merely paint a translucent sheet over it.
    ambientScale: 1 - 0.78 * Math.pow(intensity, 0.85)
  };
}

// Produce the per-frame cycle used by all object/creature/raft shadow passes.
// During a flash, lightning is the only light source: its shadow direction wins,
// the headlamp is overwhelmed, and the ambient darkness is lifted. The
// direction blends back toward the time-of-day sun over the last part of the
// decay so a daytime flash does not pop the shadows back at the very end.
export function applyLightningCycle(cycle, light) {
  if (!light) return cycle;

  const u = clamp01((light.intensity - 0.05) / 0.45);
  const influence = u * u * (3 - 2 * u);

  const baseX = cycle.shadowDirX || 0;
  const baseY = cycle.shadowDirY || 0;
  let shadowDirX = baseX + (light.shadowDirX - baseX) * influence;
  let shadowDirY = baseY + (light.shadowDirY - baseY) * influence;
  const dirLen = Math.hypot(shadowDirX, shadowDirY);
  if (dirLen < 1e-5) {
    shadowDirX = light.shadowDirX;
    shadowDirY = light.shadowDirY;
  } else {
    shadowDirX /= dirLen;
    shadowDirY /= dirLen;
  }

  const baseShade = typeof cycle.shadeProgression === 'number' ? cycle.shadeProgression : 0.5;
  const baseLength = cycle.shadowLength || 0;
  const headlamp = (cycle.raftLightIntensity || 0) * (1 - Math.min(1, light.intensity * 2.4));

  return {
    ...cycle,
    shadowDirX,
    shadowDirY,
    shadowLength: baseLength + (light.shadowLength - baseLength) * influence,
    shadowAlpha: Math.max(cycle.shadowAlpha || 0, light.shadowAlpha),
    shadeProgression: baseShade + (light.shadeProgression - baseShade) * influence,
    ambientColor: scaleAmbientAlpha(cycle.ambientColor, light.ambientScale),
    raftLightIntensity: headlamp,
    raftLightActive: headlamp > 0.01
  };
}

// The bolt lives near the "horizon" (top of the screen in this oblique
// projection), leaning toward the storm bearing. It is intentionally brief and
// only appears on roughly half of strikes.
export function renderLightningBoltPass(ctx, state) {
  const L = getLightning(state);
  if (!L || L.boltSeed <= 0.55) return;
  // The bolt is drawn hanging from the top of the frame. If the strike's light
  // comes from the lower half of the screen, showing a top bolt would contradict
  // the flash direction, so those strikes read as sheet lightning instead.
  if (L.dirY > 0.15) return;
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
// from. This is the direct light from the temporary sun; the atmosphere pass has
// already been lightened for the same frame so the scene itself reads as lit.
export function renderLightningFlashPass(ctx, state) {
  const light = getLightningLight(state);
  if (!light) return;

  const w = state.width;
  const h = state.height;
  const lift = Math.pow(light.intensity, 1.15);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1;

  // Uniform lift so the entire frame brightens, not just the strike side.
  ctx.fillStyle = `rgba(190, 215, 255, ${0.075 * lift})`;
  ctx.fillRect(0, 0, w, h);

  // Directional sheet-lightning wash, centred toward the source side.
  const cx = w * 0.5 + light.sourceDirX * w * 0.70;
  const cy = h * 0.5 + light.sourceDirY * h * 0.70;
  const radius = Math.hypot(w, h) * 0.95;
  const g = ctx.createRadialGradient(cx, cy, radius * 0.02, cx, cy, radius);
  g.addColorStop(0, `rgba(225, 238, 255, ${0.40 * lift})`);
  g.addColorStop(0.35, `rgba(200, 222, 255, ${0.22 * lift})`);
  g.addColorStop(0.70, `rgba(175, 205, 252, ${0.09 * lift})`);
  g.addColorStop(1, `rgba(150, 180, 240, ${0.02 * lift})`);

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
