import { renderFauna } from '../fauna/index.js';

// Render non-bird fauna behind props and player
export function renderFaunaBehind(ctx, state, tileSize, cycle, shadowDir, noise) {
  if (!state.fauna || !state.fauna.creatures) return;
  // Pass through raftLightActive from the cycle; the fauna renderer already knows how to use it
  renderFauna(ctx, state, tileSize, state.fauna.creatures, cycle, shadowDir, noise, cycle.raftLightActive);
}