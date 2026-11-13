// Dynamic weather simulation.
//
// The weather has three slow-moving signals:
//   * a rain front (precipitation intensity),
//   * a global wind vector (strength + direction),
//   * a storm bearing that lightning prefers.
//
// These are deliberately simulated in game seconds, not frame counts. The
// renderer only reads state.weather; all of the "what should the weather do
// next" logic lives here.

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(edge0, edge1, x) {
  const u = clamp01((x - edge0) / (edge1 - edge0));
  return u * u * (3 - 2 * u);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// Rain is organised into whole weather cells rather than thresholded noise.
// The previous front noise moved at ~10 s periods (with a ~2.7 s texture on
// top), so a drop could cross the rain threshold and vanish again in under a
// second. These phase lengths give a front time to arrive, settle and leave.
const RAIN_CELL = {
  firstClear: [28, 62],   // seconds before the first rain of a session
  clear: [180, 340],      // long dry spells between fronts
  build: [9, 16],         // rain easing in
  rain: [75, 160],        // sustained rain
  clearing: [16, 26],     // rain easing out
  peak: [0.38, 1.0]       // light showers through heavy storms
};

function setRainPhase(cell, phase, duration, peak) {
  cell.phase = phase;
  cell.duration = duration;
  cell.timer = duration;
  if (typeof peak === 'number') cell.peak = peak;
}

function beginClear(cell, first) {
  const range = first ? RAIN_CELL.firstClear : RAIN_CELL.clear;
  setRainPhase(cell, 'clear', randomBetween(range[0], range[1]), 0);
}

function beginBuild(cell) {
  const peak = randomBetween(RAIN_CELL.peak[0], RAIN_CELL.peak[1]);
  setRainPhase(cell, 'build', randomBetween(RAIN_CELL.build[0], RAIN_CELL.build[1]), peak);
}

function beginRain(cell) {
  setRainPhase(cell, 'rain', randomBetween(RAIN_CELL.rain[0], RAIN_CELL.rain[1]));
}

function beginClearing(cell, fromIntensity) {
  cell.clearingFrom = Math.max(0.0001, fromIntensity || 0);
  setRainPhase(cell, 'clearing', randomBetween(RAIN_CELL.clearing[0], RAIN_CELL.clearing[1]));
}

function createRainCell(first) {
  const cell = {
    phase: 'clear',
    timer: 0,
    duration: 0,
    peak: 0,
    clearingFrom: 0
  };
  beginClear(cell, first);
  return cell;
}

// Frame-rate independent exponential approach.
function approach(current, target, rate, dt) {
  const k = 1 - Math.exp(-rate * dt);
  return current + (target - current) * k;
}

// Shortest-path angular interpolation, so wind doesn't spin the long way
// round when the direction crosses the +/-PI seam.
function angleLerp(a, b, t) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}

export function createWeatherSystem(state, noise) {
  const w = state.weather;

  // Defensive shape upgrade: createAppState() supplies the modern shape, but
  // older sessions/debug snapshots may not.
  if (!w.wind || typeof w.wind !== 'object') {
    w.wind = { x: 0, y: 0, strength: 0, angle: 0 };
  }
  if (typeof w.wind.x !== 'number') w.wind.x = 0;
  if (typeof w.wind.y !== 'number') w.wind.y = 0;
  if (typeof w.wind.strength !== 'number') w.wind.strength = 0;
  if (typeof w.wind.angle !== 'number') w.wind.angle = 0;
  if (!w.lightning) {
    w.lightning = {
      flash: 0, dirX: 0, dirY: 1, sunActive: false, timer: 3, pulses: [], boltSeed: 0, lastStrike: 0, force: false
    };
  }
  if (!Array.isArray(w.lightning.pulses)) w.lightning.pulses = [];
  if (typeof w.lightning.timer !== 'number') w.lightning.timer = 3;
  if (typeof w.lightning.flash !== 'number') w.lightning.flash = 0;
  if (typeof w.lightning.dirX !== 'number') w.lightning.dirX = 0;
  if (typeof w.lightning.dirY !== 'number') w.lightning.dirY = 1;
  if (typeof w.lightning.sunActive !== 'boolean') w.lightning.sunActive = false;
  if (typeof w.lightning.boltSeed !== 'number') w.lightning.boltSeed = 0;
  if (typeof w.lightning.lastStrike !== 'number') w.lightning.lastStrike = 0;
  if (typeof w.lightning.force !== 'boolean') w.lightning.force = false;
  if (typeof w.auto !== 'boolean') w.auto = true;
  if (typeof w.stormBearing !== 'number') w.stormBearing = 0;
  if (typeof w.precipIntensity !== 'number') w.precipIntensity = 0;
  if (typeof w._weatherTime !== 'number') w._weatherTime = 0;
  if (!w._rainCell || typeof w._rainCell !== 'object') {
    w._rainCell = createRainCell(true);
  }
  if (typeof w._rainCell.timer !== 'number') w._rainCell.timer = 0;
  if (typeof w._rainCell.duration !== 'number') w._rainCell.duration = 0;
  if (typeof w._rainCell.peak !== 'number') w._rainCell.peak = 0;
  let wasAuto = Boolean(w.auto);

  // The noise engine multiplies coordinates by state.scale (terrain tuning).
  // Divide that back out so wind/bearing drift keeps a stable rhythm no matter
  // how the terrain scale is configured.
  function weatherNoise(seconds, freq, offset) {
    const scale = state.scale > 0 ? state.scale : 0.05;
    return noise.sample((seconds * freq) / scale, offset, 0);
  }

  // Offset each journey's weather clock from the seed so two fresh starts don't
  // share identical front timing.
  const seedPhase = ((state.seed || 0) % 10000) / 10000;
  const clockOffset = seedPhase * 400;

  function syncWindPolar() {
    const strength = Math.max(0, Math.min(1, w.wind.strength || 0));
    const angle = w.wind.angle || 0;
    w.wind.strength = strength;
    w.wind.x = Math.cos(angle) * strength;
    w.wind.y = Math.sin(angle) * strength;
  }

  function strike() {
    const L = w.lightning;
    // Lightning belongs to the storm cell, not a fresh random direction every
    // flash. Jitter around the slowly-drifting storm bearing.
    const angle = w.stormBearing + (Math.random() - 0.5) * 0.8;
    L.dirX = Math.cos(angle);
    L.dirY = Math.sin(angle);
    L.flash = 1;
    L.boltSeed = Math.random();
    L.lastStrike = w._weatherTime;
    L.sunActive = true;
    L.pulses = [
      { delay: 0.05 + Math.random() * 0.09, strength: 0.55 + Math.random() * 0.35 },
      { delay: 0.16 + Math.random() * 0.18, strength: 0.22 + Math.random() * 0.30 }
    ];
  }

  // Advance the rain cell and return its current target intensity. The phase
  // transitions are one-way and duration-based, so a brief noise wobble cannot
  // flip the weather between raining and clear in the space of a second.
  function updateRainCell(dt, t) {
    const cell = w._rainCell;
    cell.timer -= dt;

    let target = 0;
    if (cell.phase === 'build') {
      const progress = 1 - Math.max(0, cell.timer) / Math.max(0.001, cell.duration);
      target = cell.peak * smoothstep(0, 1, progress);
    } else if (cell.phase === 'rain') {
      // A slow, shallow breath so a sustained front still feels alive without
      // repeatedly crossing back into "dry".
      const texture = weatherNoise(t, 0.035, 8700);
      const breath = 0.92 + 0.08 * clamp01(texture * 0.5 + 0.5);
      target = cell.peak * breath;
    } else if (cell.phase === 'clearing') {
      const progress = 1 - Math.max(0, cell.timer) / Math.max(0.001, cell.duration);
      target = cell.clearingFrom * (1 - smoothstep(0, 1, progress));
    }

    if (cell.timer <= 0) {
      if (cell.phase === 'clear') {
        beginBuild(cell);
      } else if (cell.phase === 'build') {
        beginRain(cell);
      } else if (cell.phase === 'rain') {
        beginClearing(cell, w.precipIntensity);
      } else {
        beginClear(cell, false);
      }
    }

    return clamp01(target);
  }

  // Coming back from manual weather should not teleport the simulation. If the
  // sliders were left raining, resume a front at that level; otherwise begin a
  // normal dry spell.
  function resumeAutoRain() {
    const cell = w._rainCell;
    if (w.precipIntensity > 0.05) {
      const peak = Math.max(w.precipIntensity, 0.5);
      setRainPhase(cell, 'rain', randomBetween(55, 110), peak);
    } else {
      beginClear(cell, false);
    }
  }

  function updateLightning(dt) {
    const L = w.lightning;

    // Main envelope decay plus queued after-pulses. This makes a strike read as
    // a flicker (two or three quick brightening pulses) instead of a single
    // constant glow.
    L.flash = Math.max(0, L.flash - dt * 4.2);
    for (let i = L.pulses.length - 1; i >= 0; i--) {
      const p = L.pulses[i];
      p.delay -= dt;
      if (p.delay <= 0) {
        L.flash = Math.max(L.flash, p.strength);
        L.pulses.splice(i, 1);
      }
    }

    // The temporary sun stays latched for the whole strike, including gaps
    // between after-pulses. Keeping this binary (and holding it until the flash
    // is effectively invisible) is what prevents shadows and the raft lamp from
    // visibly sliding from one light source to the other.
    L.sunActive = L.flash > 0.04 || L.pulses.length > 0;

    // Manual trigger from the dev panel or a test scenario.
    if (L.force) {
      L.force = false;
      strike();
      return;
    }

    L.timer -= dt;
    if (L.timer > 0) return;

    if (w.precipIntensity > 0.5) {
      if (Math.random() < 0.75) strike();
      // Storms flash more often as the rain gets heavier, but never with a
      // machine-gun rhythm.
      L.timer = (5 + Math.random() * 9) * (1.2 - 0.6 * w.precipIntensity);
    } else {
      L.timer = 2 + Math.random() * 4;
    }
  }

  function update(dt) {
    if (!(dt > 0)) return;
    w._weatherTime += dt;
    const t = w._weatherTime + clockOffset;

    // 1. Storm bearing. Slowly wanders; lightning uses it as its preferred
    //    direction. Keeping it independent from the rain cell means the storm
    //    still has a consistent "eye" direction while it builds.
    const bearingX = weatherNoise(t, 0.012, 4100);
    const bearingY = weatherNoise(t, 0.012, 4200);
    if (Math.hypot(bearingX, bearingY) > 0.001) {
      w.stormBearing = Math.atan2(bearingY, bearingX);
    }

    // 2. Rain intensity (automatic mode only; the dev panel owns it manually).
    //    The cell keeps a front alive for minutes instead of letting a short
    //    noise gust turn rain on and off. The exponential approach only smooths
    //    the phase ramps; it is not the source of the front's timing.
    if (w.auto) {
      if (!wasAuto) resumeAutoRain();
      const rainTarget = updateRainCell(dt, t);
      const rate = rainTarget > w.precipIntensity ? 0.70 : 0.30;
      w.precipIntensity = approach(w.precipIntensity, rainTarget, rate, dt);
      if (w.precipIntensity < 0.004) w.precipIntensity = 0;
    }

    // 3. Wind. A slow, calm-biased baseline field, plus a storm component that
    //    grows with rain and pulls the direction toward the storm bearing. The
    //    separate "windiness" noise is important: heavy rain can be relatively
    //    still (a convective downpour), while frontal storms are usually windy.
    const baseX = weatherNoise(t, 0.050, 7100);
    const baseY = weatherNoise(t, 0.050, 9100);
    const gust = clamp01(weatherNoise(t, 0.60, 5300) * 1.8 + 0.5);
    const windiness = clamp01(0.70 + weatherNoise(t, 0.035, 5555) * 1.5);

    const baseMag = clamp01(Math.hypot(baseX, baseY) / 0.60);
    const baseStrength = Math.pow(baseMag, 2.2) * 0.70;
    const baseAngle = Math.atan2(baseY, baseX);

    if (w.auto) {
      const stormWind = clamp01(
        w.precipIntensity * (0.35 + 0.65 * gust) * windiness
      );
      const targetStrength = clamp01(baseStrength + stormWind);
      const targetAngle = angleLerp(baseAngle, w.stormBearing, clamp01(w.precipIntensity * 0.85));
      const targetX = Math.cos(targetAngle) * targetStrength;
      const targetY = Math.sin(targetAngle) * targetStrength;

      w.wind.x = approach(w.wind.x, targetX, 1.1, dt);
      w.wind.y = approach(w.wind.y, targetY, 1.1, dt);
      w.wind.strength = Math.hypot(w.wind.x, w.wind.y);
      w.wind.angle = Math.atan2(w.wind.y, w.wind.x);
    } else {
      // Manual mode: the UI (or a test) owns strength/angle.
      syncWindPolar();
    }

    // 4. Lightning scheduling.
    updateLightning(dt);

    // Remember the mode so re-enabling Auto can resume gracefully.
    wasAuto = Boolean(w.auto);
  }

  return { update };
}

// Exposed for tests/tools that want the same wind conversion as the UI.
export function setWindFromPolar(weather, strength, angle) {
  const s = clamp01(strength);
  weather.wind.strength = s;
  weather.wind.angle = angle;
  weather.wind.x = Math.cos(angle) * s;
  weather.wind.y = Math.sin(angle) * s;
}
