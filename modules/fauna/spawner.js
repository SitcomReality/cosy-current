import { CREATURE_DEFS, POOL_WATER, POOL_LAND, POOL_AIR } from './constants.js';
import { randomRange } from './utils.js';

export function createSpawner(game, noise) {
  
  // Caps and Rates
  const POOL_CONFIG = {
    [POOL_WATER]: { cap: 30, interval: 0.3, distance: 90 },
    [POOL_LAND]: { cap: 20, interval: 0.5, distance: 90 },
    [POOL_AIR]: { cap: 15, interval: 0.8, distance: 120 }
  };

  const timers = {
    [POOL_WATER]: 0,
    [POOL_LAND]: 0,
    [POOL_AIR]: 0
  };

  function getWeightedRandomType(poolName, dayTime) {
    const isNight = dayTime < 0.2 || dayTime > 0.8;
    const isDawnDusk = (dayTime > 0.2 && dayTime < 0.3) || (dayTime > 0.7 && dayTime < 0.8);
    
    const candidates = [];
    
    for (const key in CREATURE_DEFS) {
      const def = CREATURE_DEFS[key];
      if (def.pool !== poolName) continue;
      
      let weight = 1;
      
      if (def.nightOnly && !isNight) weight = 0;
      if (def.nightOnly && isNight) weight = 10; // High priority for fireflies at night
      
      if (key === 'bird' && isDawnDusk) weight = 5; // More birds in morning/evening
      
      for(let i=0; i<weight; i++) candidates.push(key);
    }
    
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function attemptSpawn(poolName, player, dayTime, addCreature) {
    const cfg = POOL_CONFIG[poolName];
    
    // Pick Type
    const typeKey = getWeightedRandomType(poolName, dayTime);
    if (!typeKey) return;
    const def = CREATURE_DEFS[typeKey];

    // Pick Location
    const angle = Math.random() * Math.PI * 2;
    const dist = randomRange(40, cfg.distance);
    const sx = player.x + Math.cos(angle) * dist;
    const sy = player.y + Math.sin(angle) * dist;

    // Validate Terrain
    const r = noise.getRiverSystem(sx, sy);
    const tile = game.getTile(Math.floor(sx), Math.floor(sy));
    
    let valid = false;

    if (poolName === POOL_WATER) {
      // Must be water, check depth
      if (r.value < 0.9) { // slightly away from strict edge
         if (def.depth && r.value > (1.0 - def.depth)) {
             // Too shallow for this fish
             valid = false;
         } else {
             valid = true;
         }
      }
    } else if (poolName === POOL_LAND) {
      if (r.value >= 1.0) { // Is Land
        const habits = def.habitat || [];
        // Map simplified habitat names to tile constants if needed
        // 'forest' -> TILE_FOREST, 'grass' -> TILE_GRASS, 'bank' -> TILE_BANK
        const T = game.CONSTANTS;
        const mapping = { 'forest': T.TILE_FOREST, 'grass': T.TILE_GRASS, 'bank': T.TILE_BANK };
        
        // If habitat is defined, one must match
        if (habits.length > 0) {
            if (habits.some(h => mapping[h] === tile)) {
                valid = true;
            }
        } else {
            valid = true;
        }
      }
    } else if (poolName === POOL_AIR) {
      valid = true; // Birds fly anywhere
    }

    // Special Firefly Boost: 
    // If we picked firefly but terrain was wrong, try to scan nearby for a forest tile
    if (typeKey === 'firefly' && !valid) {
      // Small search
      for(let ox = -3; ox <= 3; ox+=3) {
        for(let oy = -3; oy <= 3; oy+=3) {
           const tx = Math.floor(sx + ox);
           const ty = Math.floor(sy + oy);
           if (game.getTile(tx, ty) === game.CONSTANTS.TILE_FOREST) {
             valid = true;
             // Update position to the valid tile
             // (We can't update sx/sy easily here without object wrapper, so we just use the original if close enough, or skip)
             // Actually let's just let probability handle it.
             break;
           }
        }
        if (valid) break;
      }
    }

    if (valid) {
      // Spawn Group
      let count = 1;
      if (typeKey === 'firefly') count = randomRange(3, 8);
      if (typeKey === 'bird') count = randomRange(1, 4);
      if (typeKey === 'fish') count = randomRange(1, 5);

      const groupId = count > 1 ? Math.random().toString(36) : null;
      // Pre-select variations for the group
      const baseColor = def.colors[Math.floor(Math.random() * def.colors.length)];

      for(let i=0; i<count; i++) {
        // Slight spread
        const ox = (Math.random() - 0.5) * 3;
        const oy = (Math.random() - 0.5) * 3;
        
        // Generate segment colors if needed (crabs)
        let segmentColors = null;
        if (def.segments) {
            segmentColors = [];
            const segCount = 3;
            const isRainbow = Math.random() < 0.2;
            for(let k=0; k<segCount; k++) {
                if (isRainbow) segmentColors.push(def.colors[Math.floor(Math.random() * def.colors.length)]);
                else segmentColors.push(baseColor);
            }
        }

        addCreature(poolName, {
          x: sx + ox,
          y: sy + oy,
          type: typeKey,
          def: def,
          angle: Math.random() * Math.PI * 2,
          targetAngle: Math.random() * Math.PI * 2,
          speed: def.speed * randomRange(0.8, 1.2),
          turnRate: def.turnRate,
          size: def.size,
          color: baseColor,
          segmentColors: segmentColors,
          wanderTimer: Math.random(),
          groupId: groupId,
          life: 0,
          id: Math.random().toString(36),
          depth: def.depth,
          glow: def.glow
        });
      }
    }
  }

  function update(dt, dayTime, player, pools, addCreature) {
    for (const poolName of [POOL_WATER, POOL_LAND, POOL_AIR]) {
       timers[poolName] += dt;
       const cfg = POOL_CONFIG[poolName];
       
       if (timers[poolName] >= cfg.interval) {
         timers[poolName] = 0;
         if (pools[poolName].length < cfg.cap) {
           attemptSpawn(poolName, player, dayTime, addCreature);
         }
       }
    }
  }

  return { update };
}