# Phase 2: Spawning Logic & Interaction

## Goal
Implement the logic for spawning collectable items in the world, handling automatic collection via proximity, and enabling manual collection via mouse interaction.

## Steps

1. Create Collectable Spawner System
- Create `modules/game/collectables.js`.
- Implement a `spawnCollectable` function similar to the fauna spawner.
- Use `ITEM_REGISTRY` to determine which items can spawn based on current location (tile type, river value) and time.
- Implement Rare Spawning Logic:
  - Standard items spawn near the player (camera edges).
  - Super rare items have a low probability to spawn further out or on specific "unreachable" terrain (like deep forest or inland grass).

2. Integrate with Game Loop
- In `modules/game.js` or a new `modules/game/systems.js`, add the update loop for collectables.
- Manage the lifecycle (spawn, lifetime, despawn if too far).

3. Implement Auto-Collection
- In the update loop, check distance between `state.player` and each active collectable.
- If distance < `AUTO_COLLECT_RADIUS` (e.g., 2 tiles):
  - Trigger "collect" event.
  - Add item to `state.inventory` (clamped to max).
  - Set `state.collection[id] = true`.
  - Trigger visual effect (floating text or particle).
  - Remove entity from world.

4. Implement Manual Interaction
- In `modules/app.js` or `modules/input.js`, add a `mousedown` or `click` listener.
- Convert screen coordinates to world coordinates.
- Check distance from click to all active collectable entities.
- If click hits a valid entity (even if outside auto-collect range):
  - Trigger "collect" event (same logic as auto-collect).
  - This rewards active play by allowing collection of items stuck on banks or rare items that spawned far away.

5. Visual Representation
- Update `modules/renderer/objects/entities.js`.
- Create `drawCollectable` function.
- Render items based on type (simple geometric shapes or distinct colors defined in registry).
- Add a "glimmer" or "pulse" effect to rare items to make them noticeable in the forest/grass.

