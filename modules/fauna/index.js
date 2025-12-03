import { POOL_WATER, POOL_LAND, POOL_AIR } from './constants.js';
import { createSpawner } from './spawner.js';
import { updateCreatureBehavior } from './behaviors.js';

export function createFaunaSystem({ state, game, noise }) {
  const pools = {
    [POOL_WATER]: [],
    [POOL_LAND]: [],
    [POOL_AIR]: []
  };

  const spawner = createSpawner(game, noise);
  const DESPAWN_DIST = 130;

  function addCreature(poolName, c) {
    pools[poolName].push(c);
  }

  function update(dt) {
    if (!state.isPlaying) return;
    
    // Spawning
    spawner.update(dt, state.dayTime, state.player, pools, addCreature);

    // Update & Despawn
    for (const poolName in pools) {
      const arr = pools[poolName];
      for (let i = arr.length - 1; i >= 0; i--) {
        const c = arr[i];
        
        // Behavior
        updateCreatureBehavior(c, dt, noise, game);

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