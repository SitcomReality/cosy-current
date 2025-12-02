// Fauna spawning and update system
export function createFaunaSystem({ state, game, noise }) {
  const creatures = [];
  
  const SPAWN_INTERVAL = 0.4; // seconds between spawn attempts (slightly more frequent)
  const MAX_CREATURES = 50;
  const DESPAWN_DISTANCE = 100; // tiles from player
  
  let spawnTimer = 0;

  // Helper functions for smooth turning
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

  // Creature type definitions
  const CREATURE_TYPES = {
    // Underwater
    fish: { habitat: 'water', size: 0.4, speed: 2.0, depth: 0.3, colors: ['#f59e0b', '#ef4444', '#06b6d4'], turnRate: 2.5 },
    eel:  { habitat: 'water', size: 0.6, speed: 1.5, depth: 0.5, colors: ['#475569', '#64748b'], turnRate: 2.2 },
    
    // Land / air creatures
    // Birds can spawn over any terrain; give them a moderate turn rate so they glide in curves.
    bird:   { habitat: 'any', size: 0.3, speed: 3.0, colors: ['#dc2626', '#2563eb', '#fbbf24'], turnRate: 1.8 },
    critter:{ habitat: ['sand', 'grass'], size: 0.25, speed: 1.2, colors: ['#78350f', '#92400e'], turnRate: 2.0 },
    deer:   { habitat: 'forest', size: 0.7, speed: 1.8, colors: ['#92400e', '#78350f'], turnRate: 1.6 },
    
    // Night-only
    firefly: { habitat: 'forest', size: 0.1, speed: 0.8, nightOnly: true, glow: true, colors: ['#fef08a'], turnRate: 3.0 }
  };

  function spawnCreature(x, y, type, options = {}) {
    const def = CREATURE_TYPES[type];
    const colorIndex = (options.colorIndex != null)
      ? options.colorIndex
      : Math.floor(Math.random() * def.colors.length);
    
    const initialAngle = options.angle != null ? options.angle : Math.random() * Math.PI * 2;

    creatures.push({
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      type,
      size: def.size,
      speed: def.speed * (0.8 + Math.random() * 0.4),
      angle: initialAngle,
      targetAngle: initialAngle,
      turnRate: def.turnRate || 2.0,
      color: options.color || def.colors[colorIndex],
      depth: def.depth || 0,
      habitat: def.habitat,
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
    const dist = 30 + Math.random() * 40;
    const sx = player.x + Math.cos(angle) * dist;
    const sy = player.y + Math.sin(angle) * dist;
    
    const tile = game.getTile(Math.floor(sx), Math.floor(sy));
    const riverInfo = noise.getRiverSystem(sx, sy);
    
    // Determine available creature types
    const isNight = dayTime < 0.2 || dayTime > 0.8;
    const availableTypes = [];

    for (const [typeName, def] of Object.entries(CREATURE_TYPES)) {
      // Skip night-only creatures during day
      if (def.nightOnly && !isNight) continue;

      // Birds: can spawn anywhere and should be a bit more common.
      if (typeName === 'bird') {
        // Weight birds more heavily by pushing multiple entries.
        availableTypes.push(typeName, typeName, typeName, typeName, typeName, typeName);
        continue;
      }
      
      // Check habitat match
      if (def.habitat === 'water' && riverInfo.isRiver && riverInfo.value < 0.8) {
        // Prefer deeper water for spawning
        if (riverInfo.value < 0.5) availableTypes.push(typeName);
      } else if (Array.isArray(def.habitat)) {
        // Multiple habitat types
        if ((tile === game.CONSTANTS.TILE_GRASS && def.habitat.includes('grass')) ||
            (tile === game.CONSTANTS.TILE_FOREST && def.habitat.includes('forest')) ||
            (tile === game.CONSTANTS.TILE_BANK && def.habitat.includes('sand'))) {
          availableTypes.push(typeName);
        }
      } else if (typeof def.habitat === 'string') {
        if (def.habitat === 'grass' && tile === game.CONSTANTS.TILE_GRASS) {
          availableTypes.push(typeName);
        } else if (def.habitat === 'forest' && tile === game.CONSTANTS.TILE_FOREST) {
          availableTypes.push(typeName);
        } else if (def.habitat === 'sand' && tile === game.CONSTANTS.TILE_BANK) {
          availableTypes.push(typeName);
        }
      }
    }

    if (availableTypes.length > 0) {
      const chosen = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      const def = CREATURE_TYPES[chosen];

      // Determine group size for schooling/flocking species
      let groupSize = 1;
      if (chosen === 'fish' || chosen === 'eel' || chosen === 'bird') {
        // 1 lone animal up to a small school/flock
        groupSize = 1 + Math.floor(Math.random() * 6); // 1..6
      }

      // Base direction:
      let baseAngle = Math.random() * Math.PI * 2;

      if (chosen === 'bird') {
        // Make birds generally fly past the player in a sweeping path.
        const dx = sx - player.x;
        const dy = sy - player.y;
        const toPlayerAngle = Math.atan2(dy, dx);
        // Fly roughly tangential around the player (perpendicular to vector to player)
        baseAngle = toPlayerAngle + (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      } else if (chosen === 'fish' || chosen === 'eel') {
        // For fish/eel, bias direction along the river flow by sampling nearby points.
        const ahead = noise.getRiverSystem(sx + 2, sy);
        const side = noise.getRiverSystem(sx, sy + 2);
        // Simple heuristic: choose direction where depth increases
        const current = riverInfo.value;
        const dxDepth = current - ahead.value;
        const dyDepth = current - side.value;
        if (Math.abs(dxDepth) > Math.abs(dyDepth)) {
          baseAngle = dxDepth > 0 ? 0 : Math.PI; // east/west-ish
        } else {
          baseAngle = dyDepth > 0 ? Math.PI / 2 : -Math.PI / 2; // north/south-ish
        }
      }

      const groupId = `${chosen}_${Math.random().toString(36).substr(2, 5)}`;

      // For birds, pick a shared color index so flocks usually match
      let sharedBirdColorIndex = null;
      if (chosen === 'bird') {
        sharedBirdColorIndex = Math.floor(Math.random() * def.colors.length);
      }

      for (let i = 0; i < groupSize; i++) {
        // Small positional offsets so groups cluster loosely
        const r = Math.random() * 3;
        const a = Math.random() * Math.PI * 2;
        const ox = Math.cos(a) * r;
        const oy = Math.sin(a) * r;

        // Small angular offsets around base direction so flock routes are roughly parallel
        const angleOffset = (Math.random() - 0.5) * (chosen === 'bird' ? Math.PI / 10 : Math.PI / 6);
        const memberAngle = baseAngle + angleOffset;

        let colorIndexOverride = null;
        if (chosen === 'bird' && sharedBirdColorIndex != null) {
          // High chance to share the flock color, with some variation allowed
          if (Math.random() < 0.85) {
            colorIndexOverride = sharedBirdColorIndex;
          }
        }

        spawnCreature(sx + ox, sy + oy, chosen, { 
          angle: memberAngle, 
          groupId,
          colorIndex: colorIndexOverride
        });
      }
    }
  }

  function update(dt) {
    if (!state.isPlaying) return;

    const player = state.player;
    
    // Spawn new creatures
    spawnTimer += dt;
    if (spawnTimer >= SPAWN_INTERVAL) {
      spawnTimer = 0;
      trySpawn(player, state.dayTime);
    }

    // Build group lookup for cohesion behaviors
    const groups = new Map();
    for (const c of creatures) {
      if (!c.groupId) continue;
      if (!groups.has(c.groupId)) groups.set(c.groupId, []);
      groups.get(c.groupId).push(c);
    }

    // Update creatures
    creatures.forEach(c => {
      c.life += dt;
      c.wanderTimer -= dt;
      
      // Wander behavior: update targetAngle, not angle directly, to avoid abrupt direction changes
      if (c.wanderTimer <= 0) {
        // Longer wander intervals for birds so they glide more and flit less
        if (c.type === 'bird') {
          c.wanderTimer = 4 + Math.random() * 4;
        } else if (c.type === 'fish' || c.type === 'eel') {
          c.wanderTimer = 2.5 + Math.random() * 3;
        } else {
          c.wanderTimer = 2 + Math.random() * 3;
        }

        // Small directional change around current target
        let maxDelta;
        if (c.type === 'bird') {
          maxDelta = Math.PI / 10; // gentle curves
        } else if (c.type === 'fish' || c.type === 'eel') {
          maxDelta = Math.PI / 6;
        } else {
          maxDelta = Math.PI / 4;
        }
        const delta = (Math.random() - 0.5) * 2 * maxDelta;
        const newTarget = c.targetAngle + delta;
        c.targetAngle = normalizeAngle(newTarget);
      }

      // Group cohesion: flocking fish/birds try to align with their group
      if (c.groupId && (c.type === 'fish' || c.type === 'eel' || c.type === 'bird')) {
        const members = groups.get(c.groupId);
        if (members && members.length > 1) {
          let avgAngleSin = 0;
          let avgAngleCos = 0;
          let avgX = 0;
          let avgY = 0;
          members.forEach(m => {
            avgAngleSin += Math.sin(m.angle);
            avgAngleCos += Math.cos(m.angle);
            avgX += m.x;
            avgY += m.y;
          });
          avgAngleSin /= members.length;
          avgAngleCos /= members.length;
          avgX /= members.length;
          avgY /= members.length;

          const groupAngle = Math.atan2(avgAngleSin, avgAngleCos);
          const toCenterAngle = Math.atan2(avgY - c.y, avgX - c.x);

          // Blend current target between group direction and loose cohesion towards group center
          const alignWeight = (c.type === 'bird') ? 0.8 : 0.6;
          const cohesionWeight = 1 - alignWeight;

          // Compute blended direction
          const blendedDirX = alignWeight * Math.cos(groupAngle) + cohesionWeight * Math.cos(toCenterAngle);
          const blendedDirY = alignWeight * Math.sin(groupAngle) + cohesionWeight * Math.sin(toCenterAngle);
          const blendedAngle = Math.atan2(blendedDirY, blendedDirX);

          // Ease towards flock direction, don't snap
          const diffToFlock = shortestAngleDiff(c.targetAngle, blendedAngle);
          const maxAdjust = (c.turnRate || 2.0) * 0.5 * dt;
          const adjust = Math.max(-maxAdjust, Math.min(maxAdjust, diffToFlock));
          c.targetAngle = normalizeAngle(c.targetAngle + adjust);
        }
      }

      // Stay in habitat (adjust targetAngle instead of snapping angle)
      const tile = game.getTile(Math.floor(c.x), Math.floor(c.y));
      const riverInfo = noise.getRiverSystem(c.x, c.y);
      
      if (c.habitat === 'water') {
        // Keep fish in water
        if (!riverInfo.isRiver || riverInfo.value > 0.9) {
          const turnBack = normalizeAngle(c.angle + Math.PI);
          c.targetAngle = turnBack;
        }
      } else if (c.habitat !== 'any') {
        // Keep land creatures on land
        if (riverInfo.isRiver && riverInfo.value < 1.0) {
          const turnBack = normalizeAngle(c.angle + Math.PI);
          c.targetAngle = turnBack;
        } else {
          // Additional tile-based correction if off preferred terrain
          if (c.habitat === 'forest' && tile !== game.CONSTANTS.TILE_FOREST) {
            c.targetAngle = normalizeAngle(c.angle + Math.PI);
          } else if (c.habitat === 'grass' && tile !== game.CONSTANTS.TILE_GRASS) {
            c.targetAngle = normalizeAngle(c.angle + Math.PI);
          } else if (c.habitat === 'sand' && tile !== game.CONSTANTS.TILE_BANK) {
            c.targetAngle = normalizeAngle(c.angle + Math.PI);
          }
        }
      }
      
      // Smoothly rotate towards targetAngle
      const diff = shortestAngleDiff(c.angle, c.targetAngle);
      const maxTurn = (c.turnRate || 2.0) * dt;
      const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
      c.angle = normalizeAngle(c.angle + turn);

      // Move along current angle
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
    });

    // Remove distant creatures
    creatures.splice(0, creatures.length, ...creatures.filter(c => {
      const dist = Math.hypot(c.x - player.x, c.y - player.y);
      return dist < DESPAWN_DISTANCE;
    }));
  }

  return { creatures, update };
}