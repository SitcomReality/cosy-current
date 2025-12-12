import { CREATURE_DEFS, POOL_WATER, POOL_LAND, POOL_AIR } from '../constants.js';
import { randomRange } from '../utils.js';
import { estimateWaterCoverage, getWeightedRandomType, getOffscreenSpawnPosition } from './utils.js';
import { attemptSpawn as attemptSpawnImpl } from './attemptSpawn.js';

// Caps and Rates (kept same as previous)
const POOL_CONFIG = {
  [POOL_WATER]: { cap: 60, interval: 0.22 },
  [POOL_LAND]:  { cap: 35, interval: 0.35 },
  [POOL_AIR]:   { cap: 25, interval: 0.55 }
};

export function createSpawner(game, noise, state) {
  const timers = {
    [POOL_WATER]: 0,
    [POOL_LAND]: 0,
    [POOL_AIR]: 0
  };

  // Shared map for group phases (keeps deterministic-ish groups)
  const groupPhaseMap = new Map();

  function attemptSpawn(poolName, player, dayTime, addCreature) {
    attemptSpawnImpl({
      poolName, player, dayTime, addCreature,
      game, noise, state, CREATURE_DEFS, groupPhaseMap, randomRange
    });
  }

  function update(dt, stateArg, pools, addCreature) {
    const player = stateArg.player;
    const dayTime = stateArg.dayTime;

    for (const poolName of [POOL_WATER, POOL_LAND, POOL_AIR]) {
      timers[poolName] += dt;
      const cfg = POOL_CONFIG[poolName];

      if (timers[poolName] >= cfg.interval) {
        timers[poolName] = 0;
        if (pools[poolName].length < cfg.cap) {
          if (poolName === POOL_WATER) {
            const tileSize = stateArg.tileSize || 64;
            const halfW = (stateArg.width / 2) / tileSize;
            const halfH = (stateArg.height / 2) / tileSize;
            const radius = Math.max(halfW, halfH) + 10;
            const coverage = estimateWaterCoverage(game, noise, player, radius);
            const spawnChance = Math.max(0.35, 0.35 + coverage * 0.65);
            if (Math.random() < spawnChance) {
              attemptSpawn(poolName, player, dayTime, addCreature);
            }
          } else {
            attemptSpawn(poolName, player, dayTime, addCreature);
          }
        }
      }
    }
  }

  return { update };
}

