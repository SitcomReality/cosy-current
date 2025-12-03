import { normalizeAngle, shortestAngleDiff } from './utils.js';

export function updateCreatureBehavior(c, dt, noise, game) {
  // Update timers
  c.life += dt;
  c.wanderTimer -= dt;
  if (c.wanderTimer < 0) c.wanderTimer = 0;

  // Reset modifiers per frame
  c.turnBoost = 1.0;
  c.speedMult = 1.0;

  // 1. Determine Target Angle based on behavior
  const behavior = c.def.behavior || 'wander';

  if (behavior === 'flow_follow') {
    applyFlowFollow(c, dt, noise);
  } else if (behavior === 'fly_straight') {
    applyFlyStraight(c, dt);
  } else if (behavior === 'scuttle') {
    applyScuttle(c, dt);
  } else {
    // Default wander
    applyWander(c, dt);
  }

  // 2. Boundary Enforcement (Bounce/Steer away from forbidden terrain)
  enforceBoundaries(c, dt, noise, game);

  // 3. Physics (Turn & Move)
  // Scuttle has special movement handling (stop and go)
  if (behavior === 'scuttle' && c.isStopped) {
    // Don't move
  } else {
    // Apply turn boost if requested by boundary logic for smoother avoidance
    const turnSpeed = c.turnRate * c.turnBoost * dt;
    const angleDiff = shortestAngleDiff(c.angle, c.targetAngle);
    const turn = Math.max(-turnSpeed, Math.min(turnSpeed, angleDiff));
    c.angle = normalizeAngle(c.angle + turn);

    const speed = c.speed * c.speedMult;
    c.x += Math.cos(c.angle) * speed * dt;
    c.y += Math.sin(c.angle) * speed * dt;
  }
}

function applyWander(c, dt) {
  if (c.wanderTimer <= 0) {
    c.wanderTimer = 1.0 + Math.random() * 2.0;
    const delta = (Math.random() - 0.5) * (Math.PI / 1.5);
    c.targetAngle = normalizeAngle(c.targetAngle + delta);
  }
}

function applyScuttle(c, dt) {
  // Crabs pause frequently
  if (c.wanderTimer <= 0) {
    if (c.isStopped) {
      // Start moving
      c.isStopped = false;
      c.wanderTimer = 0.5 + Math.random() * 1.5;
      // Pick new direction
      const delta = (Math.random() - 0.5) * (Math.PI);
      c.targetAngle = normalizeAngle(c.targetAngle + delta);
    } else {
      // Stop
      c.isStopped = true;
      c.wanderTimer = 0.5 + Math.random() * 1.0;
    }
  }
}

function applyFlyStraight(c, dt) {
  // Birds pick a distant point and stick to it mostly
  if (c.wanderTimer <= 0) {
    c.wanderTimer = 3.0 + Math.random() * 2.0;
    // Slight course correction
    const delta = (Math.random() - 0.5) * 0.2;
    c.targetAngle = normalizeAngle(c.targetAngle + delta);
  }
}

function applyFlowFollow(c, dt, noise) {
  // Sample current position
  const r = noise.getRiverSystem(c.x, c.y);

  // 1. Base Flow Direction (tangent to gradient)
  // Gradient (gx, gy) points to bank. Tangent is (-gy, gx).
  const flowAngle = Math.atan2(r.gx, -r.gy); 
  let target = flowAngle;

  // 2. Wavy Motion (Sinusoidal offset)
  // Varies by creature ID to desync
  const waveFreq = 2.5; 
  const wavePhase = (c.id.charCodeAt(0) % 10);
  const waveVal = Math.sin(c.life * waveFreq + wavePhase);
  // Amplitude reduces when near banks to prevent accidental beaching
  const safeAmplitude = 0.5 * Math.max(0, 1.0 - r.value); 
  target += waveVal * safeAmplitude;

  // 3. Look-ahead Avoidance (Whiskers)
  // Check left and right probes to steer away from rising terrain values
  const probeDist = 2.5;
  const probeAngle = 0.6; // ~35 degrees

  const angL = c.angle - probeAngle;
  const angR = c.angle + probeAngle;
  
  // Optimization: only probe if we aren't in deep center
  if (r.value > 0.15) {
      const lx = c.x + Math.cos(angL) * probeDist;
      const ly = c.y + Math.sin(angL) * probeDist;
      const rx = c.x + Math.cos(angR) * probeDist;
      const ry = c.y + Math.sin(angR) * probeDist;
      
      const vL = noise.getRiverSystem(lx, ly).value;
      const vR = noise.getRiverSystem(rx, ry).value;

      // If one side is significantly shallower (higher value), steer away
      const diff = vL - vR;
      // If vL > vR (Left is shallower), diff > 0. We want to turn Right (increase angle).
      // If vR > vL (Right is shallower), diff < 0. We want to turn Left (decrease angle).
      const urgency = Math.max(0.5, (r.value - 0.2) * 2.0); 
      target += diff * urgency * 1.5; 
  }

  // 4. Gradient Descent (Emergency Center Bias)
  // If very close to bank, override with direct center vector
  if (r.value > 0.5) {
      const deepAngle = Math.atan2(-r.gy, -r.gx); // Gradient descent
      const blend = Math.max(0, Math.min(1, (r.value - 0.5) * 3.0));
      // Blend current target with deepAngle
      target = normalizeAngle(target + shortestAngleDiff(target, deepAngle) * blend);
  }

  // 5. Flocking (Optional)
  if (c.isFlocker && c.groupId) {
      let h = 0;
      for (let i = 0; i < c.groupId.length; i++) h = (h * 31 + c.groupId.charCodeAt(i)) >>> 0;
      const offset = (((h % 1000) / 999) - 0.5) * 0.5;
      const groupAngle = normalizeAngle(flowAngle + offset);
      const flockBase = c.flockStrength || 0;
      const depthFactor = Math.max(0, Math.min(1, 1.0 - r.value));
      const flockBlend = flockBase * (0.3 + 0.7 * depthFactor);
      if (flockBlend > 0) {
        target = normalizeAngle(target + shortestAngleDiff(target, groupAngle) * flockBlend);
      }
  }

  c.targetAngle = target;
  
  // Modulate speed based on turn sharpness to simulate physics
  const turnStress = Math.abs(shortestAngleDiff(c.angle, target));
  c.speedMult = Math.max(0.5, 1.0 - (turnStress * 0.5));
}

function enforceBoundaries(c, dt, noise, game) {
  // Use a longer lookahead to catch edges early
  const lookAhead = 2.0; 
  const nx = c.x + Math.cos(c.angle) * lookAhead;
  const ny = c.y + Math.sin(c.angle) * lookAhead;

  const river = noise.getRiverSystem(nx, ny);
  const pool = c.def.pool;

  if (pool === 'water') {
     // Threshold for "hard boundary"
     // value 1.0 is bank. We want to stop them before 1.0.
     if (river.value > 0.9) {
         // PANIC AVOIDANCE
         
         // 1. Find safe water direction via gradient descent
         const escapeAngle = Math.atan2(-river.gy, -river.gx);
         
         // 2. Override target
         c.targetAngle = escapeAngle;
         
         // 3. Boost turn rate significantly to allow tight smooth turn instead of snap
         c.turnBoost = 5.0; 
         
         // 4. Slow down
         c.speedMult = 0.5;
         
         // 5. Only nudge position if we are REALLY stuck (value >= 1.0)
         // This prevents jitter unless they actually crossed the line
         if (river.value >= 1.0) {
             const push = Math.min(0.2, (river.value - 0.95));
             c.x += Math.cos(escapeAngle) * push;
             c.y += Math.sin(escapeAngle) * push;
         }
     }
  } 
  else if (pool === 'land') {
    // Bounce off water and prefer nearby land tiles
    const isWater = river.value < 1.0;
    if (isWater) {
      const foundLand = findNearbyLandDirection(c.x, c.y, noise, 6);
      if (foundLand !== null) {
        c.targetAngle = foundLand;
      } else {
        // If we can't find land, follow gradient back to land
        c.targetAngle = normalizeAngle(Math.atan2(river.gy, river.gx));
      }
      
      // Boost turn instead of snapping
      c.turnBoost = 5.0;
      
      // Stop moving forward into water
      c.speedMult = 0; 
    }
    // Additionally, enforce habitat preference: if creature has habitat and current tile mismatches,
    // gently bias targetAngle towards nearest matching tile.
    if (c.def.habitat && c.def.habitat.length > 0) {
      const preferred = biasTowardsHabitat(c, noise, game);
      if (preferred !== null) {
        c.targetAngle = preferred;
      }
    }
  }
  // Air has no boundaries
}

// Helper: sample around a point to find nearest water direction (returns angle or null)
function findNearbyWaterDirection(x, y, noise, maxRadius) {
  const SAMPLES = 24;
  for (let r = 1; r <= maxRadius; r += 1) {
    for (let i = 0; i < SAMPLES; i++) {
      const a = (i / SAMPLES) * Math.PI * 2;
      const sx = x + Math.cos(a) * r;
      const sy = y + Math.sin(a) * r;
      const info = noise.getRiverSystem(sx, sy);
      // Require a clearer interior water reading so we bias towards deeper spots
      if (info.value < 0.6) {
        return Math.atan2(sy - y, sx - x);
      }
    }
  }
  return null;
}

// Helper: sample around a point to find nearest land direction (returns angle or null)
function findNearbyLandDirection(x, y, noise, maxRadius) {
  const SAMPLES = 24;
  for (let r = 1; r <= maxRadius; r += 1) {
    for (let i = 0; i < SAMPLES; i++) {
      const a = (i / SAMPLES) * Math.PI * 2;
      const sx = x + Math.cos(a) * r;
      const sy = y + Math.sin(a) * r;
      const info = noise.getRiverSystem(sx, sy);
      if (info.value >= 1.0) {
        return Math.atan2(sy - y, sx - x);
      }
    }
  }
  return null;
}

// Helper: bias creature towards matching habitat (returns angle or null)
function biasTowardsHabitat(c, noise, game) {
  const mapping = { 'forest': game.CONSTANTS.TILE_FOREST, 'grass': game.CONSTANTS.TILE_GRASS, 'bank': game.CONSTANTS.TILE_BANK };
  const prefs = c.def.habitat || [];
  const SAMPLES = 32;
  const radius = 8;
  for (let i = 0; i < SAMPLES; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    const sx = c.x + Math.cos(a) * r;
    const sy = c.y + Math.sin(a) * r;
    const tx = Math.floor(sx);
    const ty = Math.floor(sy);
    const tile = game.getTile(tx, ty);
    if (prefs.some(p => mapping[p] === tile)) {
      return Math.atan2(sy - c.y, sx - c.x);
    }
  }
  return null;
}