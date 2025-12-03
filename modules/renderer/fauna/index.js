// Fauna renderer entrypoint: composes shadows and drawers into the original API
import { drawCreatureShadow } from './shadow.js';
import { drawCreature } from './drawers.js';

// Fauna rendering with depth-aware shadows
export function renderFauna(ctx, state, tileSize, creatures, cycle, shadowDir, noise) {
  if (!creatures || creatures.length === 0) return;

  const centerX = state.width / 2;
  const centerY = state.height / 2;

  creatures.forEach(c => {
    // Skip birds in this pass; they'll be rendered in front of the player
    if (c.type === 'bird') return;

    const screenX = (c.x - state.camera.x) * tileSize + centerX;
    const screenY = (c.y - state.camera.y) * tileSize + centerY;

    // Cull off-screen
    if (screenX < -tileSize * 5 || screenX > state.width + tileSize * 5 ||
        screenY < -tileSize * 5 || screenY > state.height + tileSize * 5) return;

    const size = c.size * tileSize;

    // Draw shadow first
    if (cycle.shadowAlpha > 0.01 && cycle.shadowLength > 0.001) {
      drawCreatureShadow(ctx, state, tileSize, c, screenX, screenY, size, cycle, shadowDir, noise);
    }

    // Draw creature
    drawCreature(ctx, c, screenX, screenY, size, cycle);
  });
}

// Dedicated bird rendering pass
export function renderBirds(ctx, state, tileSize, creatures, cycle, shadowDir, noise) {
  if (!creatures || creatures.length === 0) return;

  const centerX = state.width / 2;
  const centerY = state.height / 2;

  creatures.forEach(c => {
    if (c.type !== 'bird') return;

    const screenX = (c.x - state.camera.x) * tileSize + centerX;
    const screenY = (c.y - state.camera.y) * tileSize + centerY;

    if (screenX < -tileSize * 5 || screenX > state.width + tileSize * 5 ||
        screenY < -tileSize * 5 || screenY > state.height + tileSize * 5) return;

    const size = c.size * tileSize;

    if (cycle.shadowAlpha > 0.01 && cycle.shadowLength > 0.001) {
      drawCreatureShadow(ctx, state, tileSize, c, screenX, screenY, size, cycle, shadowDir, noise);
    }
    drawCreature(ctx, c, screenX, screenY, size, cycle);
  });
}