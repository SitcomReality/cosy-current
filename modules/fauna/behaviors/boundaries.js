import { normalizeAngle } from '../utils.js';
import {
  getRiverInfo,
  getCenterAngleAt,
  getLandwardAngleAt,
  getWaterClearance
} from './riverUtils.js';

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
    // Work in absolute clearance (tiles from the bank) rather than the
    // width-normalized value. On a thin tributary `value > 0.9` can still be
    // most of a tile from land, while on a wide stretch it is much closer;
    // using clearance keeps the safety margin consistent for both.
    const currentInfo = getRiverInfo(noise, c.x, c.y);
    const currentClearance = getWaterClearance(currentInfo);
    const lookAheadClearance = getWaterClearance(river);
    const minClearance = 0.8;

    if (currentClearance < minClearance || lookAheadClearance < minClearance) {
      // PANIC AVOIDANCE

      // 1. Find safe water direction via gradient descent back into deeper water
      const escapeAngle = getCenterAngleAt(noise, nx, ny);

      // 2. Override target
      c.targetAngle = escapeAngle;

      // 3. Boost turn rate significantly to allow tight smooth turn instead of snap
      c.turnBoost = 4.0;

      // 4. Slow down while avoiding
      c.speedMult = Math.min(c.speedMult, 0.55);

      // 5. Nudge away from land if we are genuinely too close. The push scales
      // with how far past the margin we are, which avoids jitter.
      if (currentClearance < minClearance) {
        const push = Math.min(0.22, (minClearance - currentClearance) * 1.4 + 0.02);
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