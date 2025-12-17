export const RAFT_PARTS = {
  hullColors: [
    { id: '#92400e', name: 'Driftwood', cost: {} }, // Default
    { id: '#78350f', name: 'Dark Oak', cost: { bio: 10 } },
    { id: '#f59e0b', name: 'Amber', cost: { scrap: 20 } },
    { id: '#ef4444', name: 'Crimson', cost: { scrap: 30, bio: 10 } },
    { id: '#3b82f6', name: 'Ocean', cost: { scrap: 30, plastic: 5 } },
    { id: '#10b981', name: 'Moss', cost: { bio: 40 } },
    { id: '#6366f1', name: 'Royal', cost: { scrap: 50, ancient_coin: 1 } },
    { id: '#1f2937', name: 'Charcoal', cost: { wood: 50, scrap: 20 } }
  ],
  cabinColors: [
    { id: '#fef3c7', name: 'Bleached', cost: {} }, // Default
    { id: '#d1d5db', name: 'Steel', cost: { scrap: 25 } },
    { id: '#fcd34d', name: 'Gold', cost: { scrap: 40, ancient_coin: 1 } },
    { id: '#fca5a5', name: 'Rose', cost: { bio: 20 } },
    { id: '#a5b4fc', name: 'Mist', cost: { plastic: 10 } }
  ],
  roofColors: [
    { id: '#78350f', name: 'Thatch', cost: {} }, // Default
    { id: '#dc2626', name: 'Red Paint', cost: { bio: 15 } },
    { id: '#2563eb', name: 'Blue Tarp', cost: { plastic: 15 } },
    { id: '#059669', name: 'Green Canvas', cost: { cloth: 10 } },
    { id: '#4b5563', name: 'Iron', cost: { scrap: 30 } }
  ],
  hullShapes: [
    { id: 'classic', name: 'Classic', description: 'Reliable and balanced.', cost: {} },
    { id: 'catamaran', name: 'Catamaran', description: 'Double-hulled stability.', cost: { wood: 100, scrap: 50 } },
    { id: 'barge', name: 'Barge', description: 'Wide deck for heavy loads.', cost: { wood: 150, scrap: 80 } }
  ],
  cabinShapes: [
    { id: 'box', name: 'Box', description: 'Simple shelter.', cost: {} },
    { id: 'a-frame', name: 'A-Frame', description: 'Classic peaked roof.', cost: { wood: 40, cloth: 10 } },
    { id: 'dome', name: 'Dome', description: 'Aerodynamic geometry.', cost: { scrap: 60, plastic: 20 } }
  ],
  lightTypes: [
    { id: 'cone', name: 'Flashlight', description: 'Focused forward beam.', cost: {} },
    { id: 'beam', name: 'Spotlight', description: 'Long-range narrow beam.', cost: { scrap: 40, river_gem: 1 } },
    { id: 'radial', name: 'Lantern', description: 'Omni-directional glow.', cost: { scrap: 30, bio: 20 } }
  ],
  lightColors: [
    { id: '#f59e0b', name: 'Warm', cost: {} },
    { id: '#ffffff', name: 'Halogen', cost: { scrap: 20 } },
    { id: '#ef4444', name: 'Warning', cost: { scrap: 10, bio: 10 } },
    { id: '#3b82f6', name: 'Xenon', cost: { scrap: 30, river_gem: 1 } }
  ]
};

