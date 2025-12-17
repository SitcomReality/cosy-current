import { RAFT_PARTS } from '../data/raftParts.js';

export function createCraftingModule(state) {
  
  function getPartInfo(category, id) {
    const parts = RAFT_PARTS[category];
    if (!parts) return null;
    return parts.find(p => p.id === id);
  }

  function canAfford(cost) {
    if (!cost) return true;
    for (const [res, amount] of Object.entries(cost)) {
      if (res === 'scrap' || res === 'bio' || res === 'fuel') {
        if ((state.resources[res] || 0) < amount) return false;
      } else {
        // Inventory items
        if ((state.inventory[res] || 0) < amount) return false;
      }
    }
    return true;
  }

  function purchase(cost) {
    if (!canAfford(cost)) return false;
    
    for (const [res, amount] of Object.entries(cost)) {
      if (res === 'scrap' || res === 'bio' || res === 'fuel') {
        state.resources[res] -= amount;
      } else {
        state.inventory[res] -= amount;
      }
    }
    return true;
  }

  function unlockAndEquip(category, partId) {
    // Categories in state.raft map directly to categories in RAFT_PARTS
    // e.g., state.raft.hullColor -> RAFT_PARTS.hullColors
    // We map category name "hullColor" (state key) to "hullColors" (registry key)
    const registryKey = category + 's'; // simple pluralization usually works for this schema
    
    // Check if already unlocked (using state.collection for non-consumables if we tracked unlocks separately)
    // For this simplified version, we'll assume parts must be bought unless they are default.
    // However, to avoid re-buying, we should ideally track unlocks.
    // Let's use state.collection['raft_part_' + partId] = true.

    const unlockKey = `raft_part_${partId}`;
    const part = getPartInfo(registryKey, partId);
    
    if (!part) return { success: false, message: 'Invalid part' };

    // If already current
    if (state.raft[category] === partId) return { success: true };

    // Check unlock status
    const isUnlocked = state.collection[unlockKey] || isDefault(registryKey, partId);

    if (!isUnlocked) {
      if (purchase(part.cost)) {
        state.collection[unlockKey] = true;
      } else {
        return { success: false, message: 'Insufficient resources' };
      }
    }

    // Equip
    state.raft[category] = partId;
    return { success: true, message: 'Equipped' };
  }

  function isDefault(registryKey, partId) {
    const parts = RAFT_PARTS[registryKey];
    if (!parts || parts.length === 0) return false;
    // Assume first item is default
    return parts[0].id === partId;
  }

  return { canAfford, unlockAndEquip, getPartInfo };
}

