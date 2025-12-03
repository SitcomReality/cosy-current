import { normalizeAngle } from '../utils.js';

export function applyWander(c, dt) {
  if (c.wanderTimer <= 0) {
    c.wanderTimer = 1.0 + Math.random() * 2.0;
    const delta = (Math.random() - 0.5) * (Math.PI / 1.5);
    c.targetAngle = normalizeAngle(c.targetAngle + delta);
  }
}

