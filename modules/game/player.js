import { INTERACTION_RADIUS, TILE_GRASS, TILE_FOREST } from './constants.js';

// Short helper: shortest signed angle diff
function shortestAngleDiff(a, b) {
  let diff = b - a;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return diff;
}

export function createPlayerModule(state, noise, heightModule, riverModule, entitiesModule) {
  function update(dt) {
    if (!state.isPlaying) return;

    const p = state.player;
    
    // Check if player is actively steering (keyboard or touch)
    const playerSteering = keysDown('KeyA') || keysDown('ArrowLeft') || 
                          keysDown('KeyD') || keysDown('ArrowRight') ||
                          state._touchSteering;
    
    // Safety clamp: if we somehow got WAY off map or stuck deep in land
    const currentRiver = noise.getRiverSystem(p.x, p.y);
    if (currentRiver.value > 1.2) {
        p.speed *= 0.9;
    }

    // Use smart steering
    const steering = riverModule.getSmartSteering(noise, p.x, p.y, p.angle);
    
    const targetAngle = steering.angle;
    const confidence = steering.confidence;

    // Smoothly turn towards target
    const diff = shortestAngleDiff(p.angle, targetAngle);
    
    // Turn speed - reduced autopilot authority when player is steering
    const baseTurnRate = 0.7;
    const dynamicFactor = Math.abs(diff) * 1.5;
    let turnRate = baseTurnRate + dynamicFactor;
    
    // If player is actively steering, reduce autopilot influence significantly
    if (playerSteering) {
      turnRate *= 0.3; // Autopilot only gently nudges when player steers
    }
    
    // Compute max turn for this frame
    let maxTurn = turnRate * dt;
    
    // If the required adjustment is very small, scale the maxTurn down with a non-linear easing:
    const MICRO_TURN_THRESHOLD = 0.35;
    if (Math.abs(diff) < MICRO_TURN_THRESHOLD) {
      const r = Math.abs(diff) / MICRO_TURN_THRESHOLD;
      const expo = 2.0;
      const easeScale = Math.pow(r, expo);
      const MIN_SCALE = 0.1;
      maxTurn *= Math.max(MIN_SCALE, easeScale);
    }
    
    const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
    p.angle += turn;

    // Speed control
    let desiredSpeed = p.targetSpeed;
    
    // Slow down in turns
    desiredSpeed *= Math.max(0.3, 1.0 - Math.abs(diff) * 0.5);
    
    // Slow down in shallow water (low confidence)
    desiredSpeed *= Math.max(0.4, 0.2 + confidence * 0.8);

    const accel = 2.0 * (state.speedMultiplier || 1);
    const braking = 4.0 * (state.speedMultiplier || 1);
    
    if (state._playerPaused) {
      p.speed = 0;
    } else if (p.speed < desiredSpeed) {
        p.speed += accel * dt;
    } else {
        p.speed -= braking * dt;
    }
    
    // Move
    const effectiveSpeed = p.speed * (state.speedMultiplier || 1);
    p.x += Math.cos(p.angle) * effectiveSpeed * dt;
    p.y += Math.sin(p.angle) * effectiveSpeed * dt;

    // Entities interactions
    entitiesModule.maintainEntities(heightModule.getTile, heightModule.getHeight, p);

    state.entities.forEach(e => {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < INTERACTION_RADIUS) {
        if (e.type === 'landmark') {
          // Landmarks are purely decorative
        }
      }
    });
  }

  // Helper to check if keys are down (passed from app.js via state)
  function keysDown(code) {
    return state._keysDown && state._keysDown[code];
  }

  return { update };
}