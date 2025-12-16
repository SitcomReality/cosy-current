export const ITEM_REGISTRY = {
  // Crafting Materials
  'wood': {
    id: 'wood',
    name: 'Driftwood',
    type: 'material',
    description: 'Weathered wood suitable for simple repairs and expansions.',
    rarity: 1.0,
    spawnRules: { tileType: 'water', minDepth: 0.1 }
  },
  'scrap': { 
    id: 'scrap', 
    name: 'Rusted Scrap', 
    type: 'material', 
    description: 'Old metal parts salvaged from the river.', 
    rarity: 0.6, 
    spawnRules: { tileType: 'water', minDepth: 0.4 }
  },
  'cloth': {
    id: 'cloth', 
    name: 'Tattered Cloth', 
    type: 'material', 
    description: 'Sun-bleached fabric, useful for sails or decoration.', 
    rarity: 0.8, 
    spawnRules: { tileType: 'bank' }
  },
  'plastic': {
    id: 'plastic', 
    name: 'Hard Plastic', 
    type: 'material', 
    description: 'Durable synthetic material washed downstream.', 
    rarity: 0.5, 
    spawnRules: { tileType: 'bank' }
  },

  // Collectables (Trophies/Unlocks)
  'ancient_coin': {
    id: 'ancient_coin', 
    name: 'Ancient Coin', 
    type: 'collectable', 
    description: 'A heavy gold coin from a forgotten civilization.', 
    rarity: 0.08, 
    spawnRules: { tileType: 'bank' }
  },
  'river_gem': {
    id: 'river_gem', 
    name: 'River Gem', 
    type: 'collectable', 
    description: 'A shiny pebble smoothed by years of current.', 
    rarity: 0.05, 
    spawnRules: { tileType: 'water', minDepth: 0.8 }
  },
  'message_bottle': {
    id: 'message_bottle', 
    name: 'Message in a Bottle', 
    type: 'collectable', 
    description: 'The paper inside is too soaked to read.', 
    rarity: 0.1, 
    spawnRules: { tileType: 'water' }
  },
  'old_compass': {
    id: 'old_compass', 
    name: 'Broken Compass', 
    type: 'collectable', 
    description: 'It spins wildly, unable to find North.', 
    rarity: 0.06, 
    spawnRules: { tileType: 'forest' }
  }
};

