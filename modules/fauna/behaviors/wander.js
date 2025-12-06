import { normalizeAngle } from '../utils.js';

export function applyWander(c, dt) {
  // Make sheep wander more placidly: longer pauses and smaller angle changes
  if (c.wanderTimer <= 0) {
    // Default timings for most creatures
    let intervalMin = 1.0;
    let intervalMax = 3.0;
    let maxDelta = (Math.PI / 1.5);

    // Gentle tuning for sheep
    if (c.type === 'sheep') {
      intervalMin = 2.0;
      intervalMax = 4.5; // longer pauses between decisions
      maxDelta = Math.PI / 4.5; // smaller turn angles for smoother motion
    }

    c.wanderTimer = intervalMin + Math.random() * (intervalMax - intervalMin);
    const delta = (Math.random() - 0.5) * maxDelta;
    c.targetAngle = normalizeAngle(c.targetAngle + delta);
  }
}

