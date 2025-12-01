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

  // River Generation Constants
  const RIVER_SCALE = 0.0015;    // Scale for the river network grid
  const RIVER_WARP = 150.0;      // High warp for meandering rivers
  const RIVER_SPACING = 300.0;   // Tiles between river branches

  // Base & variation: we'll compute a local width per-location using low-frequency FBM
  const RIVER_BASE = 7.5;   // central tendency (mode near 7-8)
  const RIVER_VAR = 2.5;    // +/- range to reach ~5..10

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

    // 1.5 Compute a local river half-width using low-frequency FBM so width varies smoothly
    // Use a different coordinate offset and low frequency so widths change slowly over space.
    // fbm3 returns roughly -1..1; map that to +/- RIVER_VAR around RIVER_BASE and clamp.
    const widthNoise = fbm3(wx * 0.0025, wy * 0.0025, 300, perlin3, { octaves: 3, persistence: 0.6, lacunarity: 2 });
    let localHalfWidth = RIVER_BASE + widthNoise * RIVER_VAR;
    // Keep widths within reasonable bounds (half-width)
    localHalfWidth = Math.max(5, Math.min(10, localHalfWidth));

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
    
    // Use localHalfWidth (in tiles) for normalization so rivers vary in width
    const normDist = minDist / localHalfWidth;

    // Intersection factor uses the local width so wider sections create broader intersection zones
    const intersectionMetric = Math.max(0, 1 - (Math.max(distX, distY) / (localHalfWidth * 4.0)));

    return {
      value: normDist, 
      isRiver: normDist < 1.0,
      isIntersection: intersectionMetric > 0.1,
      distX,
      distY,
      gx, 
      gy,
      localHalfWidth
    };
  }

  // Small helper to sample a 2D static noise (time-free)
  function sample2D(x, y) {
    return sample(x, y, 0);
  }

  // Expose river info for game logic (compatibility wrapper)
  // Returns an object compatible with game usage
  function getRoadInfo(x, y) {
    const r = getRiverSystem(x, y);
    return {
      distX: r.distX,
      distY: r.distY,
      value: r.value,
      isRoad: r.isRiver, // "road" is actually river in this context
      isIntersection: r.isIntersection,
      gx: r.gx,
      gy: r.gy
    };
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
    getRoadInfo, // Compatibility - actually returns river info
    setSeed,
    setConfig,
    getConfig
  };
}