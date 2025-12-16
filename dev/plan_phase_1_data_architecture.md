# Phase 1: Data Architecture & State Management

## Goal
Establish the data structures required to support the item registry, player inventory, collection tracking, and raft customization state within the existing application architecture.

## Steps

1. Create Item Registry Module
- Create `modules/data/items.js`.
- Define a constant `ITEM_REGISTRY` object.
- Each item entry should contain:
  - id: Unique string key.
  - name: Display name.
  - type: 'material' (consumable) or 'collectable' (trophy).
  - rarity: weight for spawning logic.
  - description: Flavor text for the collection gallery.
  - spawnRules: Object defining conditions (e.g., `tileType`, `minDepth`, `dayTime`).

2. Update Application State Schema
- Modify `modules/state.js` to initialize new state containers.
- Inventory:
  - `state.inventory`: Object mapping `itemId` to integer quantity.
  - Initialize with empty object or default starting materials.
- Collection:
  - `state.collection`: Object mapping `itemId` to boolean (true if unlocked).
- Raft Configuration:
  - `state.raft`: Object containing visual properties.
  - `hullColor`: Hex string.
  - `cabinColor`: Hex string.
  - `roofColor`: Hex string.
  - `hullShape`: String identifier (e.g., 'classic', 'catamaran', 'barge').
  - `cabinShape`: String identifier (e.g., 'box', 'a-frame').
  - `lightType`: String identifier (e.g., 'cone', 'beam', 'radial').
  - `lightColor`: Hex string (with alpha support).

3. Update Persistence Layer
- Modify `modules/persistence.js`.
- Ensure `saveGame` serializes the new `inventory`, `collection`, and `raft` objects.
- Ensure `loadGame` correctly merges these objects into the runtime state, providing defaults for existing save files that lack this data.

4. Define Constraints
- Create `modules/game/config.js` or add to `constants.js`.
- Define `MAX_INVENTORY_STACK` (100).
- Define default/fallback colors and shapes for the raft.

