// Shared helpers for reading river info and gradients around creatures

// Sample main river info object (passthrough for clarity)
export function getRiverInfo(noise, x, y) {
  return noise.getRiverSystem(x, y);
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