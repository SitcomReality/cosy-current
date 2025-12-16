# Phase 5: Rendering Integration

## Goal
Update the rendering pipeline to respect the dynamic raft configuration stored in the state, drawing the correct shapes, colors, and lighting effects.

## Steps

1. Refactor Player Drawer
- Modify `modules/renderer/objects/player.js`.
- Update `drawPlayer` to accept `state.raft` configuration.
- Break down drawing into sub-functions:
  - `drawHull(ctx, shape, color, size)`
  - `drawCabin(ctx, shape, color, size)`
  - `drawAccessories(ctx, raftState)`

2. Implement Shapes
- Hull Shapes:
  - 'Classic': Existing rectangle.
  - 'Catamaran': Two parallel pontoons.
  - 'Barge': Wider, rounded corners.
- Cabin Shapes:
  - 'Box': Existing rectangle.
  - 'A-Frame': Triangular roof ridge.
  - 'Dome': Rounded top (arc).

3. Update Lighting System
- Modify `modules/renderer/objects/player.js` (light source rendering).
- Modify `modules/renderer/passes/atmosphere.js` (light cone/glow rendering).
- Implement Light Types:
  - 'Cone': Existing focused flashlight style.
  - 'Beam': Narrower angle, longer reach.
  - 'Radial': 360-degree glow, shorter radius.
- Apply `state.raft.lightColor` to the gradient/shadow casting logic.

4. Update Shadow Casting
- Ensure `modules/renderer/fauna/shadows.js` and `objects.js` respect the new light shapes when calculating dynamic shadows for trees/creatures (e.g., radial lights cast shadows away from center in all directions).

