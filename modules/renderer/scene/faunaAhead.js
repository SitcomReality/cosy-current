import { renderBirds } from '../fauna/index.js';

// Render birds in front of the raft
export function renderBirdsAhead(ctx, state, tileSize, cycle, shadowDir, noise) {
  if (!state.fauna || !state.fauna.creatures) return;
  renderBirds(ctx, state, tileSize, state.fauna.creatures, cycle, shadowDir, noise, cycle.raftLightActive);
}