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

  // Compute continuous shadow properties independent of color filtering
  let shadowLength = 0;
  let shadowAlpha = 0;
  let shadowDirX = 0;
  let shadowDirY = 0.4;

  // Define daytime center between dawnEnd and duskStart
  const dayInnerStart = dawnEnd;
  const dayInnerEnd = duskStart;
  const dayMid = (dayInnerStart + dayInnerEnd) * 0.5;

  // Base shadow length:
  // - Max at dawnStart and duskEnd
  // - Shrinks smoothly to 0 at midday (dayMid)
  // - Does NOT shrink/grow again during night; it just stays "max" but is hidden by alpha.
  let shadowLengthBase = 1;

  if (t > dawnStart && t < dayMid) {
    // Morning: shrink from max at dawnStart to 0 at dayMid
    const u = clamp((t - dawnStart) / (dayMid - dawnStart), 0, 1); // 0 at dawnStart, 1 at dayMid
    const edge = 1 - u; // 1 -> 0
    shadowLengthBase = smoothstep(0, 1, edge);
  } else if (t >= dayMid && t < duskEnd) {
    // Afternoon: grow from 0 at dayMid to max at duskEnd
    const u = clamp((t - dayMid) / (duskEnd - dayMid), 0, 1); // 0 at dayMid, 1 at duskEnd
    const edge = u; // 0 -> 1
    shadowLengthBase = smoothstep(0, 1, edge);
  } else {
    // Night segments before dawnStart or after duskEnd: keep at max length
    shadowLengthBase = 1;
  }

  shadowLength = shadowLengthBase;

  // Shadow alpha: fade in/out with dayFactor, and strengthen slightly near morning/evening
  // We want shadows to be STRONGEST at midday and only fade toward dawn/dusk/night.
  // edgeFactor is 0 at noon and grows toward 1 near the edges; invert it so 1 => noon.
  const noonFactor = 1 - edgeFactor;
  shadowAlpha = lerp(0.15, 0.45, noonFactor) * dayFactor;

  // Direction: morning vs afternoon consistent with original design
  const COS_30_DEG = 0.866025;
  const SIN_30_DEG = 0.5;
  if (t <= dayMid) {
    // Morning: Shadow points NW (150 deg)
    shadowDirX = -COS_30_DEG;
    shadowDirY = SIN_30_DEG;
  } else {
    // Afternoon / evening: Shadow points SE (330 deg)
    shadowDirX = COS_30_DEG;
    shadowDirY = -SIN_30_DEG;
  }

  // Ambient tint computation with explicit phases so that full night
  // is a constant tint from duskEnd until dawnStart.
  const nightColor = { r: 10, g: 10, b: 30, a: 0.6 };
  const dayColor   = { r: 0,  g: 0,  b: 0,  a: 0.0 };
  const dawnTint   = { r: 50, g: 20, b: 10, a: 0.45 };
  const duskTint   = { r: 40, g: 10, b: 40, a: 0.45 };

  const mix = (c1, c2, u) => ({
    r: Math.round(lerp(c1.r, c2.r, u)),
    g: Math.round(lerp(c1.g, c2.g, u)),
    b: Math.round(lerp(c1.b, c2.b, u)),
    a: lerp(c1.a, c2.a, u)
  });

  let col;
  if (t <= dawnStart || t >= duskEnd) {
    // Full night: constant deep-night color (shadows already gone here)
    col = nightColor;
  } else if (t > dawnStart && t < dawnEnd) {
    // Dawn: smooth blend from night -> day
    const u = smoothstep(dawnStart, dawnEnd, t); // 0..1
    col = mix(nightColor, dayColor, u);
  } else if (t >= dawnEnd && t <= duskStart) {
    // Full day
    col = dayColor;
  } else if (t > duskStart && t < duskEnd) {
    // Dusk: smooth blend from day -> night
    const u = smoothstep(duskStart, duskEnd, t); // 0..1
    col = mix(dayColor, nightColor, u);
  } else {
    // Fallback (shouldn't hit due to ranges) – treat as night
    col = nightColor;
  }

  const ambientColor = `rgba(${col.r},${col.g},${col.b},${col.a})`;

  // Calculate shading factor for tree geometry
  let shadeProgression = 0; 
  if (t >= dawnStart && t <= duskEnd) {
      // 0.18 -> 0.82 is the active day period for shading
      const activeSpan = duskEnd - dawnStart;
      shadeProgression = clamp((t - dawnStart) / activeSpan, 0, 1); // 0 at dawnStart, 1 at duskEnd
  }

  return { shadowDirX, shadowDirY, shadowLength, shadowAlpha, ambientColor, shadeProgression };
}

