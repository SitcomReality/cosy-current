// Deterministic simulation QA for the automatic rain cycle.
//
//   node scripts/weather-auto-check.mjs
//
// This does not launch a browser. It advances createWeatherSystem() at a fixed
// 10 Hz through one simulated hour and checks that each front:
//   * arrives within a sensible time,
//   * stays raining for at least a minute,
//   * is followed by a long dry spell,
//   * reaches a useful intensity,
//   * does not flicker back and forth at noise speed.
//
// It also verifies that re-enabling Auto after manual rain resumes a front
// instead of immediately cutting to dry.

import { createWeatherSystem } from '../modules/game/weather.js';
import { createNoiseEngine } from '../modules/noise.js';

const HOUR_SECONDS = 3600;
const STEP = 0.1;
const RAIN_THRESHOLD = 0.05;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeState(seed, auto = true) {
  const state = {
    seed,
    scale: 0.05,
    speed: 0.2,
    time: 0,
    weather: {
      precipIntensity: 0,
      wind: { x: 0, y: 0, strength: 0, angle: 0 },
      stormBearing: 0,
      auto,
      _weatherTime: 0
    }
  };
  return state;
}

function simulate(seed) {
  const originalRandom = Math.random;
  Math.random = mulberry32(seed);
  try {
    const state = makeState(seed);
    const noise = createNoiseEngine(state);
    const weather = createWeatherSystem(state, noise);

    let wetTime = 0;
    let wasRaining = false;
    let current = null;
    const fronts = [];

    for (let t = STEP; t <= HOUR_SECONDS; t += STEP) {
      weather.update(STEP);
      const rain = state.weather.precipIntensity;
      const raining = rain > RAIN_THRESHOLD;

      if (raining) {
        wetTime += STEP;
        if (!current) current = { start: t, peak: rain };
        current.peak = Math.max(current.peak, rain);
      }
      if (current && !raining) {
        current.end = t;
        fronts.push(current);
        current = null;
      }
      if (raining && !wasRaining && !current) {
        throw new Error('front bookkeeping lost a rain start');
      }
      wasRaining = raining;
    }
    if (current) {
      current.end = HOUR_SECONDS;
      fronts.push(current);
    }

    return { fronts, wetTime };
  } finally {
    Math.random = originalRandom;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let checked = 0;
for (const seed of [12345, 98765, 24680, 55555, 77777]) {
  const { fronts, wetTime } = simulate(seed);
  assert(fronts.length >= 5 && fronts.length <= 14,
    `seed ${seed}: expected roughly 5-14 fronts in an hour, got ${fronts.length}`);

  const wetFraction = wetTime / HOUR_SECONDS;
  assert(wetFraction >= 0.20 && wetFraction <= 0.60,
    `seed ${seed}: wet fraction ${wetFraction.toFixed(2)} should be 0.20-0.60`);

  for (let i = 0; i < fronts.length; i++) {
    const f = fronts[i];
    // The last front can be cut off by the end of the simulated hour.
    const complete = f.end < HOUR_SECONDS;
    if (complete) {
      const duration = f.end - f.start;
      assert(duration >= 60,
        `seed ${seed}: rain front ${i + 1} lasted only ${duration.toFixed(1)}s`);
    }
    assert(f.peak >= 0.30,
      `seed ${seed}: rain front ${i + 1} peaked at only ${f.peak.toFixed(2)}`);

    if (i > 0) {
      const gap = f.start - fronts[i - 1].end;
      assert(gap >= 90,
        `seed ${seed}: dry spell ${i} lasted only ${gap.toFixed(1)}s`);
    }
  }

  assert(fronts[0].start <= 120,
    `seed ${seed}: first rain should arrive within two minutes, got ${fronts[0].start.toFixed(1)}s`);

  console.log(
    `seed ${seed}: ${fronts.length} fronts, ` +
    `wet ${Math.round(wetFraction * 100)}%, ` +
    `durations ${fronts.map((f) => Math.round(f.end - f.start)).join('/')}s`
  );
  checked++;
}

// Re-enabling Auto while it is manually raining should preserve a front rather
// than snapping to clear. The fade-in/out phases still run their normal ramps.
{
  const originalRandom = Math.random;
  Math.random = mulberry32(424242);
  try {
    const state = makeState(424242, false);
    const noise = createNoiseEngine(state);
    const weather = createWeatherSystem(state, noise);
    state.weather.precipIntensity = 0.65;
    state.weather.auto = true;
    for (let i = 0; i < 50; i++) weather.update(STEP);

    assert(state.weather._rainCell.phase === 'rain',
      `manual-to-auto should resume in rain, got ${state.weather._rainCell.phase}`);
    assert(state.weather.precipIntensity > 0.45,
      `manual-to-auto should not instantly dry out, got ${state.weather.precipIntensity.toFixed(2)}`);
    console.log('manual-to-auto: resumed raining without a snap to dry');
  } finally {
    Math.random = originalRandom;
  }
}

console.log(`\nAuto rain check passed (${checked} simulated hours).`);
