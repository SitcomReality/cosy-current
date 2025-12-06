// Central fauna drawer: re-exports per-creature drawers and composes drawCreature

import { drawFish } from './drawers/fish.js';
import { drawEel } from './drawers/eel.js';
import { drawBird } from './drawers/bird.js';
import { drawCrab } from './drawers/crab.js';
import { drawDeer } from './drawers/deer.js';
import { drawCritter } from './drawers/critter.js';
import { drawFirefly } from './drawers/firefly.js';
import { drawSheep } from './drawers/sheep.js';
import { drawTurtle } from './drawers/turtle.js';

// Fauna drawing helpers (non-shadow geometry)
export function drawCreature(ctx, c, screenX, screenY, size, cycle) {
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(c.angle);

  if (c.type === 'fish') {
    drawFish(ctx, c, size);
  } else if (c.type === 'eel') {
    drawEel(ctx, c, size);
  } else if (c.type === 'bird') {
    // Apply the extra 90° rotation only to birds so other creatures stay aligned
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