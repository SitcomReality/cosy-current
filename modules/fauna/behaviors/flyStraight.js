import { normalizeAngle } from '../utils.js';

export function applyFlyStraight(c, dt) {
  // Birds pick a distant point and stick to it mostly
  if (c.wanderTimer <= 0) {
    c.wanderTimer = 3.0 + Math.random() * 2.0;
    // Slight course correction
    const delta = (Math.random() - 0.5) * 0.2;
    c.targetAngle = normalizeAngle(c.targetAngle + delta);
  }
}