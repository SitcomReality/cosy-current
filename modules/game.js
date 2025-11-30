export function createGame({ state, noise }) {
  
  // Entity types
  const ENTITY_NPC = 'npc';
  const ENTITY_CITY = 'city';

  // Tile Types
  const TILE_WATER = 0;
  const TILE_SAND = 1;
  const TILE_GRASS = 2;
  const TILE_FOREST = 3;
  const TILE_MOUNTAIN = 4;

  function getTile(x, y) {
    // Generate terrain based on noise
    const n = noise.sample(x, y, 0); // Static terrain for now
    
    if (n < -0.2) return TILE_WATER;
    if (n < -0.1) return TILE_SAND;
    if (n < 0.4) return TILE_GRASS;
    if (n < 0.7) return TILE_FOREST;
    return TILE_MOUNTAIN;
  }

  function spawnEntity(x, y, type) {
    state.entities.push({
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      type,
      vx: 0,
      vy: 0,
      timer: 0
    });
    if (type === ENTITY_CITY) state.population += 100;
  }

  function update(dt) {
    // Update Entities
    state.entities.forEach(entity => {
      if (entity.type === ENTITY_NPC) {
        // Simple random movement logic
        entity.timer -= dt;
        if (entity.timer <= 0) {
          entity.vx = (Math.random() - 0.5) * 2;
          entity.vy = (Math.random() - 0.5) * 2;
          entity.timer = 1 + Math.random() * 2;
        }
        
        entity.x += entity.vx * dt;
        entity.y += entity.vy * dt;
      }
    });

    // Idle mechanic: Cities generate funds
    const cityCount = state.entities.filter(e => e.type === ENTITY_CITY).length;
    state.funds += cityCount * dt * 10;
  }

  // Initial population
  for (let i = 0; i < 5; i++) {
    spawnEntity((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, ENTITY_NPC);
  }

  return {
    getTile,
    spawnEntity,
    update,
    CONSTANTS: {
      TILE_WATER, TILE_SAND, TILE_GRASS, TILE_FOREST, TILE_MOUNTAIN,
      ENTITY_NPC, ENTITY_CITY
    }
  };
}