import { seedPermutation } from '../noise_algorithms/permutations.js';

// River helper utilities that depend on noise engine
export function getRiverVector(noise, x, y, currentAngle) {
  // Sample nearby points to find gradient of the distance field
  const d = 0.5; // Sampling delta
  const info = noise.getRiverSystem(x, y);

  const trackingX = info.distX < info.distY;

  const baseInfo = info;
  const infoX = noise.getRiverSystem(x + d, y);
  const infoY = noise.getRiverSystem(x, y + d);

  const v0 = trackingX ? baseInfo.distX : baseInfo.distY;
  const vx = trackingX ? infoX.distX : infoX.distY;
  const vy = trackingX ? infoY.distX : infoY.distY;

  let gradX = (vx - v0) / d;
  let gradY = (vy - v0) / d;

  // Clamp gradient to avoid extreme values near edges that cause jitter
  const gradLen = Math.hypot(gradX, gradY);
  if (gradLen > 0.0001) {
    const maxGrad = 1.0;
    const scale = Math.min(1.0, maxGrad / gradLen);
    gradX *= scale;
    gradY *= scale;
  } else {
    gradX = 0;
    gradY = 0;
  }

  // Gradient points AWAY from center (dist increases).
  // We want tangent: perpendicular to gradient.
  let tx = -gradY;
  let ty = gradX;

  // Normalize tangent
  const len = Math.hypot(tx, ty);
  if (len > 0.001) {
    tx /= len;
    ty /= len;
  } else {
    tx = Math.cos(currentAngle);
    ty = Math.sin(currentAngle);
  }

  // Ensure we don't flip 180 degrees instantly; pick direction closest to current heading
  const dot = tx * Math.cos(currentAngle) + ty * Math.sin(currentAngle);
  if (dot < 0) {
    tx = -tx;
    ty = -ty;
  }

  // Center pull vector (move towards river center)
  const centerStrength = Math.min(0.5, info.value * 0.9);
  const centerWeight = 0.25; // Reduced centering influence to allow edge movement

  const mx = tx * 0.9 - gradX * centerWeight * centerStrength;
  const my = ty * 0.9 - gradY * centerWeight * centerStrength;

  return Math.atan2(my, mx);
}