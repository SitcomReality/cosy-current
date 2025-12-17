import { ITEM_REGISTRY } from '../data/items.js';
import { MAX_INVENTORY_STACK } from './constants.js';

export function createCollectablesModule(state) {
  let spawnTimer = 0;
  const SPAWN_INTERVAL = 0.5; // seconds between spawn attempts

  function isValidSpawnLocation(game, noise, x, y, item) {
    const tile = game.getTile(Math.floor(x), Math.floor(y));
    const riverInfo = noise.getRiverSystem(x, y);
    const spawnRules = item.spawnRules || {};

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

    if (spawnRules.minDepth !== undefined) {
      if (tile === game.CONSTANTS.TILE_WATER) {
        const depth = 1.0 - riverInfo.value; // invert so deep = high
        if (depth < spawnRules.minDepth) return false;
      }
    }

    return true;
  }

  function pickRandomItem() {
    let totalWeight = 0;
    const candidates = [];

    for (const key in ITEM_REGISTRY) {
      const item = ITEM_REGISTRY[key];
      const weight = Math.pow(item.rarity, 2.5);
      totalWeight += weight;
      candidates.push({ key, weight });
    }

    if (totalWeight <= 0) return null;

    let picked = Math.random() * totalWeight;
    for (const c of candidates) {
      picked -= c.weight;
      if (picked <= 0) return c.key;
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
      lifetime: 120,
      maxLifetime: 120
    });
  }

  function getCollectableSpawnPosition(player, state, isRareSpawn = false) {
    const tileSize = state.tileSize || 64;
    const halfW = (state.width / 2) / tileSize;
    const halfH = (state.height / 2) / tileSize;

    if (isRareSpawn) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 100;
      return {
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist
      };
    } else {
      const maxArcWidth = Math.PI * 0.8;
      const arcOffset = (Math.random() - 0.5) * maxArcWidth;
      const spawnAngle = player.angle + arcOffset;
      const viewportEdgeDist = Math.max(halfW, halfH);
      const minDist = viewportEdgeDist + 6;
      const maxDist = minDist + 25;
      const dist = minDist + Math.random() * (maxDist - minDist);
      return {
        x: player.x + Math.cos(spawnAngle) * dist,
        y: player.y + Math.sin(spawnAngle) * dist
      };
    }
  }

  function maintainCollectables(dt, player, game, noise) {
    state.collectables = state.collectables || [];

    // Spawning logic
    spawnTimer += dt;
    while (spawnTimer >= SPAWN_INTERVAL && state.collectables.length < 80) {
      spawnTimer -= SPAWN_INTERVAL;

      const isRareSpawn = Math.random() < 0.08;
      const pos = getCollectableSpawnPosition(player, state, isRareSpawn);
      const itemId = pickRandomItem();
      if (!itemId) continue;
      const item = ITEM_REGISTRY[itemId];
      if (isValidSpawnLocation(game, noise, pos.x, pos.y, item)) {
        spawnCollectable(pos.x, pos.y, itemId);
      }
    }

    // Update lifetimes and despawn
    for (let i = state.collectables.length - 1; i >= 0; i--) {
      const c = state.collectables[i];
      c.lifetime -= dt;
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

    const isNewDiscovery = !state.collection[itemId];
    if (isNewDiscovery) {
      state.collection[itemId] = true;
      if (state.notifications && typeof state.notifications.discovery === 'function') {
        state.notifications.discovery(item.name);
      }
    }

    state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
    const wasAtMax = state.inventory[itemId] > MAX_INVENTORY_STACK;
    state.inventory[itemId] = Math.min(MAX_INVENTORY_STACK, state.inventory[itemId]);

    if (wasAtMax && state.notifications && typeof state.notifications.warning === 'function') {
      state.notifications.warning(`Inventory full! ${item.name} dropped.`);
    }

    return true;
  }

  return { spawnCollectable, maintainCollectables, tryCollect };
}

