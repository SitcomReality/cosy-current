// Fauna spawning and update system
export function createFaunaSystem({ state, game, noise }) {
  const creatures = [];
  
  const SPAWN_INTERVAL = 2.0; // seconds between spawn attempts
  const MAX_CREATURES = 50;
  const DESPAWN_DISTANCE = 100; // tiles from player
  
  let spawnTimer = 0;

  // Creature type definitions
  const CREATURE_TYPES = {
    // Underwater
    fish: { habitat: 'water', size: 0.4, speed: 2.0, depth: 0.3, colors: ['#f59e0b', '#ef4444', '#06b6d4'] },
    eel: { habitat: 'water', size: 0.6, speed: 1.5, depth: 0.5, colors: ['#475569', '#64748b'] },
    
    // Land creatures
    bird: { habitat: ['grass', 'forest'], size: 0.3, speed: 3.0, colors: ['#dc2626', '#2563eb', '#fbbf24'] },
    critter: { habitat: ['sand', 'grass'], size: 0.25, speed: 1.2, colors: ['#78350f', '#92400e'] },
    deer: { habitat: 'forest', size: 0.7, speed: 1.8, colors: ['#92400e', '#78350f'] },
    
    // Night-only
    firefly: { habitat: 'forest', size: 0.1, speed: 0.8, nightOnly: true, glow: true, colors: ['#fef08a'] }
  };

  function spawnCreature(x, y, type) {
    const def = CREATURE_TYPES[type];
    const colorIndex = Math.floor(Math.random() * def.colors.length);
    
    creatures.push({
      id: Math.random().toString(36).substr(2, 9),
      x, y,
      type,
      size: def.size,
      speed: def.speed * (0.8 + Math.random() * 0.4),
      angle: Math.random() * Math.PI * 2,
      color: def.colors[colorIndex],
      depth: def.depth || 0,
      habitat: def.habitat,
      glow: def.glow || false,
      wanderTimer: Math.random() * 3,
      life: 0
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
        // Single habitat
        if ((tile === game.CONSTANTS.TILE_GRASS && def.habitat === 'grass') ||
            (tile === game.CONSTANTS.TILE_FOREST && def.habitat === 'forest') ||
            (tile === game.CONSTANTS.TILE_BANK && def.habitat === 'sand')) {
          availableTypes.push(typeName);
        }
      }
    }

    if (availableTypes.length > 0) {
      const chosen = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      spawnCreature(sx, sy, chosen);
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

    // Update creatures
    creatures.forEach(c => {
      c.life += dt;
      c.wanderTimer -= dt;
      
      // Wander behavior
      if (c.wanderTimer <= 0) {
        c.wanderTimer = 2 + Math.random() * 3;
        c.angle += (Math.random() - 0.5) * Math.PI;
      }

      // Move
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;

      // Stay in habitat
      const tile = game.getTile(Math.floor(c.x), Math.floor(c.y));
      const riverInfo = noise.getRiverSystem(c.x, c.y);
      
      if (c.habitat === 'water') {
        // Keep fish in water
        if (!riverInfo.isRiver || riverInfo.value > 0.9) {
          c.angle += Math.PI; // Turn around
        }
      } else {
        // Keep land creatures on land
        if (riverInfo.isRiver && riverInfo.value < 1.0) {
          c.angle += Math.PI; // Turn around
        }
      }
    });

    // Remove distant creatures
    creatures.splice(0, creatures.length, ...creatures.filter(c => {
      const dist = Math.hypot(c.x - player.x, c.y - player.y);
      return dist < DESPAWN_DISTANCE;
    }));
  }

  return { creatures, update };
}