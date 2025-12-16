# Phase 3: UI Systems (Inventory & Gallery)

## Goal
Create the user interfaces for viewing collected resources, managing inventory, and viewing the "Sticker Book" collection tracker.

## Steps

1. Create UI Modules
- Create `modules/ui/inventory.js` and `modules/ui/collection.js`.
- Add necessary HTML structure to `index.html` inside a new `#menu-layer` or within existing modal structures.

2. Inventory HUD/Panel
- Design a compact view (possibly integrated into the existing HUD or a toggleable modal).
- Display grid of slots for material items.
- Show Icon/Color, Item Name, and Quantity (e.g., "14/100").
- If using a modal, pause game execution (logic) while open, or keep it as an overlay.

3. Collection Gallery ("Sticker Book")
- Create a full-screen or large modal interface.
- Grid layout showing all possible items from `ITEM_REGISTRY`.
- Logic:
  - If `state.collection[id]` is true: Show full color icon, name, and description.
  - If false: Show silhouette/question mark and "Unknown".
- Categorize tabs (e.g., "Flotsam", "Flora", "Ancient Relics").

4. Notification System
- Create a simple toaster/notification overlay in `index.html`.
- When a *new* item is collected (first time unlock), slide in a notification: "New Discovery: [Item Name]!".
- When a material stack is full, show a subtle indicator or prevent pickup visuals.

5. Integration
- Add buttons to the main HUD (`modules/ui.js`) to open Inventory and Collection screens.
- Ensure styling matches `styles/components.css` (dark themes, rigid fonts).

