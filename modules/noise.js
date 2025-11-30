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
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0
  };

  let type = state.noiseType || 'fbm-perlin';
  let config = Object.assign({}, DEFAULT_CONFIG);
  let seed = state.seed || Date.now();

  // Initialize permutation table with seed
  seedPermutation(seed);

  function setSeed(s) {
    seed = s || Date.now();
    state.seed = seed;
    seedPermutation(seed);
  }

  function setType(t) {
    type = t;
    state.noiseType = t;
  }

  function setConfig(cfg = {}) {
    config = Object.assign({}, config, cfg);
  }

  function getConfig() {
    return Object.assign({}, config);
  }

  // Core sampling function: accepts world coords in tiles or units.
  // x,y are spatial coords; t is optional time (defaults to state.time)
  function sample(x, y, t = state.time || 0) {
    // Apply global scale from state
    const s = (state.scale && state.scale > 0) ? state.scale : 0.05;
    const zx = x * s;
    const zy = y * s;
    const zt = t * (state.speed || 1.0) * s;

    let v = 0;

    switch (type) {
      case 'simplex':
        v = simplex3(zx, zy, zt);
        break;
      case 'perlin':
        v = perlin3(zx, zy, zt);
        break;
      case 'fbm-simplex':
        v = fbm3(zx, zy, zt, simplex3, config);
        break;
      case 'fbm-perlin':
      default:
        v = fbm3(zx, zy, zt, perlin3, config);
        break;
    }

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

  return {
    sample,
    sample2D,
    setType,
    setSeed,
    setConfig,
    getConfig
  };
}