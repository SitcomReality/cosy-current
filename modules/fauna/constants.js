export const POOL_WATER = 'water';
export const POOL_LAND = 'land';
export const POOL_AIR = 'air';

export const CREATURE_DEFS = {
  fish: {
    type: 'fish',
    pool: POOL_WATER,
    size: 0.4, speed: 2.2, depth: 0.3,
    colors: ['#f59e0b', '#ef4444', '#06b6d4'],
    behavior: 'flow_follow',
    turnRate: 2.0
  },
  eel: {
    type: 'eel',
    pool: POOL_WATER,
    size: 0.6, speed: 1.8, depth: 0.5,
    colors: ['#475569', '#64748b'],
    behavior: 'flow_follow',
    turnRate: 1.5
  },
  crab: {
    type: 'crab',
    pool: POOL_LAND,
    habitat: ['bank'], // Sand/Bank
    size: 0.35, speed: 0.6,
    colors: ['#ef4444', '#f97316', '#db2777', '#8b5cf6'],
    behavior: 'scuttle',
    segments: true,
    turnRate: 5.0
  },
  critter: {
    type: 'critter',
    pool: POOL_LAND,
    habitat: ['grass', 'bank'],
    size: 0.25, speed: 1.2,
    colors: ['#78350f', '#92400e'],
    behavior: 'wander',
    turnRate: 4.0
  },
  deer: {
    type: 'deer',
    pool: POOL_LAND,
    habitat: ['forest'],
    size: 0.7, speed: 1.8,
    colors: ['#92400e', '#78350f'],
    behavior: 'wander',
    turnRate: 2.5
  },
  firefly: {
    type: 'firefly',
    pool: POOL_LAND,
    habitat: ['forest', 'grass'],
    size: 0.2, speed: 0.8,
    colors: ['#fef08a'],
    behavior: 'wander_hover',
    nightOnly: true, glow: true,
    turnRate: 3.0
  },
  bird: {
    type: 'bird',
    pool: POOL_AIR,
    size: 0.3, speed: 4.0,
    colors: ['#dc2626', '#2563eb', '#fbbf24', '#ffffff'],
    behavior: 'fly_straight',
    turnRate: 0.8
  },
  // New chunky sheep on grass
  sheep: {
    type: 'sheep',
    pool: POOL_LAND,
    habitat: ['grass'],
    size: 0.6, // slightly smaller than deer (0.7)
    speed: 0.5, // reduced from 1.0 to make movement placid
    // Soft off-whites and greys to match palette
    colors: ['#e5e7eb', '#f5f5f4', '#d4d4d8', '#e7e5e4'],
    behavior: 'wander',
    turnRate: 1.2 // lowered from 3.0 for much gentler turning
  },
  // New slow turtles in the river
  turtle: {
    type: 'turtle',
    pool: POOL_WATER,
    size: 0.45,
    speed: 0.7,
    depth: 0.45,
    // Greens/browns consistent with existing palette
    colors: ['#166534', '#15803d', '#4b5563', '#78350f'],
    behavior: 'turtle',
    turnRate: 1.0
  }
};