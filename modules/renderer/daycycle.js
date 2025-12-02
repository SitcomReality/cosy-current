// Day/night cycle and shadow math utilities

export function advanceDayTime(state) {
  state.dayTime = (state.dayTime + state.daySpeed * 0.01) % 1.0;
}

export function getCycleProps(state) {
  const t = state.dayTime;

  // Helper utilities
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smoothstep = (edge0, edge1, x) => {
    const v = clamp((x - edge0) / (edge1 - edge0));
    return v * v * (3 - 2 * v);
  };
  const lerp = (a, b, u) => a + (b - a) * u;

  // Define transition windows (a bit extended to allow gentle fades)
  const dawnStart = 0.18;
  const dawnEnd = 0.30;   // fully day after this
  const duskStart = 0.70;  // start fading to evening
  const duskEnd = 0.82;    // fully night after this

  // Determine normalized progress through day (0..1 where 1 is full daytime)
  let dayFactor = 0;
  if (t <= dawnStart || t >= duskEnd) {
    dayFactor = 0; // night
  } else if (t >= dawnEnd && t <= duskStart) {
    dayFactor = 1; // full day
  } else if (t > dawnStart && t < dawnEnd) {
    // dawn ramp up (0->1)
    dayFactor = smoothstep(dawnStart, dawnEnd, t);
  } else if (t > duskStart && t < duskEnd) {
    // dusk ramp down (1->0)
    dayFactor = 1 - smoothstep(duskStart, duskEnd, t);
  }

  // Compute shadow properties:
  // We want shadows to be longest near sunrise and near night (opposite ends),
  // and shortest at mid-day. The direction flips from morning -> afternoon.
  // Use a continuous function over the full 0..1 day where distanceFromNoon
  // is 0 at t=0.5 (noon) and 1 at t=0 or 1 (midnight), producing max length at edges.
  const distanceFromNoon = Math.abs(t - 0.5) * 2; // 0 at noon, 1 at midnight/edges
  // Eased length so it smoothly goes to zero at noon and peaks at edges
  let shadowLength = smoothstep(0, 1, distanceFromNoon);

  // Shadow alpha follows length but we still want shadows to fade during dawn/dusk transitions.
  // Compute a visibility multiplier that raises shadow visibility during night/dawn/dusk and
  // reduces it slightly during the moments the color tint is strongest (middle of dawn/dusk).
  const transitionFade = Math.max(
    smoothstep(dawnStart - 0.05, dawnEnd + 0.05, t),
    1 - smoothstep(duskStart - 0.05, duskEnd + 0.05, t)
  );
  // When fully day, keep shadows modest; when near edges/night, let them be stronger.
  const visibilityMul = lerp(0.6, 1.0, distanceFromNoon) * Math.max(0.25, transitionFade);

  shadowLength *= visibilityMul;

  // Shadow alpha baseline maps from modest at mid-day to stronger near edges
  let shadowAlpha = lerp(0.12, 0.55, shadowLength);
  // Ensure alpha still respects dayFactor fades (so very deep night isn't unrealistically lit)
  shadowAlpha *= Math.max(0.25, dayFactor + 0.25);

  // Direction: morning vs afternoon consistent with design; morning when local day-progress < 0.5
  const COS_30_DEG = 0.866025;
  const SIN_30_DEG = 0.5;
  // Map t into a circular day progress where 0..0.5 is morning->noon, 0.5..1 is noon->night
  const dayInnerT = (t >= 0 && t <= 1) ? t : (t % 1);
  let shadowDirX = COS_30_DEG;
  let shadowDirY = -SIN_30_DEG;
  if (dayInnerT <= 0.5) {
    // Morning: Shadow points NW (150 deg)
    shadowDirX = -COS_30_DEG;
    shadowDirY = SIN_30_DEG;
  } else {
    // Afternoon/Night: Shadow points SE (330 deg)
    shadowDirX = COS_30_DEG;
    shadowDirY = -SIN_30_DEG;
  }

  // Ambient tint computation: blend night, dawn, dusk, and day continuously to avoid snapping.
  // Define color anchors as numeric RGBA
  const nightColor = { r: 10, g: 10, b: 30, a: 0.6 };
  const dayColor   = { r: 0,  g: 0,  b: 0,  a: 0.0 };
  const dawnTint   = { r: 50, g: 20, b: 10, a: 0.45 };
  const duskTint   = { r: 40, g: 10, b: 40, a: 0.45 };

  // Ramps for transitions
  const dawnRampRaw = smoothstep(dawnStart, dawnEnd, t); // 0 -> 1 during dawn window
  const duskRampRaw = smoothstep(duskStart, duskEnd, t); // 0 -> 1 during dusk window

  // DayRamp is already dayFactor (0..1)
  const dayRamp = dayFactor;

  // Night weight: when not fully day and not in strong dawn/dusk
  // Use remaining weight so all weights sum sensibly
  let wDawn = dawnRampRaw;
  let wDusk = duskRampRaw;
  let wDay  = dayRamp;
  // Night gets the leftover but ensure it's non-negative
  let wNight = Math.max(0, 1 - Math.max(wDawn, wDusk, wDay));

  // Normalize weights so interpolation is smooth and no color jumps
  const sumW = wDawn + wDusk + wDay + wNight;
  const nw = sumW > 0 ? 1 / sumW : 0;
  wDawn *= nw; wDusk *= nw; wDay *= nw; wNight *= nw;

  // Weighted blend of RGBA channels
  const r = Math.round(wNight * nightColor.r + wDay * dayColor.r + wDawn * dawnTint.r + wDusk * duskTint.r);
  const g = Math.round(wNight * nightColor.g + wDay * dayColor.g + wDawn * dawnTint.g + wDusk * duskTint.g);
  const b = Math.round(wNight * nightColor.b + wDay * dayColor.b + wDawn * dawnTint.b + wDusk * duskTint.b);
  const a = (wNight * nightColor.a + wDay * dayColor.a + wDawn * dawnTint.a + wDusk * duskTint.a);

  const ambientColor = `rgba(${r},${g},${b},${a})`;

  return { shadowDirX, shadowDirY, shadowLength, shadowAlpha, ambientColor };
}

