import { normalizeAngle } from '../utils.js';

export function applyScuttle(c, dt) {
  // Crabs pause frequently
  if (c.wanderTimer <= 0) {
    if (c.isStopped) {
      // Start moving
      c.isStopped = false;
      c.wanderTimer = 0.5 + Math.random() * 1.5;
      // Pick new direction
      const delta = (Math.random() - 0.5) * Math.PI;
      c.targetAngle = normalizeAngle(c.targetAngle + delta);
    } else {
      // Stop
      c.isStopped = true;
      c.wanderTimer = 0.5 + Math.random() * 1.0;
    }
  }
}