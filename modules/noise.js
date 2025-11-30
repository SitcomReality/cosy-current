import { perlin3 } from './noise_algorithms/perlin.js';
import { simplex3 } from './noise_algorithms/simplex.js';
import { fbm3 } from './noise_algorithms/fbm.js';
import { seedPermutation } from './noise_algorithms/permutations.js';

/*
  createNoiseEngine(state)
  - state: shared app state (used for defaults like scale, time, seed)
  Returns an object:
    sample(x, y, t?) -> noise value (-1..1 approx)
    setType(type)
    setSeed(seed)
    setConfig(cfg)
    getConfig()
*/
export function createNoiseEngine(state) {
  const DEFAULT_CONFIG = {
    octaves: 5,
    persistence: 0.55,
    lacunarity: 2.1
  };

  // We now always use a single, tuned FBM-Perlin setup
  let config = Object.assign({}, DEFAULT_CONFIG);
  let seed = state.seed || Date.now();

  // Initialize permutation table with seed
  seedPermutation(seed);

  function setSeed(s) {
    seed = s || Date.now();
    state.seed = seed;
    seedPermutation(seed);
  }

  // Core sampling function: accepts world coords in tiles or units.
  // x,y are spatial coords; t is optional time (defaults to state.time)
  function sample(x, y, t = state.time || 0) {
    // Apply global scale from state
    const s = (state.scale && state.scale > 0) ? state.scale : 0.008;
    const zx = x * s;
    const zy = y * s;
    const zt = t * (state.speed || 0.2) * s;

    // Single unified terrain noise
    let v = fbm3(zx, zy, zt, perlin3, config);

    // Ensure numeric and roughly in [-1,1]
    if (!isFinite(v)) v = 0;
    if (v > 1) v = 1;
    if (v < -1) v = -1;
    return v;
  }

  // Small helper to sample a 2D static noise (time-free)
  function sample2D(x, y) {
    return sample(x, y, 0);
  }

  function setConfig(cfg = {}) {
    config = Object.assign({}, config, cfg);
  }

  function getConfig() {
    return Object.assign({}, config);
  }

  return {
    sample,
    sample2D,
    setSeed,
    setConfig,
    getConfig
  };
}