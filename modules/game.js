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
  const TILE_ROAD = 7; // New Type

  // Constants
  const STEER_STRENGTH = 4.0; 
  const INTERACTION_RADIUS = 3.0; // Tiles

  // Helper to get raw height 0..1 from noise
  function getHeight(x, y) {
    // Terrain base
    const raw = noise.sample(x, y, 0);
    let h = (raw + 1) * 0.5;
    h = h * h * (3 - 2 * h); // Smoothstep

    // Flatten terrain under roads?
    const road = noise.getRoadInfo(x, y);
    if (road.isRoad) {
       // Lerp height towards a "safe" level (e.g. 0.4) based on how close to road center
       const roadWeight = 1.0 - Math.min(1, road.value); // 1 at center, 0 at edge
       h = h * (1 - roadWeight) + 0.45 * roadWeight;
    }

    return h;
  }

  function getTile(x, y) {
    const road = noise.getRoadInfo(x, y);
    if (road.isRoad) return TILE_ROAD;

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

  // Logic to determine road direction
  function getRoadVector(x, y, currentAngle) {
      // Sample nearby points to find gradient of the distance field
      const d = 0.5; // Sampling delta
      const info = noise.getRoadInfo(x, y);
      
      // If we are deep in an intersection, we need to choose a path based on state/input
      // But generally, we follow the "channel" we are in (distX or distY)
      
      // Which channel are we in? 
      // If distX < distY, we are in the vertical channel (following Y axis in warped space)
      // Tangent is along the line of constant distX.
      
      const trackingX = info.distX < info.distY;
      
      // Calculate gradient of the field we are tracking
      const v0 = trackingX ? noise.getRoadInfo(x, y).distX : noise.getRoadInfo(x, y).distY;
      const vx = trackingX ? noise.getRoadInfo(x + d, y).distX : noise.getRoadInfo(x + d, y).distY;
      const vy = trackingX ? noise.getRoadInfo(x, y + d).distX : noise.getRoadInfo(x, y + d).distY;
      
      const gradX = (vx - v0) / d;
      const gradY = (vy - v0) / d;
      
      // Gradient points AWAY from center (dist increases).
      // We want tangent. Tangent is perpendicular to gradient.
      // T = {-gradY, gradX} or {gradY, -gradX}
      
      let tx = -gradY;
      let ty = gradX;
      
      // Normalize
      const len = Math.hypot(tx, ty);
      if (len > 0.001) {
          tx /= len;
          ty /= len;
      } else {
          // Fallback if flat
          tx = Math.cos(currentAngle);
          ty = Math.sin(currentAngle);
      }
      
      // Ensure we don't flip 180 degrees instantly; pick direction closest to current heading
      const dot = tx * Math.cos(currentAngle) + ty * Math.sin(currentAngle);
      if (dot < 0) {
          tx = -tx;
          ty = -ty;
      }
      
      // Center pull vector (move towards road center)
      // Gradient points OUT, so -Gradient points IN.
      // We blend tangent (flow) with gradient (centering)
      const centerStrength = Math.min(1.0, info.value); // Stronger pull when further out
      
      // Desired velocity is mostly tangent, some centering
      const mx = tx * 0.8 - gradX * 0.5 * centerStrength;
      const my = ty * 0.8 - gradY * 0.5 * centerStrength;
      
      return Math.atan2(my, mx);
  }

  function update(dt) {
    if (!state.isPlaying) return;

    const p = state.player;
    const road = noise.getRoadInfo(p.x, p.y);

    // --- Input Bias ---
    // User can influence decision at intersection
    let userTurn = 0;
    // We assume global 'keys' are not available here directly, but we can read from state if we stored input
    // For now, let's assume the main loop updates state.input or similar. 
    // Actually, we'll just check if angle is being forced in the main loop and let the game logic correct it.
    // But better: let the game logic handle the "steering" completely.
    
    // We'll use a targetAngle.
    let targetAngle = p.angle;
    
    if (road.isRoad) {
        // We are on road, autonomous driving engaged
        if (road.isIntersection) {
             // We are at a junction.
             // If we were just cruising, this is a new event.
             // Randomly pick a direction?
             // The getRoadVector logic tends to keep going straight through intersections 
             // because the gradient of the orthogonal road is high (it's a wall).
             // However, at the exact center, both gradients are low.
             
             // To support "A/D" to turn:
             // We need to know if the user wants to turn. 
             // Let's rely on the main app loop modifying `p.angle` slightly with A/D,
             // and `getRoadVector` will snap to the new valid path closest to that angle.
             
             // So here, we just follow the vector.
             targetAngle = getRoadVector(p.x, p.y, p.angle);
        } else {
            // Just follow the road
            targetAngle = getRoadVector(p.x, p.y, p.angle);
        }
        
        // Apply steering
        // Shortest angular distance
        let diff = targetAngle - p.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        p.angle += diff * STEER_STRENGTH * dt;
        
        // Speed
        if (p.speed < p.targetSpeed) p.speed += dt * 5;
        
    } else {
        // Offroad!
        // Slow down
        p.speed = Math.max(1.0, p.speed - dt * 2);
        // Manual steering allowed? Or auto-steer back to road?
        // Let's search for road
        // Simple circle search
        // For now, just keep going straight-ish but slower
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
  // Find a road!
  let foundSpot = false;
  let attempts = 0;
  while(!foundSpot && attempts < 200) {
    const tx = (Math.random() - 0.5) * 5000;
    const ty = (Math.random() - 0.5) * 5000;
    const info = noise.getRoadInfo(tx, ty);
    
    if (info.isRoad && !info.isIntersection) {
      state.player.x = tx;
      state.player.y = ty;
      
      // Align with road
      state.player.angle = getRoadVector(tx, ty, 0);
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