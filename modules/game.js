// Thin orchestrator composing the split game modules
import * as C from './game/constants.js';
import { createHeightModule } from './game/height.js';
import * as riverModuleHelpers from './game/river.js';
import { createEntitiesModule } from './game/entities.js';
import { createPlayerModule } from './game/player.js';

export function createGame({ state, noise }) {
  const heightModule = createHeightModule(noise);
  const entitiesModule = createEntitiesModule(state);
  const playerModule = createPlayerModule(state, noise, heightModule, { getRiverVector: riverModuleHelpers.getRiverVector }, entitiesModule);

  function getHeight(x, y) {
    return heightModule.getHeight(x, y);
  }

  function getTile(x, y) {
    return heightModule.getTile(x, y);
  }

  function spawnEntity(x, y, type) {
    entitiesModule.spawnEntity(x, y, type);
  }

  function update(dt) {
    playerModule.update(dt);
  }

  // Initial spawn: find a river spot similar to previous logic
  let foundSpot = false;
  let attempts = 0;
  while (!foundSpot && attempts < 200) {
    const tx = (Math.random() - 0.5) * 5000;
    const ty = (Math.random() - 0.5) * 5000;
    const info = noise.getRiverSystem(tx, ty);
    if (info.isRiver && !info.isIntersection) {
      state.player.x = tx;
      state.player.y = ty;
      state.player.angle = riverModuleHelpers.getRiverVector(noise, tx, ty, 0);
      foundSpot = true;
    }
    attempts++;
  }

  return {
    getTile,
    getHeight,
    spawnEntity,
    update,
    CONSTANTS: {
      TILE_WATER: C.TILE_WATER, TILE_BANK: C.TILE_BANK, TILE_GRASS: C.TILE_GRASS,
      TILE_FOREST: C.TILE_FOREST, TILE_HILL: C.TILE_HILL, TILE_MOUNTAIN: C.TILE_MOUNTAIN,
      ENTITY_CITY: C.ENTITY_CITY, ENTITY_RELIC: C.ENTITY_RELIC,
      INTERACTION_RADIUS: C.INTERACTION_RADIUS
    }
  };
}