export const ENTITY_CITY = 'city';
export const ENTITY_RELIC = 'relic';

export const TILE_WATER = 0;
export const TILE_BANK = 2;
export const TILE_GRASS = 3;
export const TILE_FOREST = 4;

// Removed higher inland terrain constants (hill, mountain) — not used in river-only gameplay.

export const INTERACTION_RADIUS = 20;

// Inventory & Customization Constants
export const MAX_INVENTORY_STACK = 100;

export const DEFAULT_RAFT = {
  hullColor: '#92400e',   // Default wood
  cabinColor: '#fef3c7',  // Default light wood
  roofColor: '#78350f',   // Default dark wood
  hullShape: 'classic',   // classic, catamaran, barge
  cabinShape: 'box',      // box, a-frame, dome
  lightType: 'cone',      // cone, beam, radial
  lightColor: '#f59e0b'   // orange-ish light
};

