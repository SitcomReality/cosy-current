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

  // Compute a time-inside-day metric used to produce shadow length that peaks at noon
  let shadowLength = 0;
  let shadowAlpha = 0;
  let shadowDirX = 0;
  let shadowDirY = 0.4;

  if (dayFactor > 0) {
    // Map t into day progress where 0 at dawnEnd and 1 at duskStart
    const dayInnerStart = dawnEnd;
    const dayInnerEnd = duskStart;
    const dayInnerT = clamp((t - dayInnerStart) / (dayInnerEnd - dayInnerStart), 0, 1);

    // shadow edge: 0 at mid-day, larger at edges -> use distance from noon-like center
    const edge = Math.abs(dayInnerT - 0.5) * 2; // 0..1 where 0=noon, 1=edges
    // Use eased mapping so shadow length smoothly approaches zero at noon and grows towards edges
    shadowLength = smoothstep(0, 1, edge);

    // Make shadows fade with dayFactor so at dawn/dusk they smoothly appear/disappear
    shadowLength *= dayFactor;

    // Shadow alpha should be modest at midday and increase slightly towards edges,
    // then modulated by dayFactor to fade in/out during transitions.
    shadowAlpha = lerp(0.15, 0.45, Math.min(1, 0.35 + edge * 0.65)) * dayFactor;

    // Direction: morning vs afternoon consistent with original design
    const COS_30_DEG = 0.866025;
    const SIN_30_DEG = 0.5;
    const dayT = dayInnerT;
    if (dayT <= 0.5) {
      // Morning: Shadow points NW (150 deg)
      shadowDirX = -COS_30_DEG;
      shadowDirY = SIN_30_DEG;
    } else {
      // Afternoon: Shadow points SE (330 deg)
      shadowDirX = COS_30_DEG;
      shadowDirY = -SIN_30_DEG;
    }
  } else {
    // Night baseline (alpha small; shadow lengths short)
    // We'll still compute a tiny shadow length that can smoothly blend with dawn/dusk ramps later
    const nearDusk = clamp((t - duskEnd) / 0.05, 0, 1);
    const nearDawn = clamp((dawnStart - t) / 0.05, 0, 1);
    shadowLength = 0.25 * (nearDusk + nearDawn) * 0.5;
    shadowAlpha = 0.08;
    shadowDirX = 0;
    shadowDirY = 0.4;
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

