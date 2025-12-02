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
  let ambientColor = 'transparent';

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

    // Ambient tint: gentle warm tint at dawn/dusk, none at mid-day.
    // Use dayFactor and a separate ramp for how strong the tint is near transitions.
    const dawnRamp = smoothstep(dawnStart, dawnEnd, t);
    const duskRamp = 1 - smoothstep(duskStart, duskEnd, t);
    // Combine ramps: positive when near dawn/dusk edges
    const transitionStrength = Math.max(0, Math.max(dawnRamp, duskRamp) * (1 - Math.abs(dayInnerT - 0.5) * 2));
    // Warm tint color for dawn (soft orange) and cool dusk tint (soft purple-ish)
    if (t >= dawnStart && t <= dawnEnd) {
      const p = clamp((t - dawnStart) / (dawnEnd - dawnStart));
      const alpha = 0.45 * (1 - smoothstep(0, 1, p)); // stronger at start of dawn, fades into day
      ambientColor = `rgba(50,20,10,${alpha * (1 - dayInnerT)})`;
    } else if (t >= duskStart && t <= duskEnd) {
      const p = clamp((t - duskStart) / (duskEnd - duskStart));
      const alpha = 0.45 * smoothstep(0, 1, p); // ramps up through dusk
      ambientColor = `rgba(40,10,40,${alpha * (1 - (1 - dayInnerT))})`;
    } else {
      ambientColor = 'rgba(0,0,0,0)';
    }

  } else {
    // Night: minimal faint ambient and tiny baseline shadows for silhouettes
    shadowLength = 0.25 * smoothstep(duskEnd, 1.0, t) + 0.25 * smoothstep(0.0, dawnStart, t);
    shadowAlpha = 0.08;
    shadowDirX = 0;
    shadowDirY = 0.4;
    // Deep night ambient
    ambientColor = 'rgba(10, 10, 30, 0.6)';
    // But if we're inside the dawn/dusk ramp just outside dayFactor, soften night tint
    if (t > duskEnd && t < duskEnd + 0.05) {
      const p = clamp((t - duskEnd) / 0.05);
      ambientColor = `rgba(10,10,30,${0.6 * (1 - smoothstep(0,1,p))})`;
    }
    if (t < dawnStart && t > dawnStart - 0.05) {
      const p = clamp((dawnStart - t) / 0.05);
      ambientColor = `rgba(10,10,30,${0.6 * (1 - smoothstep(0,1,p))})`;
    }
  }

  return { shadowDirX, shadowDirY, shadowLength, shadowAlpha, ambientColor };
}

