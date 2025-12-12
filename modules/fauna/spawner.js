import { createSpawner as createModularSpawner } from './spawner/index.js';
export function createSpawner(game, noise, state) {
  return createModularSpawner(game, noise, state);
}