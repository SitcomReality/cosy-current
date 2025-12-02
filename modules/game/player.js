import { INTERACTION_RADIUS, TILE_GRASS, TILE_FOREST } from './constants.js';

// Short helper: shortest signed angle diff
function shortestAngleDiff(a, b) {
  let diff = b - a;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return diff;
}

// Updated signature to accept generalized helper or just use the module import if we changed it.
// We'll assume game.js passes the new helper or we import it. 
// Actually game.js passes { getRiverVector } but we want getSmartSteering.
// We will update game.js to pass the right thing, or import it here if needed.
// For now, let's assume the passed riverModule has getSmartSteering or we use the passed one.
// To be safe, let's expect 'steeringHelper' in the arguments or adapt.

export function createPlayerModule(state, noise, heightModule, riverModule, entitiesModule) {
  function update(dt) {
    if (!state.isPlaying) return;

    const p = state.player;
    
    // Safety clamp: if we somehow got WAY off map or stuck deep in land
    const currentRiver = noise.getRiverSystem(p.x, p.y);
    if (currentRiver.value > 1.2) {
        // Emergency nudge towards center (0,0 of grid cell?) 
        // Or just let the steering handle it (it has a panic mode)
        p.speed *= 0.9;
    }

    // Use smart steering
    // We assume riverModule is the object { getSmartSteering: ... } or similar
    // We'll call the function we just wrote.
    const steering = riverModule.getSmartSteering(noise, p.x, p.y, p.angle);
    
    const targetAngle = steering.angle;
    const confidence = steering.confidence;

    // Smoothly turn towards target
    // We turn slower if confidence is high (cruising), faster if confidence is low (panic/turn)
    // Actually, at intersections (confidence might fluctuate), we want steady turning.
    
    const diff = shortestAngleDiff(p.angle, targetAngle);
    
    // Turn speed
    // If diff is large, we need to turn hard.
    const turnRate = 1.5 + Math.abs(diff) * 1.0; 
    
    // Apply turn
    const maxTurn = turnRate * dt;
    const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
    p.angle += turn;

    // Speed control
    // If facing target and confident, speed up.
    // If turning hard or low confidence (shallow), slow down.
    
    // Base target speed
    let desiredSpeed = p.targetSpeed;
    
    // Slow down in turns
    desiredSpeed *= Math.max(0.3, 1.0 - Math.abs(diff) * 0.5);
    
    // Slow down in shallow water (low confidence)
    desiredSpeed *= Math.max(0.4, 0.2 + confidence * 0.8);

    const accel = 2.0 * (state.speedMultiplier || 1);
    const braking = 4.0 * (state.speedMultiplier || 1);
    
    if (p.speed < desiredSpeed) {
        p.speed += accel * dt;
    } else {
        p.speed -= braking * dt;
    }
    
    // Move
    const effectiveSpeed = p.speed * (state.speedMultiplier || 1);
    p.x += Math.cos(p.angle) * effectiveSpeed * dt;
    p.y += Math.sin(p.angle) * effectiveSpeed * dt;

    // Resources and Entities Logic (unchanged)
    // Resources
    const tileType = heightModule.getTile(p.x, p.y);
    const collectionRate = 1.0 * dt;
    if (tileType === undefined) {} // defensive
    if (tileType === TILE_FOREST) state.resources.bio += collectionRate * 2;
    else if (tileType === TILE_GRASS) state.resources.bio += collectionRate;

    state.resources.fuel -= dt * 0.1;
    if (state.resources.fuel < 0) state.resources.fuel = 0;

    // Entities interactions
    entitiesModule.maintainEntities(heightModule.getTile, heightModule.getHeight, p);

    state.entities.forEach(e => {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < INTERACTION_RADIUS) {
        if (e.type === 'city') {
          if (state.resources.bio > 5) {
            state.resources.bio -= dt * 10;
            state.resources.fuel += dt * 5;
            state.resources.scrap += dt * 1;
          }
        } else if (e.type === 'relic') {
          state.resources.scrap += dt * 5;
        }
      }
    });
  }

  return { update };
}