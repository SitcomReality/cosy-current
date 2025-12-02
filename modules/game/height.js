import { TILE_WATER, TILE_BANK, TILE_GRASS, TILE_FOREST } from './constants.js';

// Height & tile classification logic (uses noise.getRiverSystem and noise.sample)
export function createHeightModule(noise) {
  // Quantized levels — simplified so we don't produce terrain above forest
  const LEVELS = [0.05, 0.2, 0.35, 0.6];

  function quantize(h) {
    let closest = LEVELS[0];
    let bestDist = Math.abs(h - closest);
    for (let i = 1; i < LEVELS.length; i++) {
      const d = Math.abs(h - LEVELS[i]);
      if (d < bestDist) {
        bestDist = d;
        closest = LEVELS[i];
      }
    }
    return closest;
  }

  function getHeight(x, y) {
    const river = noise.getRiverSystem(x, y);

    // Base height is distance from river center
    let baseH = river.value * 0.15;

    // Add noise texture
    const n1 = noise.sample(x * 0.5, y * 0.5, 0);
    const n2 = noise.sample(x * 0.1, y * 0.1, 100);

    let h = baseH + (n1 * 0.05) + (n2 * 0.15);
    h += 0.1;

    if (river.value < 0.8) {
      const depth = 1.0 - (river.value / 0.8);
      h -= depth * 0.2;
    }

    h = Math.max(0, Math.min(1, h));
    return quantize(h);
  }

  function getTile(x, y) {
    const river = noise.getRiverSystem(x, y);
    const h = getHeight(x, y);

    if (river.value < 1.0) return TILE_WATER;
    if (river.value < 1.3) return TILE_BANK;

    if (h < 0.45) return TILE_GRASS;
    // Anything higher becomes forest (no hill/mountain)
    return TILE_FOREST;
  }

  return { getHeight, getTile };
}