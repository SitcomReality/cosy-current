import { POOL_WATER, POOL_LAND, POOL_AIR } from './constants.js';
import { createSpawner } from './spawner.js';
import { updateCreatureBehavior } from './behaviors.js';

// Bucket water creatures so schooling/avoidance only looks at nearby
// neighbours. 4-tile cells mean a 3x3 scan covers the largest school radius.
const NEIGHBOR_CELL = 4;
const NEIGHBOR_RADIUS = 10;

function createWaterNeighborLookup(list) {
  if (list.length < 2) return () => null;

  const grid = new Map();
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const key = Math.floor(c.x / NEIGHBOR_CELL) + ',' + Math.floor(c.y / NEIGHBOR_CELL);
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(c);
  }

  const radiusSq = NEIGHBOR_RADIUS * NEIGHBOR_RADIUS;

  return (c) => {
    const cx = Math.floor(c.x / NEIGHBOR_CELL);
    const cy = Math.floor(c.y / NEIGHBOR_CELL);
    const found = [];

    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const bucket = grid.get((cx + ox) + ',' + (cy + oy));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const other = bucket[i];
          if (other === c) continue;
          const dx = other.x - c.x;
          const dy = other.y - c.y;
          if (dx * dx + dy * dy <= radiusSq) found.push(other);
        }
      }
    }

    return found;
  };
}

export function createFaunaSystem({ state, game, noise }) {
  const pools = {
    [POOL_WATER]: [],
    [POOL_LAND]: [],
    [POOL_AIR]: []
  };

  // Pass state to spawner so it can sample around player/view if needed
  const spawner = createSpawner(game, noise, state);
  const DESPAWN_DIST = 130;

  function addCreature(poolName, c) {
    pools[poolName].push(c);
  }

  function update(dt) {
    if (!state.isPlaying) return;
    
    // Spawning
    spawner.update(dt, state, pools, addCreature);

    // Build once per frame, after spawning, so new arrivals are included.
    const getWaterNeighbors = createWaterNeighborLookup(pools[POOL_WATER]);

    // Update & Despawn
    for (const poolName in pools) {
      const arr = pools[poolName];
      const isWater = poolName === POOL_WATER;
      for (let i = arr.length - 1; i >= 0; i--) {
        const c = arr[i];

        // Behavior
        const neighbors = isWater ? getWaterNeighbors(c) : null;
        updateCreatureBehavior(c, dt, noise, game, neighbors);

        // Despawn check
        const d = Math.hypot(c.x - state.player.x, c.y - state.player.y);
        if (d > DESPAWN_DIST) {
          arr.splice(i, 1);
        }
      }
    }
  }

  // Getter for renderer compatibility
  // Concatenates all pools into one list on demand
  return {
    get creatures() {
      return [
        ...pools[POOL_WATER],
        ...pools[POOL_LAND],
        ...pools[POOL_AIR]
      ];
    },
    update
  };
}