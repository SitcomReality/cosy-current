export function createGame({ state, noise }) {
  
  // Entity types
  const ENTITY_CITY = 'city';
  const ENTITY_RELIC = 'relic';

  // Tile Types (River Biome)
  const TILE_WATER = 0;   // Unified water type
  const TILE_BANK = 2;        // Mud/Sand/Reeds
  const TILE_GRASS = 3;
  const TILE_FOREST = 4;
  const TILE_HILL = 5;
  const TILE_MOUNTAIN = 6;

  // Constants
  const INTERACTION_RADIUS = 35.0; // Increased to cover river width + bank

  // Helper to get raw height 0..1 from noise
  // In this theme, the river network DEFINES the heightmap.
  // Rivers are at height 0, terrain slopes up away from them.
  function getHeight(x, y) {
    const river = noise.getRiverSystem(x, y);
    
    // Base height is distance from river center
    // river.value is 0 at center, 1 at bank edge.
    // We scale this up so terrain gets quite high far from rivers
    let baseH = river.value * 0.15; 

    // Add noise texture
    // We use lower frequency noise for large features
    const n1 = noise.sample(x * 0.5, y * 0.5, 0); // High freq detail
    const n2 = noise.sample(x * 0.1, y * 0.1, 100); // Low freq swell

    // Combine: Elevation increases with distance from river + noise
    let h = baseH + (n1 * 0.05) + (n2 * 0.15);
    
    // Clamp to 0..1
    // Shift up slightly so rivers aren't always exactly 0
    h += 0.1;
    
    // Ensure river channel is definitely low
    if (river.value < 0.8) {
        // Smoothly carve the channel
        // If we are inside the river width, suppress height
        const depth = 1.0 - (river.value / 0.8);
        h -= depth * 0.2; // Dig down
    }

    // Clamp continuous height
    h = Math.max(0, Math.min(1, h));

    // Quantize height into a small set of discrete levels so terrain
    // consists of flat bands with fixed heights.
    const LEVELS = [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95];
    let closest = LEVELS[0];
    let bestDist = Math.abs(h - closest);
    for (let i = 1; i < LEVELS.length; i++) {
      const d = Math.abs(h - LEVELS[i]);
      if (d < bestDist) {
        bestDist = d;
        closest = LEVELS[i];
      }
    }
    return closest;
  }

  function getTile(x, y) {
    const river = noise.getRiverSystem(x, y);
    const h = getHeight(x, y);

    // River Channel Logic
    // Unified water tile for the whole river width
    if (river.value < 1.0) return TILE_WATER;

    // Banks
    if (river.value < 1.3) return TILE_BANK;

    // Land Biomes based on height
    // Widen the grass band so it appears more consistently between bank and forest
    if (h < 0.45) return TILE_GRASS;
    if (h < 0.65) return TILE_FOREST;
    if (h < 0.80) return TILE_HILL;
    if (h < 0.95) return TILE_MOUNTAIN;
    return TILE_MOUNTAIN;
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

  // Helper: shortest signed angle difference
  function shortestAngleDiff(a, b) {
    let diff = b - a;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
  }

  // Logic to determine river flow direction
  function getRiverVector(x, y, currentAngle) {
      // Sample nearby points to find gradient of the distance field
      const d = 0.5; // Sampling delta
      const info = noise.getRiverSystem(x, y);

      // Which channel are we in?
      // If distX < distY, we are in the vertical channel (following Y axis in warped space)
      const trackingX = info.distX < info.distY;

      // Calculate gradient of the field we are tracking using a single set of samples
      const baseInfo = noise.getRiverSystem(x, y);
      const infoX = noise.getRiverSystem(x + d, y);
      const infoY = noise.getRiverSystem(x, y + d);

      const v0 = trackingX ? baseInfo.distX : baseInfo.distY;
      const vx = trackingX ? infoX.distX : infoX.distY;
      const vy = trackingX ? infoY.distX : infoY.distY;

      let gradX = (vx - v0) / d;
      let gradY = (vy - v0) / d;

      // Clamp gradient to avoid extreme values near edges that cause jitter
      const gradLen = Math.hypot(gradX, gradY);
      if (gradLen > 0.0001) {
        const maxGrad = 1.0;
        const scale = Math.min(1.0, maxGrad / gradLen);
        gradX *= scale;
        gradY *= scale;
      } else {
        gradX = 0;
        gradY = 0;
      }

      // Gradient points AWAY from center (dist increases).
      // We want tangent: perpendicular to gradient.
      let tx = -gradY;
      let ty = gradX;

      // Normalize tangent
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

      // Center pull vector (move towards river center)
      // Gradient points OUT, so -Gradient points IN.
      const centerStrength = Math.min(0.6, info.value); // Softer pull when near center
      const centerWeight = 0.35; // Reduce centering influence to avoid over-correction

      // Desired velocity is mostly tangent, some centering
      const mx = tx * 0.9 - gradX * centerWeight * centerStrength;
      const my = ty * 0.9 - gradY * centerWeight * centerStrength;

      return Math.atan2(my, mx);
  }

  function update(dt) {
    if (!state.isPlaying) return;

    const p = state.player;
    const river = noise.getRiverSystem(p.x, p.y);

    // Initialize targetAngle the first time
    if (p.targetAngle === undefined || Number.isNaN(p.targetAngle)) {
      p.targetAngle = p.angle;
    }

    // --- Input Bias ---
    // User can influence decision at intersection via p.angle (updated from outside)
    let targetAngle = p.targetAngle;
    
    if (river.isRiver) {
        // We are in the river, follow the flow
        if (river.isIntersection) {
             // At junction: still follow river vector, but will be biased by player angle externally
             const desired = getRiverVector(p.x, p.y, p.angle);
             // Smoothly blend current target toward desired to avoid snap turns
             const diff = shortestAngleDiff(targetAngle, desired);
             targetAngle = targetAngle + diff * Math.min(1, 5 * dt);
        } else {
            // Just follow the river flow
            const desired = getRiverVector(p.x, p.y, p.angle);
            const diff = shortestAngleDiff(targetAngle, desired);
            targetAngle = targetAngle + diff * Math.min(1, 3 * dt);
        }
        
        p.targetAngle = targetAngle;

        // Apply steering toward smoothed targetAngle with a max turn rate
        const angleDiff = shortestAngleDiff(p.angle, p.targetAngle);
        const maxTurnRate = 2.5; // radians per second
        const maxStep = maxTurnRate * dt;
        const clamped = Math.max(-maxStep, Math.min(maxStep, angleDiff));
        p.angle += clamped;
        
        // Speed - accelerate faster when multiplier active so boost feels immediate
        const accel = 5 * (state.speedMultiplier || 1);
        if (p.speed < p.targetSpeed) p.speed += dt * accel;
        
    } else {
        // Grounded on land!
        // Slow down
        p.speed = Math.max(0.5, p.speed - dt * 2);
        // Manual steering allowed? Or auto-steer back to river?
        // For now, just keep going straight-ish but slower
    }

    // 3. Apply Velocity
    // Movement uses the active speed multiplier so holding turbo increases travel speed
    const effectiveSpeed = p.speed * (state.speedMultiplier || 1);
    p.x += Math.cos(p.angle) * effectiveSpeed * dt;
    p.y += Math.sin(p.angle) * effectiveSpeed * dt;

    // --- Resource Collection ---
    // Passive accumulation based on terrain type
    const tileType = getTile(p.x, p.y);
    const collectionRate = 1.0 * dt; // Units per second

    if (tileType === TILE_FOREST) state.resources.bio += collectionRate * 2;
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
  // Find a river!
  let foundSpot = false;
  let attempts = 0;
  while(!foundSpot && attempts < 200) {
    const tx = (Math.random() - 0.5) * 5000;
    const ty = (Math.random() - 0.5) * 5000;
    const info = noise.getRiverSystem(tx, ty);
    
    if (info.isRiver && !info.isIntersection) {
      state.player.x = tx;
      state.player.y = ty;
      
      // Align with river flow
      state.player.angle = getRiverVector(tx, ty, 0);
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
      TILE_WATER, TILE_BANK, TILE_GRASS, TILE_FOREST, TILE_HILL, TILE_MOUNTAIN,
      ENTITY_CITY, ENTITY_RELIC
    }
  };
}