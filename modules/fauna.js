// Fauna spawning and update system
import { seedPermutation } from './noise_algorithms/permutations.js';

export function createFaunaSystem({ state, game, noise }) {
  const creatures = [];
  
  const SPAWN_INTERVAL = 0.4; 
  const MAX_CREATURES = 60;
  const DESPAWN_DISTANCE = 110; 
  
  let spawnTimer = 0;

  function normalizeAngle(a) {
    while (a <= -Math.PI) a += Math.PI * 2;
    while (a > Math.PI) a -= Math.PI * 2;
    return a;
  }

  function shortestAngleDiff(a, b) {
    let diff = b - a;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
  }

  // Creature type definitions with rigid movement categories
  const CREATURE_TYPES = {
    // Water Strict: Must stay in water (river value < 1.0)
    fish: { 
      type: 'water_strict', 
      size: 0.4, speed: 2.0, depth: 0.3, 
      colors: ['#f59e0b', '#ef4444', '#06b6d4'], 
      turnRate: 4.0 
    },
    eel: { 
      type: 'water_strict', 
      size: 0.6, speed: 1.5, depth: 0.5, 
      colors: ['#475569', '#64748b'], 
      turnRate: 3.5 
    },
    
    // Land Strict: Must stay on land (river value >= 1.0)
    // habitatPrefs defines where they prefer to be, but they can traverse other land types if needed,
    // though the logic will try to steer them back.
    critter: { 
      type: 'land_strict', 
      habitatPrefs: ['grass', 'sand'], 
      size: 0.25, speed: 1.2, 
      colors: ['#78350f', '#92400e'], 
      turnRate: 4.0 
    },
    deer: { 
      type: 'land_strict', 
      habitatPrefs: ['forest'], 
      size: 0.7, speed: 1.8, 
      colors: ['#92400e', '#78350f'], 
      turnRate: 2.5 
    },
    firefly: { 
      type: 'land_strict', 
      habitatPrefs: ['forest', 'grass'], 
      size: 0.1, speed: 0.8, 
      nightOnly: true, glow: true, 
      colors: ['#fef08a'], 
      turnRate: 3.0 
    },

    // Amphibious: Can go anywhere, but prefers bank/sand
    crab: { 
      type: 'amphibious', 
      habitatPrefs: ['sand'], 
      size: 0.35, speed: 0.5, 
      colors: ['#ef4444', '#f97316', '#db2777', '#8b5cf6'], 
      turnRate: 3.0,
      segments: true 
    },
    
    // Air: Can fly anywhere
    bird: { 
      type: 'air', 
      size: 0.3, speed: 3.0, 
      colors: ['#dc2626', '#2563eb', '#fbbf24'], 
      turnRate: 1.5 
    }
  };

  function spawnCreature(x, y, type, options = {}) {
    const def = CREATURE_TYPES[type];
    const colorIndex = (options.colorIndex != null)
      ? options.colorIndex
      : Math.floor(Math.random() * def.colors.length);
    
    const initialAngle = options.angle != null ? options.angle : Math.random() * Math.PI * 2;
    const baseColor = options.color || def.colors[colorIndex];

    // For crabs, generate segment colors
    let segmentColors = null;
    if (def.segments) {
      segmentColors = [];
      const isRainbow = Math.random() < 0.2; // 20% chance for rainbow crab
      const segmentCount = 2 + Math.floor(Math.random() * 2); // 2 or 3 segments
      
      if (isRainbow) {
        // Pick random distinct colors
        for(let i=0; i<segmentCount; i++) {
          segmentColors.push(def.colors[Math.floor(Math.random() * def.colors.length)]);
        }
      } else {
        // Variations of base color
        segmentColors.push(baseColor);
        // Slightly darker/lighter for subsequent segments? Just reuse base for now or allow slight variation in renderer
        for(let i=1; i<segmentCount; i++) segmentColors.push(baseColor);
      }
    }

    creatures.push({
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      type,
      def, // Store reference to definition for easy access
      size: def.size,
      speed: def.speed * (0.8 + Math.random() * 0.4),
      angle: initialAngle,
      targetAngle: initialAngle,
      turnRate: def.turnRate || 2.0,
      color: baseColor,
      segmentColors: segmentColors,
      depth: def.depth || 0,
      glow: def.glow || false,
      wanderTimer: Math.random() * 3,
      life: 0,
      groupId: options.groupId || null
    });
  }

  function trySpawn(player, dayTime) {
    if (creatures.length >= MAX_CREATURES) return;

    // Random spawn location near player
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 40;
    const sx = player.x + Math.cos(angle) * dist;
    const sy = player.y + Math.sin(angle) * dist;
    
    const tile = game.getTile(Math.floor(sx), Math.floor(sy));
    const riverInfo = noise.getRiverSystem(sx, sy);
    const isWater = riverInfo.isRiver; // value < 1.0
    
    // Determine available creature types
    const isNight = dayTime < 0.2 || dayTime > 0.8;
    const availableTypes = [];

    for (const [typeName, def] of Object.entries(CREATURE_TYPES)) {
      if (def.nightOnly && !isNight) continue;

      // Birds: high weight
      if (typeName === 'bird') {
        availableTypes.push(typeName, typeName, typeName, typeName);
        continue;
      }

      // Water Strict
      if (def.type === 'water_strict') {
        if (isWater && riverInfo.value < 0.8) { // Deep enough water
           // Boost weight for fish in deep water
           if (riverInfo.value < 0.5) availableTypes.push(typeName, typeName, typeName);
           else availableTypes.push(typeName);
        }
      } 
      // Land Strict
      else if (def.type === 'land_strict') {
        if (!isWater) {
           const prefs = def.habitatPrefs || [];
           // Check if current tile matches preferences
           let matches = false;
           if (prefs.includes('forest') && tile === game.CONSTANTS.TILE_FOREST) matches = true;
           if (prefs.includes('grass') && tile === game.CONSTANTS.TILE_GRASS) matches = true;
           if (prefs.includes('sand') && tile === game.CONSTANTS.TILE_BANK) matches = true;
           
           if (matches) availableTypes.push(typeName);
        }
      }
      // Amphibious (Crabs)
      else if (def.type === 'amphibious') {
        // Spawn crabs primarily on the bank (sand)
        if (tile === game.CONSTANTS.TILE_BANK) {
           availableTypes.push(typeName, typeName);
        }
      }
    }

    if (availableTypes.length > 0) {
      const chosen = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      
      // Group logic
      let groupSize = 1;
      if (['fish', 'eel', 'bird'].includes(chosen)) groupSize = 1 + Math.floor(Math.random() * 5);
      
      // Base direction
      let baseAngle = Math.random() * Math.PI * 2;
      
      // For water creatures, align roughly with river flow? 
      // Simplified: just pick random, update logic handles flow avoidance
      
      const groupId = groupSize > 1 ? `${chosen}_${Math.random().toString(36).substr(2, 5)}` : null;
      
      let sharedColorIndex = null;
      if (chosen === 'bird') sharedColorIndex = Math.floor(Math.random() * CREATURE_TYPES.bird.colors.length);

      for (let i = 0; i < groupSize; i++) {
        const ox = (Math.random() - 0.5) * 2;
        const oy = (Math.random() - 0.5) * 2;
        
        spawnCreature(sx + ox, sy + oy, chosen, {
          groupId,
          colorIndex: sharedColorIndex
        });
      }
    }
  }

  function update(dt) {
    if (!state.isPlaying) return;
    const player = state.player;

    spawnTimer += dt;
    if (spawnTimer >= SPAWN_INTERVAL) {
      spawnTimer = 0;
      trySpawn(player, state.dayTime);
    }

    // Group center calculation
    const groupCenters = new Map();
    creatures.forEach(c => {
      if (!c.groupId) return;
      if (!groupCenters.has(c.groupId)) groupCenters.set(c.groupId, { x: 0, y: 0, count: 0 });
      const g = groupCenters.get(c.groupId);
      g.x += c.x;
      g.y += c.y;
      g.count++;
    });

    // Update creatures
    creatures.forEach(c => {
      c.life += dt;
      c.wanderTimer -= dt;

      // 1. New Wander Target
      if (c.wanderTimer <= 0) {
        c.wanderTimer = 1.5 + Math.random() * 2.5;
        // Crabs are slow thinkers
        if (c.type === 'crab') c.wanderTimer += 2.0;

        // Perturb angle
        const delta = (Math.random() - 0.5) * (Math.PI / 2);
        c.targetAngle = normalizeAngle(c.targetAngle + delta);
      }

      // 2. Environment Steering (Soft Preferences)
      const currentRiverInfo = noise.getRiverSystem(c.x, c.y);
      const currentTile = game.getTile(Math.floor(c.x), Math.floor(c.y));

      if (c.def.type === 'water_strict') {
         // Avoid shallow water (soft steer)
         if (currentRiverInfo.value > 0.6) {
           // Sample surroundings to find deeper water
           let bestA = c.targetAngle;
           let minVal = currentRiverInfo.value;
           for(let a = 0; a < Math.PI*2; a+=Math.PI/2) {
             const sx = c.x + Math.cos(a)*4;
             const sy = c.y + Math.sin(a)*4;
             const v = noise.getRiverSystem(sx, sy).value;
             if (v < minVal) {
               minVal = v;
               bestA = a;
             }
           }
           c.targetAngle = normalizeAngle(bestA);
         }
      } 
      else if (c.def.type === 'land_strict') {
        // Avoid sand if not preferred
        const likesSand = c.def.habitatPrefs.includes('sand');
        if (!likesSand && currentTile === game.CONSTANTS.TILE_BANK) {
          // Steer away from water (which is 'down' the value gradient, so go 'up')
          // Or simpler: just random turn
          c.targetAngle = normalizeAngle(c.targetAngle + Math.PI);
        }
      }
      else if (c.def.type === 'amphibious') { // Crab
        // Likes sand (value ~ 1.0 - 1.2 ish)
        // If too deep in water (< 0.5) or too deep in forest (> 1.5), turn back
        if (currentRiverInfo.value < 0.5 || currentRiverInfo.value > 1.5) {
             c.targetAngle = normalizeAngle(c.angle + Math.PI);
        }
      }

      // 3. Group Cohesion
      if (c.groupId && groupCenters.has(c.groupId)) {
        const g = groupCenters.get(c.groupId);
        if (g.count > 1) {
          const cx = g.x / g.count;
          const cy = g.y / g.count;
          const angleToCenter = Math.atan2(cy - c.y, cx - c.x);
          // Gently nudge target angle
          const diff = shortestAngleDiff(c.targetAngle, angleToCenter);
          c.targetAngle += diff * 0.1; 
        }
      }

      // 4. Rigid Boundary Enforcement (Movement Prediction)
      const moveDist = c.speed * dt;
      const nextX = c.x + Math.cos(c.angle) * moveDist;
      const nextY = c.y + Math.sin(c.angle) * moveDist;
      
      const nextRiverInfo = noise.getRiverSystem(nextX, nextY);
      const nextIsWater = nextRiverInfo.value < 1.0; 

      let moveAllowed = true;

      if (c.def.type === 'water_strict') {
         if (!nextIsWater) {
           moveAllowed = false;
           // Hard reflect
           const surfaceNormalAngle = Math.atan2(nextRiverInfo.gy, nextRiverInfo.gx);
           c.targetAngle = surfaceNormalAngle + Math.PI; // Go away from bank gradient
           // If gradient is messy, just 180
           if (isNaN(c.targetAngle)) c.targetAngle = c.angle + Math.PI;
         }
      } 
      else if (c.def.type === 'land_strict') {
         if (nextIsWater) {
           moveAllowed = false;
           // Hard reflect
           const surfaceNormalAngle = Math.atan2(nextRiverInfo.gy, nextRiverInfo.gx);
           c.targetAngle = surfaceNormalAngle; // Go 'up' gradient (away from water)
           if (isNaN(c.targetAngle)) c.targetAngle = c.angle + Math.PI;
         }
      }

      // 5. Apply Movement
      const turnSpeed = c.turnRate * dt;
      const angleDiff = shortestAngleDiff(c.angle, c.targetAngle);
      const turn = Math.max(-turnSpeed, Math.min(turnSpeed, angleDiff));
      
      c.angle = normalizeAngle(c.angle + turn);

      // If we were blocked, force a rotation towards valid area immediately to prevent getting stuck
      if (!moveAllowed) {
        c.angle = normalizeAngle(c.targetAngle); // Snap
        // Don't move position this frame
      } else {
        c.x += Math.cos(c.angle) * moveDist;
        c.y += Math.sin(c.angle) * moveDist;
      }
    });

    // Despawn logic
    creatures.splice(0, creatures.length, ...creatures.filter(c => {
      const d = Math.hypot(c.x - player.x, c.y - player.y);
      return d < DESPAWN_DISTANCE;
    }));
  }

  return { creatures, update };
}