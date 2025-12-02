// Palette and color resolution helpers
export const PALETTE_DEF = {
  waterDeep: { oklch: 'oklch(45% 0.12 250)', hex: '#0b63a8' },
  waterShallow: { oklch: 'oklch(65% 0.1 240)', hex: '#5fb2e6' },
  sand: { oklch: 'oklch(92% 0.06 95)', hex: '#f0d6a6' },
  grass: { oklch: 'oklch(78% 0.16 135)', hex: '#6fbf3f' },
  forest: { oklch: 'oklch(52% 0.14 145)', hex: '#2f6b2b' },
  hill: { oklch: 'oklch(70% 0.04 280)', hex: '#9a87a8' },
  mountain: { oklch: 'oklch(92% 0.01 280)', hex: '#f5f3f7' },
  treeForest: { oklch: 'oklch(42% 0.14 145)', hex: '#254e22' },
  treeGrass: { oklch: 'oklch(60% 0.16 140)', hex: '#49a33a' }
};

export function chooseColor(entry) {
  if (!entry) return '#ff00ff';
  // Always prefer hex fallback for safety in older browsers; ok to extend later.
  return entry.hex || entry.oklch || '#ff00ff';
}

// Resolve palettes into runtime-friendly values for renderer
export function resolvePalettes(game) {
  const WATER_PALETTE = {};
  const COLORS = {};
  WATER_PALETTE.deep = chooseColor(PALETTE_DEF.waterDeep);
  WATER_PALETTE.shallow = chooseColor(PALETTE_DEF.waterShallow);

  COLORS[game.CONSTANTS.TILE_WATER] = chooseColor(PALETTE_DEF.waterShallow);
  COLORS[game.CONSTANTS.TILE_BANK] = chooseColor(PALETTE_DEF.sand);
  COLORS[game.CONSTANTS.TILE_GRASS] = chooseColor(PALETTE_DEF.grass);
  COLORS[game.CONSTANTS.TILE_FOREST] = chooseColor(PALETTE_DEF.forest);
  COLORS[game.CONSTANTS.TILE_HILL] = chooseColor(PALETTE_DEF.hill);
  COLORS[game.CONSTANTS.TILE_MOUNTAIN] = chooseColor(PALETTE_DEF.mountain);

  // Expose tree colors as resolved hex strings for drawing
  const TREES = {
    treeForest: chooseColor(PALETTE_DEF.treeForest),
    treeGrass: chooseColor(PALETTE_DEF.treeGrass)
  };

  return { WATER_PALETTE, COLORS, TREES };
}