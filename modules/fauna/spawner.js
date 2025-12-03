import { CREATURE_DEFS, POOL_WATER, POOL_LAND, POOL_AIR } from './constants.js';
import { randomRange } from './utils.js';

export function createSpawner(game, noise, state) {
  
  // Caps and Rates (increased caps and faster intervals for more fauna)
  const POOL_CONFIG = {
    [POOL_WATER]: { cap: 60, interval: 0.22 },
    [POOL_LAND]:  { cap: 35, interval: 0.35 },
    [POOL_AIR]:   { cap: 25, interval: 0.55 }
  };

  const timers = {
    [POOL_WATER]: 0,
    [POOL_LAND]: 0,
    [POOL_AIR]: 0
  };
  
  // Map to keep deterministic/group base phases so members of a spawned group share a base but not identical phase
  const groupPhaseMap = new Map();
  
  // Helper: estimate fraction of water tiles in a circular area around player
  function estimateWaterCoverage(player, sampleRadius, sampleCount = 80) {
    let water = 0;
    for (let i = 0; i < sampleCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * sampleRadius;
      const sx = player.x + Math.cos(a) * r;
      const sy = player.y + Math.sin(a) * r;
      const tile = game.getTile(Math.floor(sx), Math.floor(sy));
      if (tile === undefined) continue;
      const rinfo = noise.getRiverSystem(sx, sy);
      if (rinfo.value < 1.0 || tile === game.CONSTANTS.TILE_WATER) water++;
    }
    return Math.max(0, Math.min(1, water / sampleCount));
  }

  function getWeightedRandomType(poolName, dayTime) {
    const isNight = dayTime < 0.2 || dayTime > 0.8;
    const isDawnDusk = (dayTime > 0.2 && dayTime < 0.3) || (dayTime > 0.7 && dayTime < 0.8);
    
    const candidates = [];
    
    for (const key in CREATURE_DEFS) {
      const def = CREATURE_DEFS[key];
      if (def.pool !== poolName) continue;
      
      let weight = 1;
      
      if (def.nightOnly && !isNight) weight = 0;
      if (def.nightOnly && isNight) weight = 12; // High priority for fireflies at night
      
      if (key === 'bird' && isDawnDusk) weight = 6; // More birds in morning/evening
      
      // Make eels a bit more common so they are noticeable
      if (key === 'eel') weight *= 2;

      for (let i = 0; i < weight; i++) candidates.push(key);
    }
    
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // Spawn position biased to just outside the current camera view
  function getOffscreenSpawnPosition() {
    const tileSize = state.tileSize || 64;
    const halfW = (state.width / 2) / tileSize;
    const halfH = (state.height / 2) / tileSize;
    const margin = 4; // tiles just beyond edge

    const side = Math.floor(Math.random() * 4); // 0=left,1=right,2=top,3=bottom
    let sx, sy;

    if (side === 0) {
      // Left
      sx = state.camera.x - halfW - margin;
      sy = state.camera.y + (Math.random() * 2 - 1) * halfH;
    } else if (side === 1) {
      // Right
      sx = state.camera.x + halfW + margin;
      sy = state.camera.y + (Math.random() * 2 - 1) * halfH;
    } else if (side === 2) {
      // Top
      sx = state.camera.x + (Math.random() * 2 - 1) * halfW;
      sy = state.camera.y - halfH - margin;
    } else {
      // Bottom
      sx = state.camera.x + (Math.random() * 2 - 1) * halfW;
      sy = state.camera.y + halfH + margin;
    }

    return { sx, sy };
  }

  function attemptSpawn(poolName, player, dayTime, addCreature) {
    const cfg = POOL_CONFIG[poolName];
    
    // Pick Type
    const typeKey = getWeightedRandomType(poolName, dayTime);
    if (!typeKey) return;
    const def = CREATURE_DEFS[typeKey];

    // Pick Location: spawn just off-screen around camera
    const { sx, sy } = getOffscreenSpawnPosition();

    // Validate Terrain
    const r = noise.getRiverSystem(sx, sy);
    const tile = game.getTile(Math.floor(sx), Math.floor(sy));
    
    let valid = false;

    if (poolName === POOL_WATER) {
      // Prefer deeper water: require a clearer margin from shore to reduce beaching.
      // Only spawn when the normalized river distance is comfortably inside the channel.
      // Tighten threshold: require substantially interior channel (was 0.8)
      if (r.value < 0.5) {
         // Also ensure a small neighborhood around spawn point is water and not bank
         let neighClear = true;
         for (let oy = -1; oy <= 1; oy++) {
           for (let ox = -1; ox <= 1; ox++) {
             const tx = Math.floor(sx) + ox;
             const ty = Math.floor(sy) + oy;
             const infoN = noise.getRiverSystem(tx + 0.5, ty + 0.5);
             const t = game.getTile(tx, ty);
             // require water-like reading (value < 0.85) and not bank tile
             if (infoN.value >= 0.85 || t === game.CONSTANTS.TILE_BANK) {
               neighClear = false;
               break;
             }
           }
           if (!neighClear) break;
         }

         // If creature has a preferred depth, ensure it's not too shallow for it.
         if (neighClear) {
             if (def.depth && r.value > (1.0 - def.depth - 0.05)) {
                 valid = false;
             } else {
                 valid = true;
             }
         } else {
           valid = false;
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
             break;
           }
        }
        if (valid) break;
      }
    }

    if (valid) {
      // Spawn Group
      let count = 1;
      if (typeKey === 'firefly') count = randomRange(4, 9);
      if (typeKey === 'bird')    count = randomRange(2, 5);
      if (typeKey === 'fish')    count = randomRange(2, 6);
      if (typeKey === 'eel')     count = randomRange(1, 3);

      const groupId = count > 1 ? Math.random().toString(36) : null;
      // If group, create and store a base phase so members share similar but not identical wave timing
      if (groupId) {
        groupPhaseMap.set(groupId, Math.random() * Math.PI * 2);
      }
      // Pre-select variations for the group
      const baseColor = def.colors[Math.floor(Math.random() * def.colors.length)];
      // Decide if this group should behave in a loosely flocking / schooling way
      const groupCanFlock = (typeKey === 'fish' || typeKey === 'eel' || typeKey === 'bird');
      const groupIsFlocker = groupCanFlock && Math.random() < 0.4; // ~40% of eligible groups
      const baseFlockStrength = groupIsFlocker ? randomRange(0.35, 0.6) : 0;

      for (let i = 0; i < count; i++) {
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

        // Eel-specific segment count for rendering
        let segmentCount = undefined;
        if (typeKey === 'eel') {
          segmentCount = Math.floor(randomRange(3, 6)); // 3–5 segments
        }

        // Wave phase: group members get a shared base plus a small per-member jitter so schools don't oscillate perfectly in sync
        let wavePhase;
        if (groupId) {
          const basePhase = groupPhaseMap.get(groupId) || (Math.random() * Math.PI * 2);
          // small deterministic-ish per-member offset so positions differ
          wavePhase = basePhase + (i * 0.27) + (Math.random() * 0.18 - 0.09);
        } else {
          // solitary creatures get fully random phase
          wavePhase = Math.random() * Math.PI * 2;
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
          glow: def.glow,
          segmentCount,
          // Flocking / schooling metadata
          isFlocker: groupIsFlocker,
          flockStrength: baseFlockStrength,
          wavePhase // <-- attach phase for flowFollow to use
        });
      }
    }
  }

  function update(dt, state, pools, addCreature) {
    const player = state.player;
    const dayTime = state.dayTime;

    for (const poolName of [POOL_WATER, POOL_LAND, POOL_AIR]) {
       timers[poolName] += dt;
       const cfg = POOL_CONFIG[poolName];
       
       if (timers[poolName] >= cfg.interval) {
         timers[poolName] = 0;
         if (pools[poolName].length < cfg.cap) {
           // If water pool, bias spawn attempts by how much nearby view is water
           if (poolName === POOL_WATER) {
             // Estimate water coverage within player's view-like distance
             const tileSize = state.tileSize || 64;
             const halfW = (state.width / 2) / tileSize;
             const halfH = (state.height / 2) / tileSize;
             const radius = Math.max(halfW, halfH) + 10;
             const coverage = estimateWaterCoverage(player, radius);
             // coverage in [0..1] — convert to spawn chance: higher baseline, scale up with coverage
             const spawnChance = Math.max(0.35, 0.35 + coverage * 0.65); // 0.35..1.0
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