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
  function maintainEntities(getHeight, player) {
    if (state.entities.length < 10) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 50;
      const ex = player.x + Math.cos(angle) * dist;
      const ey = player.y + Math.sin(angle) * dist;
      if (getHeight(ex, ey) > 0.3) {
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