// Shared helpers for reading river info and gradients around creatures
import { normalizeAngle } from '../utils.js';

// Sample main river info object (passthrough for clarity)
export function getRiverInfo(noise, x, y) {
  return noise.getRiverSystem(x, y);
}

// Distance from the nearest bank, in tiles. Unlike `value` (which is normalized
// by the local half-width), this is comparable across thin and wide stretches.
export function getWaterClearance(riverInfo) {
  const halfWidth = riverInfo.localHalfWidth || 7.5;
  return Math.max(0, (1 - riverInfo.value) * halfWidth);
}

// Junction proximity: both grid distances are small near a crossing, regardless
// of which arm the creature is currently in.
export function isNearJunction(riverInfo, margin = 1.15) {
  const halfWidth = riverInfo.localHalfWidth || 7.5;
  return Math.hypot(riverInfo.distX, riverInfo.distY) < halfWidth * margin;
}

// Bank direction plus gradient magnitude. The gradient points toward the
// nearest bank; its magnitude collapses on the exact centre line and at
// crossings, which callers use as an "ambiguous flow" signal.
export function getBankInfo(noise, x, y, eps = 1.6) {
  const gradient = getRiverGradient(noise, x, y, eps);
  return {
    angle: Math.atan2(gradient.gy, gradient.gx),
    mag: gradient.mag
  };
}

// Finite-difference gradient on the river "value" field
// value: 0 at deep center, ~1 at bank. Gradient points center -> bank.
export function getRiverGradient(noise, x, y, eps = 2.0) {
  const sample = (sx, sy) => noise.getRiverSystem(sx, sy).value;

  const vL = sample(x - eps, y);
  const vR = sample(x + eps, y);
  const vU = sample(x, y - eps);
  const vD = sample(x, y + eps);

  const gx = vR - vL;
  const gy = vD - vU;

  const mag = Math.hypot(gx, gy);
  if (mag < 1e-5) return { gx: 0, gy: 0, mag: 0 };

  return { gx: gx / mag, gy: gy / mag, mag };
}

// Flow direction: tangent to gradient, roughly parallel to the river
// Gradient (gx,gy) points toward bank; tangent is (-gy, gx).
export function getFlowAngleAt(noise, x, y) {
  const { gx, gy, mag } = getRiverGradient(noise, x, y);
  if (mag === 0) {
    // No clear gradient: arbitrary flow, but deterministic-ish
    return Math.random() * Math.PI * 2;
  }
  const flowX = -gy;
  const flowY = gx;
  return Math.atan2(flowY, flowX);
}

// Deep-center direction: opposite the gradient (points back into deeper water)
export function getCenterAngleAt(noise, x, y) {
  const { gx, gy, mag } = getRiverGradient(noise, x, y);
  if (mag === 0) {
    return Math.random() * Math.PI * 2;
  }
  const cx = -gx;
  const cy = -gy;
  return Math.atan2(cy, cx);
}

// Landward direction: along the gradient (toward shallower / land)
export function getLandwardAngleAt(noise, x, y) {
  const { gx, gy, mag } = getRiverGradient(noise, x, y);
  if (mag === 0) {
    return Math.random() * Math.PI * 2;
  }
  return Math.atan2(gy, gx);
}

// Choose a direction that leaves a river crossing cleanly.
//
// At a junction the min-distance field forms a little vortex: the tangent
// direction rotates all the way around the crossing, so following it makes
// creatures circle forever. Rays are cheap here and tell us which directions
// actually stay in water; the creature's existing heading breaks ties so it
// carries on through the junction instead of turning around.
export function chooseJunctionExit(noise, x, y, heading, riverInfo, bias = 0) {
  const halfWidth = riverInfo.localHalfWidth || 7.5;
  const step = Math.PI / 12; // 15 degrees
  // Probe well past the junction square (~1.4 * halfWidth) so rays into the
  // diagonal land corners are rejected rather than chosen at the last moment.
  const probeScales = [0.6, 1.1, 1.6, 2.1, 2.6];
  let bestAngle = null;
  let bestScore = -Infinity;

  for (let i = 0; i < 24; i++) {
    const angle = -Math.PI + i * step + bias;
    let clearanceSum = 0;
    let minClearance = Infinity;
    let blocked = false;

    for (let p = 0; p < probeScales.length; p++) {
      const dist = halfWidth * probeScales[p];
      const probe = noise.getRiverSystem(
        x + Math.cos(angle) * dist,
        y + Math.sin(angle) * dist
      );
      const clearance = (1 - probe.value) * halfWidth;
      if (clearance < 0.55) {
        blocked = true;
        break;
      }
      clearanceSum += Math.min(clearance, halfWidth * 0.75);
      minClearance = Math.min(minClearance, clearance);
    }

    if (blocked) continue;

    // Prefer open water, then the direction closest to where we're already
    // pointing. The small alignment term is enough to break the symmetry
    // between the forward arm and the perpendicular arms.
    const alignment = Math.cos(angle - heading);
    const score = minClearance * 1.2 + clearanceSum * 0.14 + alignment * 3.0;
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }

  return bestAngle === null ? normalizeAngle(heading) : normalizeAngle(bestAngle);
}
