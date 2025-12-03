export function normalizeAngle(a) {
  while (a <= -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

export function shortestAngleDiff(a, b) {
  let diff = b - a;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return diff;
}

export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

