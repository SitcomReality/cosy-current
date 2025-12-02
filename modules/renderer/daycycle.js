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
  // Narrower twilight windows so twilight color blending finishes earlier,
  // leaving a stable night tint between duskEnd and dawnStart.
  const dawnStart = 0.26;
  const dawnEnd = 0.32;   // fully day after this
  const duskStart = 0.68;  // start fading to evening
  const duskEnd = 0.74;    // fully night after this

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
  let edgeFactor = 1;
  if (t > dawnStart && t < duskEnd) {
    const span = (dayMid - dawnStart);
    const dist = Math.abs(t - dayMid);
    edgeFactor = clamp(dist / span, 0, 1); // 0 at noon, 1 near dawnEnd/duskStart
  }
  shadowAlpha = lerp(0.15, 0.45, edgeFactor) * dayFactor;

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

