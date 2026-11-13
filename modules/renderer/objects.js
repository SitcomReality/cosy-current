// Thin barrel module re-exporting object drawing helpers for trees, aquatic plants,
// entities, and the player raft. This keeps the original import path stable while
// allowing each concern to live in its own module.

export { drawTreeShadow, drawTree, getTreeLean } from './objects/tree.js';
export { drawAquaticShadow, drawAquaticPlant } from './objects/aquatic.js';
export { drawJaggedInfluence, drawEntities } from './objects/entities.js';
export { drawPlayer } from './objects/player.js';
export { drawCollectable } from './objects/collectables.js';