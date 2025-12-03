// Helper: estimate local river flow direction near a given world position
export function getLocalFlowAngle(noise, wx, wy) {
  // Finite-difference sample on the river "value" field to get a local gradient
  const sample = (sx, sy) => {
    const info = noise.getRiverSystem(sx, sy);
    return info.value;
  };

  // Use a slightly wider epsilon for smoother gradients (less noise sensitivity)
  const eps = 2.0; 

  const vL = sample(wx - eps, wy);
  const vR = sample(wx + eps, wy);
  const vU = sample(wx, wy - eps);
  const vD = sample(wx, wy + eps);

  // Gradient points "uphill" (from river center 0.0 towards bank 1.0)
  const gradX = vR - vL;
  const gradY = vD - vU;

  const mag = Math.hypot(gradX, gradY);

  // If the field is locally flat (center of river or deep land), fallback to random
  if (mag < 0.001) {
    return Math.random() * Math.PI * 2;
  }

  // Calculate perpendicular vector to the gradient to find flow/bank-parallel direction.
  // Gradient is (gx, gy).
  // Perpendiculars are (-gy, gx) and (gy, -gx).
  // We use (-gy, gx) for the tangent vector.
  // Math.atan2(y, x) -> atan2(gx, -gy).
  return Math.atan2(gradX, -gradY);
}