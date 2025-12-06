import { normalizeAngle } from '../utils.js';
import { applyFlowFollow } from './flowFollow.js';

// Slow aquatic turtles that sometimes stop and linger, then slowly accelerate
export function applyTurtle(c, dt, noise) {
  // Ensure timers/state
  if (c.turtleTimer === undefined) c.turtleTimer = 0;
  if (c.isStopped === undefined) c.isStopped = false;

  // Always use flow-follow steering so turtles follow the river shape
  applyFlowFollow(c, dt, noise);

  // Linger logic
  c.turtleTimer -= dt;
  if (c.turtleTimer <= 0) {
    c.turtleTimer = 0;

    if (c.isStopped) {
      // Resume moving
      c.isStopped = false;
      // Move for 4–10 seconds
      c.turtleTimer = 4 + Math.random() * 6;
    } else {
      // Enter a lingering stop
      c.isStopped = true;
      // Linger 3–8 seconds
      c.turtleTimer = 3 + Math.random() * 5;
    }
  }

  const baseSpeed = c.def.speed || c.speed || 0.7;
  const accel = baseSpeed * 0.6;
  const decel = baseSpeed * 1.2;

  if (c.isStopped) {
    // Gently come to rest
    c.speed = Math.max(0, c.speed - decel * dt);
    // Ensure we don't move even if flowFollow tried to set speedMult
    c.speedMult = 0;
    return;
  }

  // When moving, accelerate slowly up to a modest cruising speed
  const targetMoveSpeed = baseSpeed * 0.8;
  if (!isFinite(c.speed)) c.speed = targetMoveSpeed * 0.3;
  if (c.speed < targetMoveSpeed) {
    c.speed = Math.min(targetMoveSpeed, c.speed + accel * dt);
  } else {
    c.speed = Math.max(targetMoveSpeed * 0.7, c.speed - accel * 0.4 * dt);
  }

  // Slow creatures overall compared to fish/eels
  c.speedMult *= 0.5;

  // Normalize angle safety (flowFollow already does, but keep consistent with other behaviors)
  c.targetAngle = normalizeAngle(c.targetAngle);
}