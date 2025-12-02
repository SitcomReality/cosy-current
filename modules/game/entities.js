import { ENTITY_CITY, ENTITY_RELIC } from './constants.js';

export function createEntitiesModule(state) {
  function spawnEntity(x, y, type) {
    state.entities.push({
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      type,
      timer: 0
    });
  }

  // Manage spawning and cleanup used by game.update
  // Now accepts getTile and getHeight for placement checks
  function maintainEntities(getTile, getHeight, player) {
    if (state.entities.length < 10) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 50;
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
            if (t !== 3) { // TILE_GRASS === 3 (from constants)
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
        spawnEntity(ex, ey, Math.random() > 0.5 ? ENTITY_CITY : ENTITY_RELIC);
      }
    }

    state.entities = state.entities.filter(e => {
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      return d < 150;
    });
  }

  return { spawnEntity, maintainEntities };
}