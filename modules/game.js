export function createGame({ state, noise }) {
  
  // Entity types
  const ENTITY_CITY = 'city';
  const ENTITY_RELIC = 'relic';

  // Tile Types (based on height)
  const TILE_DEEP_WATER = 0;
  const TILE_WATER = 1;
  const TILE_SAND = 2;
  const TILE_GRASS = 3;
  const TILE_FOREST = 4;
  const TILE_ROCK = 5;
  const TILE_SNOW = 6;

  // Constants
  const MAX_SLOPE = 0.6; // Height difference that is "too steep"
  const STEER_STRENGTH = 2.0; // Radians per second
  const INTERACTION_RADIUS = 3.0; // Tiles

  // Helper to get raw height 0..1 from noise
  function getHeight(x, y) {
    // We use the noise engine, map -1..1 to 0..1
    // Using a lower frequency for the base terrain to be smooth
    const raw = noise.sample(x, y, 0);
    
    // Apply a curve to create "plateaus" and "cliffs"
    // (x + 1)/2 maps to 0..1
    const h = (raw + 1) * 0.5;
    
    // Accentuate extremes: S-curve
    // h * h * (3 - 2 * h) is smoothstep
    return h * h * (3 - 2 * h);
  }

  function getTile(x, y) {
    const h = getHeight(x, y);
    
    // Tuned bands for more natural coastlines and biomes
    if (h < 0.20) return TILE_DEEP_WATER;
    if (h < 0.32) return TILE_WATER;
    if (h < 0.37) return TILE_SAND;
    if (h < 0.60) return TILE_GRASS;
    if (h < 0.72) return TILE_FOREST;
    if (h < 0.88) return TILE_ROCK;
    return TILE_SNOW;
  }

  function spawnEntity(x, y, type) {
    state.entities.push({
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      type,
      timer: 0
    });
  }

  function update(dt) {
    if (!state.isPlaying) return;

    // --- Player Movement ---
    const p = state.player;

    // 1. Check terrain ahead
    const lookAheadDist = 1.0;
    const nextX = p.x + Math.cos(p.angle) * lookAheadDist;
    const nextY = p.y + Math.sin(p.angle) * lookAheadDist;
    
    const hCurrent = getHeight(p.x, p.y);
    const hNext = getHeight(nextX, nextY);
    const slope = (hNext - hCurrent); // Positive means going up

    // 2. Auto-steering away from steep terrain or deep water
    if (hNext < 0.25) {
      // Avoid water - steer normal to current heading
      // Simple bounce mechanic: just turn
      p.angle += dt * 1.5;
    } else if (slope > 0.05) { 
      // Too steep? Turn slightly to find path of least resistance
      // We sample left and right to see which is lower
      const angLeft = p.angle - 0.5;
      const angRight = p.angle + 0.5;
      const hLeft = getHeight(p.x + Math.cos(angLeft), p.y + Math.sin(angLeft));
      const hRight = getHeight(p.x + Math.cos(angRight), p.y + Math.sin(angRight));
      
      if (hLeft < hRight) {
        p.angle -= dt * STEER_STRENGTH;
      } else {
        p.angle += dt * STEER_STRENGTH;
      }
      // Slow down on hills
      p.speed = Math.max(0.5, p.targetSpeed * (1 - slope * 5));
    } else {
      // Return to cruising speed
      if (p.speed < p.targetSpeed) p.speed += dt;
      else p.speed = p.targetSpeed;
    }

    // 3. Apply Velocity
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;

    // --- Resource Collection ---
    // Passive accumulation based on terrain type
    const tileType = getTile(p.x, p.y);
    const collectionRate = 1.0 * dt; // Units per second

    if (tileType === TILE_ROCK) state.resources.scrap += collectionRate * 2;
    else if (tileType === TILE_FOREST) state.resources.bio += collectionRate * 2;
    else if (tileType === TILE_GRASS) state.resources.bio += collectionRate;
    
    // Fuel consumption (very slow)
    state.resources.fuel -= dt * 0.1;
    if (state.resources.fuel < 0) state.resources.fuel = 0; // In a real game this might stop you

    // --- Entity Interactions ---
    // Generate entities if we're far from any
    if (state.entities.length < 10) {
        // Spawn something within 50 tiles but not too close
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 50;
        const ex = p.x + Math.cos(angle) * dist;
        const ey = p.y + Math.sin(angle) * dist;
        // Only spawn on land
        if (getHeight(ex, ey) > 0.3) {
            spawnEntity(ex, ey, Math.random() > 0.5 ? ENTITY_CITY : ENTITY_RELIC);
        }
    }

    // Clean up far entities
    state.entities = state.entities.filter(e => {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        return d < 150;
    });

    // Check proximity
    state.entities.forEach(e => {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < INTERACTION_RADIUS) {
            // Interaction!
            if (e.type === ENTITY_CITY) {
                // Trade: Bio for Fuel
                if (state.resources.bio > 5) {
                    state.resources.bio -= dt * 10;
                    state.resources.fuel += dt * 5;
                    state.resources.scrap += dt * 1;
                }
            } else if (e.type === ENTITY_RELIC) {
                // Scavenge
                state.resources.scrap += dt * 5;
            }
        }
    });
  }

  // Initial Player Spawn logic
  // Find a nice flat spot
  let foundSpot = false;
  let attempts = 0;
  while(!foundSpot && attempts < 100) {
    const tx = (Math.random() - 0.5) * 1000;
    const ty = (Math.random() - 0.5) * 1000;
    const h = getHeight(tx, ty);
    if (h > 0.4 && h < 0.6) {
      state.player.x = tx;
      state.player.y = ty;
      foundSpot = true;
    }
    attempts++;
  }

  return {
    getTile,
    getHeight,
    spawnEntity,
    update,
    CONSTANTS: {
      TILE_DEEP_WATER, TILE_WATER, TILE_SAND, TILE_GRASS, TILE_FOREST, TILE_ROCK, TILE_SNOW,
      ENTITY_CITY, ENTITY_RELIC
    }
  };
}