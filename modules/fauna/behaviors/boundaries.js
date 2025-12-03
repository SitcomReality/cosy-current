import { normalizeAngle } from '../utils.js';
import { getRiverInfo, getCenterAngleAt, getLandwardAngleAt } from './riverUtils.js';

// Helper: sample around a point to find nearest land direction (returns angle or null)
function findNearbyLandDirection(x, y, noise, maxRadius) {
  const SAMPLES = 24;
  for (let r = 1; r <= maxRadius; r += 1) {
    for (let i = 0; i < SAMPLES; i++) {
      const a = (i / SAMPLES) * Math.PI * 2;
      const sx = x + Math.cos(a) * r;
      const sy = y + Math.sin(a) * r;
      const info = getRiverInfo(noise, sx, sy);
      if (info.value >= 1.0) {
        return Math.atan2(sy - y, sx - x);
      }
    }
  }
  return null;
}

// Helper: bias creature towards matching habitat (returns angle or null)
function biasTowardsHabitat(c, noise, game) {
  const mapping = {
    forest: game.CONSTANTS.TILE_FOREST,
    grass: game.CONSTANTS.TILE_GRASS,
    bank: game.CONSTANTS.TILE_BANK
  };
  const prefs = c.def.habitat || [];
  if (!prefs.length) return null;

  const SAMPLES = 32;
  const radius = 8;
  for (let i = 0; i < SAMPLES; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    const sx = c.x + Math.cos(a) * r;
    const sy = c.y + Math.sin(a) * r;
    const tx = Math.floor(sx);
    const ty = Math.floor(sy);
    const tile = game.getTile(tx, ty);
    if (prefs.some(p => mapping[p] === tile)) {
      return Math.atan2(sy - c.y, sx - c.x);
    }
  }
  return null;
}

export function enforceBoundaries(c, dt, noise, game) {
  // Use a longer lookahead to catch edges early
  const lookAhead = 2.0;
  const nx = c.x + Math.cos(c.angle) * lookAhead;
  const ny = c.y + Math.sin(c.angle) * lookAhead;

  const river = getRiverInfo(noise, nx, ny);
  const pool = c.def.pool;

  if (pool === 'water') {
    // Threshold for "hard boundary"
    // value 1.0 is bank. We want to stop them before 1.0.
    if (river.value > 0.9) {
      // PANIC AVOIDANCE

      // 1. Find safe water direction via gradient descent back into deeper water
      const escapeAngle = getCenterAngleAt(noise, nx, ny);

      // 2. Override target
      c.targetAngle = escapeAngle;

      // 3. Boost turn rate significantly to allow tight smooth turn instead of snap
      c.turnBoost = 5.0;

      // 4. Slow down while avoiding
      c.speedMult = 0.5;

      // 5. Only nudge position if we are REALLY stuck (value >= 1.0)
      // This prevents jitter unless they actually crossed the line
      if (river.value >= 1.0) {
        const push = Math.min(0.2, (river.value - 0.95));
        c.x += Math.cos(escapeAngle) * push;
        c.y += Math.sin(escapeAngle) * push;
      }
    }
  } else if (pool === 'land') {
    // Bounce off water and prefer nearby land tiles
    const isWater = river.value < 1.0;
    if (isWater) {
      const foundLand = findNearbyLandDirection(c.x, c.y, noise, 6);
      if (foundLand !== null) {
        c.targetAngle = foundLand;
      } else {
        // If we can't find land, follow gradient back to land (towards bank)
        c.targetAngle = normalizeAngle(getLandwardAngleAt(noise, nx, ny));
      }

      // Boost turn instead of snapping
      c.turnBoost = 5.0;

      // Stop moving forward into water
      c.speedMult = 0;
    }

    // Additionally, enforce habitat preference: if creature has habitat and current tile mismatches,
    // gently bias targetAngle towards nearest matching tile.
    const preferred = biasTowardsHabitat(c, noise, game);
    if (preferred !== null) {
      c.targetAngle = preferred;
    }
  }
  // Air has no boundaries
}