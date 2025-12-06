import { normalizeAngle, shortestAngleDiff } from './utils.js';
import { applyFlowFollow } from './behaviors/flowFollow.js';
import { applyFlyStraight } from './behaviors/flyStraight.js';
import { applyScuttle } from './behaviors/scuttle.js';
import { applyWander } from './behaviors/wander.js';
import { enforceBoundaries } from './behaviors/boundaries.js';
import { applyTurtle } from './behaviors/turtle.js';

// Orchestrator: keeps the public API stable
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
  } else if (behavior === 'turtle') {
    applyTurtle(c, dt, noise);
  } else {
    // Default wander
    applyWander(c, dt);
  }

  // 2. Boundary Enforcement (Bounce/Steer away from forbidden terrain)
  enforceBoundaries(c, dt, noise, game);

  // 3. Physics (Turn & Move)
  // Scuttle and turtle have special movement handling (stop and go)
  if ((behavior === 'scuttle' || behavior === 'turtle') && c.isStopped) {
    // Don't move
    return;
  }

  // Apply turn boost if requested by boundary logic for smoother avoidance
  const turnSpeed = c.turnRate * c.turnBoost * dt;
  const angleDiff = shortestAngleDiff(c.angle, c.targetAngle);
  const turn = Math.max(-turnSpeed, Math.min(turnSpeed, angleDiff));
  c.angle = normalizeAngle(c.angle + turn);

  const speed = c.speed * c.speedMult;
  c.x += Math.cos(c.angle) * speed * dt;
  c.y += Math.sin(c.angle) * speed * dt;
}