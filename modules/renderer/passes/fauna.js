import { renderFauna, renderBirds } from '../fauna/index.js';

export function renderFaunaPass(ctx, state, tileSize, creatures, cycle, shadowDir, noise, raftLightActive) {
  if (!creatures || creatures.length === 0) return;
  renderFauna(ctx, state, tileSize, creatures, cycle, shadowDir, noise, raftLightActive);
}

export function renderBirdsPass(ctx, state, tileSize, creatures, cycle, shadowDir, noise, raftLightActive) {
  if (!creatures || creatures.length === 0) return;
  renderBirds(ctx, state, tileSize, creatures, cycle, shadowDir, noise, raftLightActive);
}

