import { createWakeSystem } from './wakes.js';
import { createWaveSystem } from './waves.js';

export function createWaterEffects({ state, game, noise }) {
  const wakeSystem = createWakeSystem(game);
  const waveSystem = createWaveSystem(game, noise);

  function update(dt) {
    wakeSystem.update(dt, state.player, state.isPlaying);
    waveSystem.update(dt, state.player, state.isPlaying);
  }

  function render(ctx, camera, tileSize) {
    wakeSystem.render(ctx, camera, tileSize, state);
    waveSystem.render(ctx, camera, tileSize, state);
  }

  return { update, render };
}

