// Robust steering logic using sensor array
// Revised to be "Winner-Take-All" to avoid averaging decisions into walls,
// and strictly forward-facing to prevent U-turns.
export function getSmartSteering(noise, x, y, currentAngle) {
  const RAY_COUNT = 15;        // More rays for finer resolution
  const SCAN_ARC = 2.2;        // ~126 degrees total (+/- 63 degrees). 
                               // Kept < PI/2 per side to strictly prevent U-turns.
  const LOOKAHEAD = 14.0;      // Look far ahead to anticipate corners early
  const STEP = 1.5;            // Sampling resolution along the ray

  const angles = new Float32Array(RAY_COUNT);
  const scores = new Float32Array(RAY_COUNT);

  let bestScore = -Infinity;
  let bestIdx = (RAY_COUNT - 1) / 2; // Default to center

  // 1. Cast Rays
  for (let i = 0; i < RAY_COUNT; i++) {
    // Distribute i from 0 to RAY_COUNT-1 across the arc
    // t = -1 .. 1
    const t = (i / (RAY_COUNT - 1)) * 2 - 1; 
    const rayAngle = currentAngle + t * (SCAN_ARC / 2);
    angles[i] = rayAngle;

    let score = 0;
    
    // Sample along ray
    for (let d = STEP; d <= LOOKAHEAD; d += STEP) {
      const rx = x + Math.cos(rayAngle) * d;
      const ry = y + Math.sin(rayAngle) * d;
      
      const info = noise.getRiverSystem(rx, ry);
      
      // info.value: 0=deep, 1=bank. >1=land
      if (info.value >= 1.0) {
        // Hit land. 
        // Penalize based on proximity. Closer hit = bigger penalty.
        // We subtract a large value so these paths are heavily disfavored.
        // (LOOKAHEAD - d) is large when d is small (close hit).
        score -= (LOOKAHEAD - d) * 8.0;
        // Stop raymarching this ray
        break;
      }
      
      // Bonus for deep water (0..1 range inverted)
      // info.value is 0 at center. We want to maximize score.
      // Square it to strongly prefer the deep center channel.
      score += Math.pow(Math.max(0, 1.0 - info.value), 2); 
    }

    // Center Bias:
    // Prefer angles close to current heading (center of arc) to maintain momentum 
    // and provide "commitment" (once we turn, center moves, reinforcing turn).
    score -= Math.abs(t) * 5.0; 

    scores[i] = score;
  }

  // 2. Smooth scores (simple blur) to treat "clusters" of good rays as better than single spikes.
  // This prevents steering into a 1-pixel gap or getting confused by noise.
  const smoothed = new Float32Array(RAY_COUNT);
  for (let i = 0; i < RAY_COUNT; i++) {
    let val = scores[i] * 0.4;
    
    // Add neighbor contributions
    if (i > 0) val += scores[i-1] * 0.3;
    else val += scores[i] * 0.3; // edge padding
    
    if (i < RAY_COUNT - 1) val += scores[i+1] * 0.3;
    else val += scores[i] * 0.3; // edge padding
    
    smoothed[i] = val;
  }

  // 3. Pick winner
  for (let i = 0; i < RAY_COUNT; i++) {
    if (smoothed[i] > bestScore) {
      bestScore = smoothed[i];
      bestIdx = i;
    }
  }

  // 4. Panic / Recovery
  // If best score is very low (negative), we are likely facing a wall or in very shallow water.
  // However, we strictly stick to the forward arc to avoid U-turns. 
  // The 'best' ray will essentially be the one that glances off the wall the shallowest
  // (hits land furthest away), effectively steering us away from the wall.
  
  // Normalize confidence (0..1) for debugging/UI
  // Max approx positive score per ray is roughly (LOOKAHEAD/STEP) * 1.0 ~= 9.0
  const confidence = Math.max(0, Math.min(1, bestScore / 8.0));

  return { angle: angles[bestIdx], confidence };
}