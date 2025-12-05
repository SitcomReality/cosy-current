import { seedPermutation } from '../noise_algorithms/permutations.js';

// Robust steering logic using sensor array
// Shortest signed angle difference helper
function shortestAngleDiff(a, b) {
  let diff = b - a;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return diff;
}

export function getSmartSteering(noise, x, y, currentAngle) {
  const LOOKAHEAD = 6.0; // Look further ahead to smooth out grid transitions
  const SENSOR_COUNT = 7; // Odd number for center symmetry
  const FOV = Math.PI * 0.8; // Wide 144 degree field of view to see sharp turns
  
  let sumX = 0;
  let sumY = 0;
  let totalWeight = 0;
  let maxWeight = 0;

  // We want to "pull" the ship towards the deepest water.
  // We cast rays in an arc.
  for (let i = 0; i < SENSOR_COUNT; i++) {
    // Map i to -1..1
    const t = (i / (SENSOR_COUNT - 1)) * 2 - 1;
    const angleOffset = t * (FOV / 2);
    const sensorAngle = currentAngle + angleOffset;

    const sx = x + Math.cos(sensorAngle) * LOOKAHEAD;
    const sy = y + Math.sin(sensorAngle) * LOOKAHEAD;

    const info = noise.getRiverSystem(sx, sy);
    
    // Weighting function:
    // We want LOW river values (close to 0).
    // Value > 1.0 means land (weight 0).
    // Value 0.0 means deep center (high weight).
    // We raise to a power to sharply prefer the center channel.
    let weight = 0;
    
    if (info.value < 1.0) {
      // 0 -> 1, 1 -> 0
      const quality = 1.0 - info.value;
      weight = Math.pow(quality, 4); // Strong center bias
    } else {
        // Wall penalty
        weight = 0;
    }

    // Bias slightly towards the center sensor to maintain straightness in open water
    if (Math.abs(t) < 0.1) weight *= 1.2;

    sumX += Math.cos(sensorAngle) * weight;
    sumY += Math.sin(sensorAngle) * weight;
    totalWeight += weight;
    maxWeight = Math.max(maxWeight, weight);
  }

  // If we are stranded or facing a wall (all weights 0), 
  // we need a panic recovery or just gradient descent.
  if (totalWeight < 0.001) {
    // Fallback: look at immediate gradient to find water
    // Sample 4 cardinal directions close by
    let bestA = currentAngle + Math.PI; // Turn around by default
    let bestV = 999;
    
    for (let a = 0; a < Math.PI * 2; a += Math.PI/4) {
        const px = x + Math.cos(a) * 2;
        const py = y + Math.sin(a) * 2;
        const v = noise.getRiverSystem(px, py).value;
        if (v < bestV) {
            bestV = v;
            bestA = a;
        }
    }
    // Never suggest a full U-turn: clamp fallback angle away from 180° reversals.
    const MAX_TURN = Math.PI * 0.75; // ≈135°
    let diff = shortestAngleDiff(currentAngle, bestA);
    if (Math.abs(diff) > MAX_TURN) {
      diff = Math.sign(diff) * MAX_TURN;
      bestA = currentAngle + diff;
    }
    return { angle: bestA, confidence: 0 };
  }

  let targetAngle = Math.atan2(sumY, sumX);
  
  // Hard safety: avoid auto-steering into a U-turn relative to current heading.
  // Clamp recommended direction so it never points more than ~135° away.
  const MAX_TURN = Math.PI * 0.75;
  let diff = shortestAngleDiff(currentAngle, targetAngle);
  if (Math.abs(diff) > MAX_TURN) {
    diff = Math.sign(diff) * MAX_TURN;
    targetAngle = currentAngle + diff;
  }
  
  // Normalize confidence (0..1)
  // If maxWeight is low, it means even the best path is shallow.
  const confidence = Math.min(1, maxWeight * 2);

  return { angle: targetAngle, confidence };
}