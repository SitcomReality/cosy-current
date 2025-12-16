// Thin orchestrator composing the split game modules
import * as C from './game/constants.js';
import { createHeightModule } from './game/height.js';
import * as riverModuleHelpers from './game/river.js'; // Imports getSmartSteering
import { createEntitiesModule } from './game/entities.js';
import { createPlayerModule } from './game/player.js';

export function createGame({ state, noise }) {
  const heightModule = createHeightModule(noise);
  const entitiesModule = createEntitiesModule(state);
  // Pass the entire helper module so player can access getSmartSteering
  const playerModule = createPlayerModule(state, noise, heightModule, riverModuleHelpers, entitiesModule);

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

  // Initial spawn: find a river spot
  // Only run this if the state hasn't been initialized (i.e. not loaded from save)
  if (!state.hasInitialized) {
    let foundSpot = false;
    let attempts = 0;
    while (!foundSpot && attempts < 200) {
      const tx = (Math.random() - 0.5) * 5000;
      const ty = (Math.random() - 0.5) * 5000;
      const info = noise.getRiverSystem(tx, ty);
      
      // Try to spawn in deep water
      if (info.isRiver && info.value < 0.5) {
        state.player.x = tx;
        state.player.y = ty;
        
        // Determine best initial angle by scanning
        // Scan 8 directions
        let bestAngle = 0;
        let maxConf = -1;
        for(let a=0; a<Math.PI*2; a+=Math.PI/4) {
            const res = riverModuleHelpers.getSmartSteering(noise, tx, ty, a);
            if (res.confidence > maxConf) {
                maxConf = res.confidence;
                bestAngle = res.angle;
            }
        }
        
        state.player.angle = bestAngle;
        foundSpot = true;
      }
      attempts++;
    }
    state.hasInitialized = true;
  }

  return {
    getTile,
    getHeight,
    spawnEntity,
    update,
    CONSTANTS: {
      TILE_WATER: C.TILE_WATER, TILE_BANK: C.TILE_BANK, TILE_GRASS: C.TILE_GRASS,
      TILE_FOREST: C.TILE_FOREST,
      ENTITY_CITY: C.ENTITY_CITY, ENTITY_RELIC: C.ENTITY_RELIC,
      INTERACTION_RADIUS: C.INTERACTION_RADIUS
    }
  };
}