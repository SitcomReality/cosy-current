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
    // Derive a stable deterministic base offset for the group
    let h = 0;
    for (let i = 0; i < c.groupId.length; i++) {
      h = (h * 31 + c.groupId.charCodeAt(i)) >>> 0;
    }
    // Group base offset in range [-0.35..0.35] radians
    const groupOffset = (((h % 1000) / 999) - 0.5) * 0.7;

    // Compute groupAngle by applying offset to current heading or stored groupAngle
    // Prefer a stored groupBaseAngle (often set at spawn), fallback to current angle
    const base = (typeof c.groupBaseAngle === 'number') ? c.groupBaseAngle : c.angle;
    const groupAngle = normalizeAngle(base + groupOffset);

    // Use flockStrength if available (spawn provides flockStrength for birds)
    const flockStrength = (typeof c.flockStrength === 'number') ? c.flockStrength : (c.isFlocker ? 0.4 : 0);

    // Blend toward the groupAngle smoothly
    const angleDiff = shortestAngleDiff(c.angle, groupAngle);
    // Increase blend factor so birds in flocks more strongly converge to the group heading,
    // while still keeping turning smooth; clamp to prevent instant snaps.
    const blendFactor = Math.max(0.06, Math.min(0.85, flockStrength * 0.35));
    c.targetAngle = normalizeAngle(c.targetAngle + angleDiff * blendFactor);

    // Slightly reduce per-bird wobble for flock members to keep coherence
    if (!c._birdWobbleDamp) c._birdWobbleDamp = 1.0;
    c._birdWobbleDamp = 0.85;

    // Optionally remember base for next frames so the group has a coherent heading anchor
    // If groupBaseAngle wasn't provided at spawn, gently establish one now as an average
    if (typeof c.groupBaseAngle !== 'number') {
      c.groupBaseAngle = normalizeAngle(c.angle);
    } else {
      // slowly nudge stored base toward current mean to allow the flock to turn together over time
      const stored = c.groupBaseAngle;
      const meanDiff = shortestAngleDiff(stored, c.angle);
      c.groupBaseAngle = normalizeAngle(stored + meanDiff * 0.02);
    }
  }
}