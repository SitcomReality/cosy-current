import { ITEM_REGISTRY } from './modules/data/items.js';
import { MAX_INVENTORY_STACK } from './modules/game/constants.js';

export function createCollectablesModule(state) {
  function spawnCollectable(x, y, itemId) {
    if (!ITEM_REGISTRY[itemId]) return;
    
    state.collectables = state.collectables || [];
    state.collectables.push({
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      itemId,
      lifetime: 120, // 2 minutes before despawn
      maxLifetime: 120
    });
  }

  function maintainCollectables(player) {
    state.collectables = state.collectables || [];
    
    // Spawn new collectables occasionally
    if (Math.random() < 0.002 && state.collectables.length < 50) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 50;
      const cx = player.x + Math.cos(angle) * dist;
      const cy = player.y + Math.sin(angle) * dist;
      
      // Pick random item weighted by rarity
      let totalWeight = 0;
      const items = [];
      for (const key in ITEM_REGISTRY) {
        const item = ITEM_REGISTRY[key];
        totalWeight += item.rarity;
        items.push({ key, rarity: item.rarity });
      }
      
      let picked = Math.random() * totalWeight;
      for (const { key, rarity } of items) {
        picked -= rarity;
        if (picked <= 0) {
          spawnCollectable(cx, cy, key);
          break;
        }
      }
    }

    // Update and despawn
    for (let i = state.collectables.length - 1; i >= 0; i--) {
      const c = state.collectables[i];
      c.lifetime -= (1 / 60); // rough dt
      
      const dist = Math.hypot(c.x - player.x, c.y - player.y);
      if (c.lifetime <= 0 || dist > 150) {
        state.collectables.splice(i, 1);
      }
    }
  }

  function tryCollect(itemId) {
    if (!ITEM_REGISTRY[itemId]) return false;
    
    const item = ITEM_REGISTRY[itemId];
    state.inventory = state.inventory || {};
    state.collection = state.collection || {};

    // Unlock in collection if first time
    if (!state.collection[itemId]) {
      state.collection[itemId] = true;
      // Trigger notification here later
    }

    // Add to inventory (clamp to max)
    if (item.type === 'material') {
      state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
      state.inventory[itemId] = Math.min(MAX_INVENTORY_STACK, state.inventory[itemId]);
      return true;
    } else if (item.type === 'collectable') {
      // Collectables stack too
      state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
      state.inventory[itemId] = Math.min(MAX_INVENTORY_STACK, state.inventory[itemId]);
      return true;
    }
    
    return false;
  }

  return { spawnCollectable, maintainCollectables, tryCollect };
}

