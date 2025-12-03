import { normalizeAngle, shortestAngleDiff } from './utils.js';

export function updateCreatureBehavior(c, dt, noise, game) {
  // Update timers
  c.life += dt;
  c.wanderTimer -= dt;
  if (c.wanderTimer < 0) c.wanderTimer = 0;

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
    const turnSpeed = c.turnRate * dt;
    const angleDiff = shortestAngleDiff(c.angle, c.targetAngle);
    const turn = Math.max(-turnSpeed, Math.min(turnSpeed, angleDiff));
    c.angle = normalizeAngle(c.angle + turn);

    const speed = c.speed * (c.speedMult || 1.0);
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
  // Fish align with river flow but sometimes meander or hover for variety.
  // River gradient (gx, gy) points to bank. Flow is perpendicular.
  const r = noise.getRiverSystem(c.x, c.y);

  if (c.wanderTimer <= 0) {
    // Decide sub-behavior with small probabilities to diversify movement
    const roll = Math.random();
    if (roll < 0.15) {
      // Hover / local meander: pick a slow random direction and linger
      c.wanderTimer = 1.0 + Math.random() * 2.0;
      c.targetAngle = normalizeAngle(c.angle + (Math.random() - 0.5) * Math.PI);
      // reduce speed a bit to feel like hovering
      c.speedMult = 0.6;
      return;
    } else if (roll < 0.35) {
      // True meander: pick a gentle random heading for some time
      c.wanderTimer = 2.0 + Math.random() * 3.0;
      c.targetAngle = normalizeAngle(c.angle + (Math.random() - 0.5) * Math.PI * 0.8);
      c.speedMult = 0.8;
      return;
    } else {
      // Default flow-follow / schooling behavior
      c.wanderTimer = 0.5;
      c.speedMult = 1.0;
    }

    // Calculate flow vector (tangent to gradient)
    // We arbitrarily pick one winding direction (-gy, gx)
    const flowAngle = Math.atan2(r.gx, -r.gy); // Rotate 90 deg

    // Mix flow angle with some wander
    const wander = (Math.random() - 0.5) * 0.6;

    // If we are facing roughly against flow, should we turn around?
    // Let's just steer towards flow.
    let target = normalizeAngle(flowAngle + wander);

    // Avoid shallow water actively: prefer deeper values (r.value small)
    // Stronger avoidance of shallow water: start correcting earlier and blend more strongly.
    if (r.value > 0.4) {
      // Steer towards deep (0 value), which is opposite to gradient (gx, gy)
      const deepAngle = Math.atan2(-r.gy, -r.gx);
      // Blend it in more aggressively so creatures move into deeper channel when near shore
      const blend = Math.min(1, (r.value - 0.4) * 3.0); // increased sensitivity (starts at 0.4)
      // Proper angle interpolation: combine weighted contributions
      // Use slerp-like mix via weighted average then normalize
      target = normalizeAngle(target * (1 - blend) + deepAngle * blend);
      // Also apply a small immediate nudge away from shore to reduce beaching
      c.x += Math.cos(deepAngle) * 0.02;
      c.y += Math.sin(deepAngle) * 0.02;
    }

    c.targetAngle = target;
  }
}

function enforceBoundaries(c, dt, noise, game) {
  const lookAhead = 1.2; // increase lookahead so creatures detect shore sooner
  const nx = c.x + Math.cos(c.angle) * lookAhead;
  const ny = c.y + Math.sin(c.angle) * lookAhead;

  const river = noise.getRiverSystem(nx, ny);
  const isWater = river.value < 1.0;

  const pool = c.def.pool;

  if (pool === 'water' && !isWater) {
    // Strong corrective steering: find nearest nearby water direction and steer there,
    // and nudge position slightly back so creatures don't "walk" across land.
    const found = findNearbyWaterDirection(c.x, c.y, noise, 8); // search farther
    if (found !== null) {
      c.targetAngle = found;
      // Nudge back along that heading stronger so creatures move back into water quickly
      c.x += Math.cos(found) * 0.25;
      c.y += Math.sin(found) * 0.25;
    } else {
      // Fallback: reflect away from gradient (try opposite of land normal)
      c.targetAngle = normalizeAngle(Math.atan2(-river.gy, -river.gx));
      c.x += Math.cos(c.targetAngle) * 0.12;
      c.y += Math.sin(c.targetAngle) * 0.12;
    }
    // Ensure no lingering slowed multiplier from any prior wander sub-behavior
    c.speedMult = 1.0;
    // Aggressively snap angle so we don't continue onto sand
    c.angle = c.targetAngle;
  } else if (pool === 'land') {
    // Bounce off water and prefer nearby land tiles
    if (isWater) {
      const foundLand = findNearbyLandDirection(c.x, c.y, noise, 6);
      if (foundLand !== null) {
        c.targetAngle = foundLand;
        c.x += Math.cos(foundLand) * 0.12;
        c.y += Math.sin(foundLand) * 0.12;
      } else {
        // If we can't find land, follow gradient back to land
        c.targetAngle = normalizeAngle(Math.atan2(river.gy, river.gx));
      }
      c.angle = c.targetAngle; // snap to avoid repeated entering water
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
      if (info.value < 0.8) {
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