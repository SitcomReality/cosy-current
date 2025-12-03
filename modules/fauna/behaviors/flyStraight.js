import { normalizeAngle } from '../utils.js';
import { shortestAngleDiff } from '../utils.js';

export function applyFlyStraight(c, dt) {
  // Birds pick a distant point and stick to it mostly
  if (c.wanderTimer <= 0) {
    c.wanderTimer = 3.0 + Math.random() * 2.0;
    // Slight course correction
    const delta = (Math.random() - 0.5) * 0.2;
    c.targetAngle = normalizeAngle(c.targetAngle + delta);
  }

  // If this bird is part of a flock, bias its target toward a shared group heading.
  if (c.isFlocker && c.groupId) {
    // If we have an explicit groupBaseAngle (set by formation spawner), stick to it.
    // Otherwise fallback to current angle as base (legacy).
    const groupAngle = (typeof c.groupBaseAngle === 'number') 
      ? c.groupBaseAngle 
      : c.angle;

    // Use flockStrength if available (spawn provides flockStrength for birds)
    const flockStrength = (typeof c.flockStrength === 'number') ? c.flockStrength : 0.4;

    // Blend toward the groupAngle smoothly
    const angleDiff = shortestAngleDiff(c.angle, groupAngle);
    
    // Apply small fraction per-frame so turn remains smooth; scale with flockStrength
    // Increase the alignment influence so they don't break formation as easily
    const blendFactor = Math.max(0.05, Math.min(0.5, flockStrength * 0.5));
    
    c.targetAngle = normalizeAngle(c.targetAngle + angleDiff * blendFactor);

    // Slightly reduce per-bird wobble for flock members to keep coherence
    if (!c._birdWobbleDamp) c._birdWobbleDamp = 1.0;
    c._birdWobbleDamp = 0.85;
    
    // Unlike previous logic, do not overwrite groupBaseAngle with current angle. 
    // We want the formation to maintain its original heading unless explicitly steered.
  }
}