import { ITEM_REGISTRY } from '../data/items.js';
import { MAX_INVENTORY_STACK } from './constants.js';

export function createCollectablesModule(state) {
  let spawnTimer = 0;
  const SPAWN_INTERVAL = 0.5; // seconds between spawn attempts

  function isValidSpawnLocation(game, noise, x, y, item) {
    const tile = game.getTile(Math.floor(x), Math.floor(y));
    const riverInfo = noise.getRiverSystem(x, y);
    const spawnRules = item.spawnRules || {};

    // Check tile type requirement
    if (spawnRules.tileType) {
      const tileMapping = {
        'water': game.CONSTANTS.TILE_WATER,
        'bank': game.CONSTANTS.TILE_BANK,
        'grass': game.CONSTANTS.TILE_GRASS,
        'forest': game.CONSTANTS.TILE_FOREST
      };
      const requiredTile = tileMapping[spawnRules.tileType];
      if (tile !== requiredTile) return false;
    }

    // Check depth requirement (0=deep center, 1=bank)
    if (spawnRules.minDepth !== undefined) {
      // For water items, check river depth
      if (tile === game.CONSTANTS.TILE_WATER) {
        const depth = 1.0 - riverInfo.value; // invert so deep = high
        if (depth < spawnRules.minDepth) return false;
      }
    }

    return true;
  }

  function pickRandomItem(rarity = 0.5) {
    let totalWeight = 0;
    const candidates = [];
    
    for (const key in ITEM_REGISTRY) {
      const item = ITEM_REGISTRY[key];
      // Weight by rarity: higher rarity = lower spawn chance
      // Use a curve so common items (rarity ~1.0) spawn frequently, rare items (~0.05) spawn rarely
      const weight = Math.pow(item.rarity, 2.5);
      totalWeight += weight;
      candidates.push({ key, rarity: weight });
    }

    if (totalWeight <= 0) return null;

    let picked = Math.random() * totalWeight;
    for (const { key, rarity } of candidates) {
      picked -= rarity;
      if (picked <= 0) return key;
    }
    return candidates[candidates.length - 1].key;
  }

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

  function getCollectableSpawnPosition(player, state, isRareSpawn = false) {
    const tileSize = state.tileSize || 64;
    const halfW = (state.width / 2) / tileSize;
    const halfH = (state.height / 2) / tileSize;
    
    if (isRareSpawn) {
      // Rare items spawn far away on unreachable terrain (forest/grass inland)
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 100;
      return {
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist
      };
    } else {
      // Standard items spawn ahead of player in upcoming chunks
      // Create a forward-facing arc to bias spawning ahead (not behind)
      const maxArcWidth = Math.PI * 0.8; // ~145 degrees spread centered on facing direction
      const arcOffset = (Math.random() - 0.5) * maxArcWidth;
      const spawnAngle = player.angle + arcOffset;
      
      // Spawn in upcoming area beyond current viewport
      const viewportEdgeDist = Math.max(halfW, halfH);
      const minDist = viewportEdgeDist + 6; // Just past current viewport
      const maxDist = minDist + 25; // Spread into upcoming chunks
      const dist = minDist + Math.random() * (maxDist - minDist);
      
      return {
        x: player.x + Math.cos(spawnAngle) * dist,
        y: player.y + Math.sin(spawnAngle) * dist
      };
    }
  }

  function maintainCollectables(dt, player, game, noise) {
    state.collectables = state.collectables || [];
    
    // Spawn new collectables at controlled interval
    spawnTimer += dt;
    while (spawnTimer >= SPAWN_INTERVAL && state.collectables.length < 80) {
      spawnTimer -= SPAWN_INTERVAL;
      
      // Decide if this spawn is a standard nearby one or a rare far one
      const isRareSpawn = Math.random() < 0.08; // 8% chance of rare far spawn
      
      const pos = getCollectableSpawnPosition(player, state, isRareSpawn);
      let x = pos.x;
      let y = pos.y;
      
      const itemId = pickRandomItem();
      if (!itemId) continue;
      
      const item = ITEM_REGISTRY[itemId];
      
      // Validate spawn location matches item rules
      if (isValidSpawnLocation(game, noise, x, y, item)) {
        spawnCollectable(x, y, itemId);
      }
    }

  return { spawnCollectable, maintainCollectables, tryCollect };
}

    // Update and despawn
    for (let i = state.collectables.length - 1; i >= 0; i--) {
      const c = state.collectables[i];
      c.lifetime -= dt;
      
      const dist = Math.hypot(c.x - player.x, c.y - player.y);
      // Despawn if too far or lifetime expired
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

    // Unlock in collection if first time (enables discovery notifications)
    const isNewDiscovery = !state.collection[itemId];
    if (isNewDiscovery) {
      state.collection[itemId] = true;
      // Trigger discovery notification if system is available
      if (state.notifications && typeof state.notifications.discovery === 'function') {
        state.notifications.discovery(item.name);
      }
    }

    // Add to inventory (clamp to max stack)
    state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
    const wasAtMax = state.inventory[itemId] > MAX_INVENTORY_STACK;
    state.inventory[itemId] = Math.min(MAX_INVENTORY_STACK, state.inventory[itemId]);
    
    // Warn if inventory is full
    if (wasAtMax && state.notifications && typeof state.notifications.warning === 'function') {
      state.notifications.warning(`Inventory full! ${item.name} dropped.`);
    }
    
    return true;
  }

  return { spawnCollectable, maintainCollectables, tryCollect };
}

