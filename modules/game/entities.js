import { ENTITY_LANDMARK, ENTITY_RELIC, TILE_GRASS, LANDMARK_TYPES } from './constants.js';
import { INTERACTION_RADIUS } from './constants.js';

export function createEntitiesModule(state) {
  function spawnEntity(x, y, type) {
    state.entities.push({
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      type,
      timer: 0,
      // Landmarks get a subtype
      landmarkType: type === ENTITY_LANDMARK ? pickRandomLandmarkType() : null
    });
  }

  function pickRandomLandmarkType() {
    const types = Object.values(LANDMARK_TYPES);
    return types[Math.floor(Math.random() * types.length)];
  }

  // Manage spawning and cleanup used by game.update
  // Now accepts getTile and getHeight for placement checks
  function maintainEntities(getTile, getHeight, player) {
    if (state.entities.length < 8) { // reduced from 10
      const angle = Math.random() * Math.PI * 2;
      const dist = 25 + Math.random() * 40; // slightly closer
      const ex = player.x + Math.cos(angle) * dist;
      const ey = player.y + Math.sin(angle) * dist;

      // Only spawn if the center tile and all 8 neighbors are grass
      const tx = Math.floor(ex);
      const ty = Math.floor(ey);

      let allGrass = true;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const t = getTile(tx + ox, ty + oy);
          if (t !== undefined && t !== null) {
            if (t !== TILE_GRASS) { // require grass region; use constant for clarity
              allGrass = false;
              break;
            }
          } else {
            // If getTile returns undefined (out of bounds), treat as non-grass
            allGrass = false;
            break;
          }
        }
        if (!allGrass) break;
      }

      if (allGrass) {
        // Ensure no other entity is within INTERACTION_RADIUS * 2 (prevent overlapping interaction areas)
        const minDist = (INTERACTION_RADIUS || 20) * 2;
        let tooClose = false;
        for (const e of state.entities) {
          const d = Math.hypot(e.x - ex, e.y - ey);
          if (d < minDist) {
            tooClose = true;
            break;
          }
        }

        if (!tooClose) {
          // Only spawn landmarks now (no decorative relic markers)
          spawnEntity(ex, ey, ENTITY_LANDMARK);
        }
      }
    }

    state.entities = state.entities.filter(e => {
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      return d < 150;
    });
  }

  return { spawnEntity, maintainEntities };
}