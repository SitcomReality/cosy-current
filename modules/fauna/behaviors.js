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
  // Fish align with river flow
  // River gradient (gx, gy) points to bank. Flow is perpendicular.
  const r = noise.getRiverSystem(c.x, c.y);

  if (c.wanderTimer <= 0) {
    c.wanderTimer = 0.5;

    // Calculate flow vector (tangent to gradient)
    // We arbitrarily pick one winding direction (-gy, gx)
    const flowAngle = Math.atan2(r.gx, -r.gy); // Rotate 90 deg

    // Mix flow angle with some wander
    const wander = (Math.random() - 0.5) * 1.0;

    // If we are facing roughly against flow, should we turn around?
    // Let's just steer towards flow.
    c.targetAngle = normalizeAngle(flowAngle + wander);

    // Avoid shallow water actively
    if (r.value > 0.6) {
      // Steer towards deep (0 value), which is opposite to gradient (gx, gy)
      const deepAngle = Math.atan2(-r.gy, -r.gx);
      // Blend it in
      c.targetAngle = normalizeAngle(deepAngle); 
    }
  }
}

function enforceBoundaries(c, dt, noise, game) {
  const lookAhead = 1.0;
  const nx = c.x + Math.cos(c.angle) * lookAhead;
  const ny = c.y + Math.sin(c.angle) * lookAhead;

  const river = noise.getRiverSystem(nx, ny);
  const isWater = river.value < 1.0;

  const pool = c.def.pool;

  if (pool === 'water' && !isWater) {
    // Bounce off land
    const normal = Math.atan2(river.gy, river.gx); // Gradient points to land
    // We want to reflect or just turn away. 
    // Simply turning towards deep water (-gradient) is reliable.
    c.targetAngle = normalizeAngle(Math.atan2(-river.gy, -river.gx));
    c.angle = c.targetAngle; // Hard snap to avoid stuck
  } else if (pool === 'land') {
    // Bounce off water
    if (isWater) {
      // Gradient points to land, so just follow gradient
      c.targetAngle = normalizeAngle(Math.atan2(river.gy, river.gx));
      c.angle = c.targetAngle;
    }

    // Also optional: enforce habitat preference if wandering?
    // If not in preferred habitat, steer randomly? 
    // Kept simple for now to avoid stuckness.
  }
  // Air has no boundaries
}