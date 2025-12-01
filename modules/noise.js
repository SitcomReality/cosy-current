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

  // Road Generation Constants -> River Generation Constants
  const RIVER_SCALE = 0.0015;    // Scale for the river network grid
  const RIVER_WARP = 150.0;      // High warp for meandering rivers
  const RIVER_SPACING = 300.0;   // Tiles between river branches
  const RIVER_WIDTH = 25.0;      // Half-width of river channel in tiles

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
    // We reduce the default scale significantly to make features larger/smoother
    const s = (state.scale && state.scale > 0) ? state.scale : 0.002;
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

  // --- River System ---
  // Returns { value, isRiver, isIntersection, distX, distY, ... }
  // value: Normalized distance from center (0=center, 1=bank edge)
  function getRiverSystem(x, y) {
    // 1. Domain Warping for organic river paths
    const wx = x + simplex3(x * RIVER_SCALE, y * RIVER_SCALE, 0) * RIVER_WARP;
    const wy = y + simplex3(x * RIVER_SCALE + 100, y * RIVER_SCALE + 100, 0) * RIVER_WARP;

    // 2. Distance to nearest grid lines
    const gx = wx / RIVER_SPACING;
    const gy = wy / RIVER_SPACING;

    // Distance to nearest integer line
    const dx = Math.abs(gx - Math.round(gx)); 
    const dy = Math.abs(gy - Math.round(gy));

    // Convert back to world units
    const distX = dx * RIVER_SPACING;
    const distY = dy * RIVER_SPACING;

    // 3. Determine River Status
    // River is the union of the grid lines (Voronoi edges in this metric)
    const minDist = Math.min(distX, distY);
    
    // Normalized distance (0 at center, 1.0 at defined width edge)
    // We allow it to go > 1.0 for terrain generation purposes
    const normDist = minDist / RIVER_WIDTH;

    // Intersection factor
    const intersectionMetric = Math.max(0, 1 - (Math.max(distX, distY) / (RIVER_WIDTH * 4.0)));

    return {
      value: normDist, 
      isRiver: normDist < 1.0,
      isIntersection: intersectionMetric > 0.1,
      distX,
      distY,
      gx, 
      gy
    };
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
    getRiverSystem,
    setSeed,
    setConfig,
    getConfig
  };
}