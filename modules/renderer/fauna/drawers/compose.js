export function drawCreature(ctx, c, screenX, screenY, size, cycle) {
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(c.angle);

  if (c.type === 'fish') {
    // delegated to per-creature drawer; keep minimal here for compatibility fallback
    if (typeof drawFish === 'function') drawFish(ctx, c, size);
  } else if (c.type === 'eel') {
    if (typeof drawEel === 'function') drawEel(ctx, c, size);
  } else if (c.type === 'bird') {
    // Apply the extra 90° rotation only to birds so other creatures stay aligned
    ctx.rotate(Math.PI / 2);
    if (typeof drawBird === 'function') drawBird(ctx, c, size, cycle);
  } else if (c.type === 'deer') {
    if (typeof drawDeer === 'function') drawDeer(ctx, c, size);
  } else if (c.type === 'critter') {
    if (typeof drawCritter === 'function') drawCritter(ctx, c, size);
  } else if (c.type === 'firefly') {
    if (typeof drawFirefly === 'function') drawFirefly(ctx, c, size);
  } else if (c.type === 'crab') {
    if (typeof drawCrab === 'function') drawCrab(ctx, c, size);
  } else if (c.type === 'sheep') {
    if (typeof drawSheep === 'function') drawSheep(ctx, c, size);
  } else if (c.type === 'turtle') {
    if (typeof drawTurtle === 'function') drawTurtle(ctx, c, size);
  }

  ctx.restore();
}

// The compose file expects the specific drawer functions to be attached to the module scope at runtime.
// When using this file, importers should ensure the per-creature draw functions are available in scope.
// To keep this file self-contained we export the name only; actual wiring is done by the wrapper module.