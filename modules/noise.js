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

  // Road Generation Constants
  const ROAD_SCALE = 0.002;     // Very large scale for the grid
  const ROAD_WARP = 60.0;       // How much the grid wiggles
  const ROAD_SPACING = 200.0;   // Tiles between roads
  const ROAD_WIDTH = 6.0;       // Half-width of road in tiles

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

  // --- Road System ---
  // Returns { distance, type, vector }
  // distance: 0 = center, 1 = edge, >1 = offroad
  function getRoadInfo(x, y) {
    // 1. Domain Warping
    // We warp the coordinate space to make the grid irregular
    const wx = x + simplex3(x * ROAD_SCALE, y * ROAD_SCALE, 0) * ROAD_WARP;
    const wy = y + simplex3(x * ROAD_SCALE + 100, y * ROAD_SCALE + 100, 0) * ROAD_WARP;

    // 2. Distance to nearest grid lines
    // Coordinates in "Grid Space"
    const gx = wx / ROAD_SPACING;
    const gy = wy / ROAD_SPACING;

    // Distance to nearest integer line (0..0.5)
    const dx = Math.abs(gx - Math.round(gx)); 
    const dy = Math.abs(gy - Math.round(gy));

    // Convert back to world units
    const distX = dx * ROAD_SPACING;
    const distY = dy * ROAD_SPACING;

    // 3. Determine Road Status
    // We are on a road if either dist is small.
    // Intersection if BOTH are small.
    
    // Smooth union for distance field? simple min is fine
    const minDist = Math.min(distX, distY);
    
    // Normalized distance (0 at center, 1 at edge)
    const normDist = minDist / ROAD_WIDTH;

    // Intersection factor (1 = center of intersection, 0 = far from intersection)
    // Intersection happens when both distX and distY are < ROAD_WIDTH * 1.5 roughly
    const intersectionMetric = Math.max(0, 1 - (Math.max(distX, distY) / (ROAD_WIDTH * 3)));

    return {
      value: normDist, // < 1.0 means on road
      isRoad: normDist < 1.0,
      isIntersection: intersectionMetric > 0.1,
      distX,
      distY,
      gx, // warped grid coords, useful for deterministic random choices
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
    getRoadInfo,
    setSeed,
    setConfig,
    getConfig
  };
}