# Phase 4: Raft Customization System

## Goal
Implement the "Garage" or "Dock" interface where players can spend collected materials to customize their raft's appearance and functionality (lights).

## Steps

1. Create Customization Logic
- Create `modules/game/crafting.js`.
- Define recipes/costs for unlocking colors or shapes.
- Logic to deduct materials from `state.inventory`.
- Logic to update `state.raft` properties.

2. Customization UI
- Create `modules/ui/customization.js`.
- Create a "Dock" modal.
- Layout:
  - Preview Area: Renders the player raft (using the actual `drawPlayer` function but isolated).
  - Controls Area: Tabs for "Hull", "Cabin", "Light".
  - Hull Tab:
    - Shape Selector (Previous/Next arrows).
    - Color Picker (Palette of unlocked colors).
  - Cabin Tab:
    - Shape Selector.
    - Color Picker.
  - Light Tab:
    - Shape Selector (Cone, Beam, Omni).
    - Tint Selector.

3. Purchasing/Unlocking Flow
- If a specific shape or color requires resources to change:
  - UI shows cost (e.g., "Cost: 50 Scrap, 10 Bio").
  - "Apply" button is disabled if insufficient funds.
  - On click: Deduct resources, update state, save game.

4. Integration
- Add a "Customize" button to the main HUD (or only enable it when "docked" at a City entity, if gameplay requires it; otherwise allow anytime for casual play).

