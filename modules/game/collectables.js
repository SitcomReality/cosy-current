import { ITEM_REGISTRY } from '../data/items.js';
import { MAX_INVENTORY_STACK } from './constants.js';

// Ease helper
function easeInQuad(t) {
  return t * t;
}

// The four relics that form the ending track
export const RELIC_IDS = ['ancient_coin', 'river_gem', 'message_bottle', 'old_compass'];

// Discovery meter configuration
const DISCOVERY_METER_MAX = 100; // fills per pickup
const DISCOVERY_METER_PER_PICKUP = 12; // each pickup adds this much

export function createCollectablesModule(state) {
  let spawnTimer = 0;
  const SPAWN_INTERVAL = 0.5; // seconds between spawn attempts

  // Discovery meter state (persisted in state.discoveryMeter)
  state.discoveryMeter = state.discoveryMeter || {
    progress: 0,
    max: DISCOVERY_METER_MAX,
    pendingRelic: null // the relic ID guaranteed to spawn next
  };

  // Track if we're in the "guaranteed relic" spawn flow
  let guaranteedRelicPending = false;

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

  // Get list of undiscovered relics
  function getUndiscoveredRelics() {
    return RELIC_IDS.filter(id => !state.collection[id]);
  }

  // Get spawn position on the raft's projected course (ahead, within reach)
  function getProjectedCoursePosition(player, state, distanceAhead = 12) {
    const angle = player.angle;
    return {
      x: player.x + Math.cos(angle) * distanceAhead,
      y: player.y + Math.sin(angle) * distanceAhead
    };
  }

  // Get context-sensitive spawn weight modifier for an item
  // Returns a multiplier based on tile type, time of day, weather
  function getContextSpawnWeight(item, game, noise, x, y, dayTime, weather) {
    let weight = 1.0;
    const tile = game.getTile(Math.floor(x), Math.floor(y));
    const isNight = dayTime > 0.75 || dayTime < 0.25; // 18:00-06:00
    const isDawn = dayTime >= 0.25 && dayTime < 0.35; // 06:00-08:30
    const isDusk = dayTime >= 0.65 && dayTime < 0.75; // 15:30-18:00
    const isRaining = weather.precipIntensity > 0.3;

    // Relic-specific context bonuses
    switch (item.id) {
      case 'message_bottle':
        // Bottles in rain, on water
        if (isRaining) weight *= 3.0;
        if (tile === game.CONSTANTS.TILE_WATER) weight *= 1.5;
        break;
      case 'old_compass':
        // Compasses in forest at dawn
        if (isDawn && tile === game.CONSTANTS.TILE_FOREST) weight *= 4.0;
        if (tile === game.CONSTANTS.TILE_FOREST) weight *= 2.0;
        break;
      case 'river_gem':
        // Gems in deep water at night
        if (isNight && tile === game.CONSTANTS.TILE_WATER) {
          const riverInfo = noise.getRiverSystem(x, y);
          const depth = 1.0 - riverInfo.value;
          if (depth > 0.7) weight *= 5.0;
        }
        if (tile === game.CONSTANTS.TILE_WATER) weight *= 1.5;
        break;
      case 'ancient_coin':
        // Coins on banks after dusk
        if (isDusk && tile === game.CONSTANTS.TILE_BANK) weight *= 3.0;
        if (tile === game.CONSTANTS.TILE_BANK) weight *= 2.0;
        break;
    }

    // General material context
    if (item.type === 'material') {
      // Materials slightly more common in their preferred tiles (already enforced by spawnRules)
      // Small bonus at night for all materials (fireflies/glimmers visibility)
      if (isNight) weight *= 1.2;
    }

    return weight;
  }

  function pickRandomItem(game, noise, player, state) {
    let totalWeight = 0;
    const candidates = [];

    const dayTime = state.dayTime || 0.25;
    const weather = state.weather || { precipIntensity: 0, wind: 0 };

    for (const key in ITEM_REGISTRY) {
      const item = ITEM_REGISTRY[key];
      const baseWeight = Math.pow(item.rarity, 2.5);
      // For relics, drastically reduce base weight - they're primarily from discovery meter
      const isRelic = item.type === 'collectable';
      const contextWeight = isRelic ? baseWeight * 0.01 : baseWeight; // relics 100x rarer in random pool
      const finalWeight = contextWeight * getContextSpawnWeight(item, game, noise, player.x, player.y, dayTime, weather);
      totalWeight += finalWeight;
      candidates.push({ key, weight: finalWeight });
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
      maxLifetime: 120,
      // Collect animation fields (unused until startCollect is called)
      collecting: false,
      collectProgress: 0,
      collectStartX: x,
      collectStartY: y
    });
  }

  // Start a magnet-style collect animation for the collectable at index collectableIndex
  function startCollect(collectableIndex, player) {
    state.collectables = state.collectables || [];
    const c = state.collectables[collectableIndex];
    if (!c) return;
    // If already collecting, ignore
    if (c.collecting) return;
    c.collecting = true;
    c.collectProgress = 0;
    c.collectStartX = c.x;
    c.collectStartY = c.y;
    // We don't set a fixed target position because player may move; we'll lerp toward current player pos each frame.
    // Store a duration for the animation (seconds)
    c.collectDuration = 0.6; // fairly quick but with ease-in
    // Optionally reduce lifetime so it won't be removed by lifetime during animation
    c.lifetime = Math.max(1, c.lifetime);
  }

  function getCollectableSpawnPosition(player, state, isRareSpawn = false) {
    const tileSize = state.tileSize || 64;
    const halfW = (state.width / 2) / tileSize;
    const halfH = (state.height / 2) / tileSize;

    if (isRareSpawn) {
      // Rare spawns still go wider but not too far
      const angle = (Math.random() - 0.5) * Math.PI * 0.5; // ±45 degrees from forward
      const dist = 15 + Math.random() * 20; // 15-35 tiles ahead
      return {
        x: player.x + Math.cos(player.angle + angle) * dist,
        y: player.y + Math.sin(player.angle + angle) * dist
      };
    } else {
      // Regular spawns: narrow fan along projected course
      const maxArcWidth = Math.PI * 0.4; // reduced from 0.8 (narrower fan)
      const arcOffset = (Math.random() - 0.5) * maxArcWidth;
      const spawnAngle = player.angle + arcOffset;
      const viewportEdgeDist = Math.max(halfW, halfH);
      const minDist = viewportEdgeDist + 3; // reduced from 6
      const maxDist = minDist + 12; // reduced from 25 - items spawn closer
      const dist = minDist + Math.random() * (maxDist - minDist);
      return {
        x: player.x + Math.cos(spawnAngle) * dist,
        y: player.y + Math.sin(spawnAngle) * dist
      };
    }
  }

  function maintainCollectables(dt, player, game, noise) {
    state.collectables = state.collectables || [];

    // Check if we need to spawn a guaranteed relic (discovery meter full)
    if (state.discoveryMeter.progress >= state.discoveryMeter.max && !guaranteedRelicPending) {
      const undiscovered = getUndiscoveredRelics();
      if (undiscovered.length > 0) {
        // Pick a random undiscovered relic to guarantee
        const relicId = undiscovered[Math.floor(Math.random() * undiscovered.length)];
        state.discoveryMeter.pendingRelic = relicId;
        state.discoveryMeter.progress = 0; // reset meter
        guaranteedRelicPending = true;
      } else {
        // All relics discovered - meter retires
        state.discoveryMeter.progress = state.discoveryMeter.max;
      }
    }

    // Spawn guaranteed relic on projected course if pending
    if (guaranteedRelicPending && state.discoveryMeter.pendingRelic) {
      const relicId = state.discoveryMeter.pendingRelic;
      const pos = getProjectedCoursePosition(player, state, 14); // 14 tiles ahead, well within reach
      // Verify the position is valid for this relic type
      const item = ITEM_REGISTRY[relicId];
      if (isValidSpawnLocation(game, noise, pos.x, pos.y, item)) {
        spawnCollectable(pos.x, pos.y, relicId);
        // Mark as guaranteed so we can add visual indicator
        const newCollectable = state.collectables[state.collectables.length - 1];
        if (newCollectable) {
          newCollectable.isGuaranteedRelic = true;
        }
      } else {
        // If projected course invalid (e.g., on land), find nearest valid water/bank tile
        // by scanning in a small radius around the projected position
        let foundValid = false;
        for (let radius = 1; radius <= 5 && !foundValid; radius++) {
          for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            const testX = pos.x + Math.cos(angle) * radius;
            const testY = pos.y + Math.sin(angle) * radius;
            if (isValidSpawnLocation(game, noise, testX, testY, item)) {
              spawnCollectable(testX, testY, relicId);
              const newCollectable = state.collectables[state.collectables.length - 1];
              if (newCollectable) {
                newCollectable.isGuaranteedRelic = true;
              }
              foundValid = true;
              break;
            }
          }
        }
      }
      guaranteedRelicPending = false;
      state.discoveryMeter.pendingRelic = null;
    }

    // Regular spawning logic
    spawnTimer += dt;
    while (spawnTimer >= SPAWN_INTERVAL && state.collectables.length < 80) {
      spawnTimer -= SPAWN_INTERVAL;

      // Reduced rare spawn chance since relics come from discovery meter
      const isRareSpawn = Math.random() < 0.04; // reduced from 0.08
      const pos = getCollectableSpawnPosition(player, state, isRareSpawn);
      const itemId = pickRandomItem(game, noise, player, state);
      if (!itemId) continue;
      const item = ITEM_REGISTRY[itemId];
      // Don't spawn relics via random pool - they come from discovery meter
      if (item.type === 'collectable') continue;
      if (isValidSpawnLocation(game, noise, pos.x, pos.y, item)) {
        spawnCollectable(pos.x, pos.y, itemId);
      }
    }

    // Update lifetimes, handle collecting animation, and despawn
    for (let i = state.collectables.length - 1; i >= 0; i--) {
      const c = state.collectables[i];

      // If this collectable is in "collecting" state, animate it toward the player's current position
      if (c.collecting) {
        // Advance progress (clamped)
        c.collectProgress = Math.min(1, c.collectProgress + dt / (c.collectDuration || 0.6));

        // Ease-in curve: start slow then speed up (easeInQuad)
        const eased = easeInQuad(c.collectProgress);

        // Lerp from start -> player's current position (so it follows moving raft)
        const targetX = player.x;
        const targetY = player.y;
        c.x = c.collectStartX + (targetX - c.collectStartX) * eased;
        c.y = c.collectStartY + (targetY - c.collectStartY) * eased;

        // When complete, finalize collection and remove the collectable
        if (c.collectProgress >= 1) {
          // Award item and trigger discovery/inventory logic
          const wasGuaranteed = c.isGuaranteedRelic;
          tryCollect(c.itemId);
          state.collectables.splice(i, 1);
          // Advance discovery meter for each pickup (unless it was a guaranteed relic - meter already reset)
          if (!wasGuaranteed) {
            advanceDiscoveryMeter();
          }
          continue;
        } else {
          // Make sure it is not expired by lifetime during animation
          c.lifetime = Math.max(1, c.lifetime);
        }
      } else {
        // Normal lifetime decrement for non-collecting items
        c.lifetime -= dt;
        const dist = Math.hypot(c.x - player.x, c.y - player.y);
        if (c.lifetime <= 0 || dist > 150) {
          state.collectables.splice(i, 1);
        }
      }
    }
  }

  // Advance discovery meter by one pickup
  function advanceDiscoveryMeter() {
    const undiscovered = getUndiscoveredRelics();
    if (undiscovered.length === 0) return; // all relics found, meter retired
    state.discoveryMeter.progress = Math.min(
      state.discoveryMeter.max,
      state.discoveryMeter.progress + DISCOVERY_METER_PER_PICKUP
    );
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

    // Mark onboarding as seen on first pickup
    if (!state.onboardingSeen) {
      state.onboardingSeen = true;
      if (state.notifications && typeof state.notifications.markOnboardingSeen === 'function') {
        state.notifications.markOnboardingSeen();
      }
    }

    // Add to inventory but silently clamp to max stack without emitting regular toasts.
    state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
    state.inventory[itemId] = Math.min(MAX_INVENTORY_STACK, state.inventory[itemId]);

    return true;
  }

  // Get relic discovery count for HUD (0-4)
  function getRelicCount() {
    return RELIC_IDS.filter(id => state.collection[id]).length;
  }

  // Get total relic count (always 4)
  function getTotalRelics() {
    return RELIC_IDS.length;
  }

  return { spawnCollectable, maintainCollectables, tryCollect, startCollect, getRelicCount, getTotalRelics };
}

