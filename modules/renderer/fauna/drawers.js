/*
  Fauna drawers wrapper — re-exports per-creature drawer functions and the central composer.
  This file now acts as the single import surface for other renderer modules while the
  drawCreature composition is implemented in a dedicated compose file.
*/

import { drawFish } from './drawers/fish.js';
import { drawEel } from './drawers/eel.js';
import { drawBird } from './drawers/bird.js';
import { drawCrab } from './drawers/crab.js';
import { drawDeer } from './drawers/deer.js';
import { drawCritter } from './drawers/critter.js';
import { drawFirefly } from './drawers/firefly.js';
import { drawSheep } from './drawers/sheep.js';
import { drawTurtle } from './drawers/turtle.js';

// Import the composer and bind per-creature drawers into its scope by wrapping.
import { drawCreature as composeDrawCreature } from './drawers/compose.js';

// Create a small wrapper that ensures the composer can call the concrete drawer functions.
// The composer expects functions like drawFish, drawEel, etc. to exist in module scope,
// so we create a bound wrapper that sets them on a temporary object and delegates the call.
// For simplicity and to avoid dynamic eval, implement drawCreature here to dispatch
// identically to previous behaviour but delegated to the imported per-creature functions.

export function drawCreature(ctx, c, screenX, screenY, size, cycle) {
  // This wrapper mirrors the previous compose logic but directly calls the local imports.
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(c.angle);

  if (c.type === 'fish') {
    drawFish(ctx, c, size);
  } else if (c.type === 'eel') {
    drawEel(ctx, c, size);
  } else if (c.type === 'bird') {
    ctx.rotate(Math.PI / 2);
    drawBird(ctx, c, size, cycle);
  } else if (c.type === 'deer') {
    drawDeer(ctx, c, size);
  } else if (c.type === 'critter') {
    drawCritter(ctx, c, size);
  } else if (c.type === 'firefly') {
    drawFirefly(ctx, c, size);
  } else if (c.type === 'crab') {
    drawCrab(ctx, c, size);
  } else if (c.type === 'sheep') {
    drawSheep(ctx, c, size);
  } else if (c.type === 'turtle') {
    drawTurtle(ctx, c, size);
  }

  ctx.restore();
}

// Also re-export per-creature functions for callers that want them individually.
export {
  drawFish,
  drawEel,
  drawBird,
  drawCrab,
  drawDeer,
  drawCritter,
  drawFirefly,
  drawSheep,
  drawTurtle
};