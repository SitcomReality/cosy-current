export const RAFT_PARTS = {
  hullColors: [
    { id: '#92400e', name: 'Driftwood', cost: {} }, // Default
    { id: '#78350f', name: 'Dark Oak', cost: { wood: 15 } },
    { id: '#f59e0b', name: 'Amber', cost: { wood: 20, plastic: 5 } },
    { id: '#ef4444', name: 'Crimson', cost: { cloth: 20, wood: 10 } },
    { id: '#3b82f6', name: 'Ocean', cost: { plastic: 25 } },
    { id: '#10b981', name: 'Moss', cost: { wood: 30 } },
    { id: '#6366f1', name: 'Royal', cost: { ancient_coin: 1, cloth: 10 } },
    { id: '#1f2937', name: 'Charcoal', cost: { wood: 50, scrap: 10 } }
  ],
  cabinColors: [
    { id: '#fef3c7', name: 'Bleached', cost: {} }, // Default
    { id: '#d1d5db', name: 'Steel', cost: { scrap: 15 } },
    { id: '#fcd34d', name: 'Gold', cost: { ancient_coin: 1 } },
    { id: '#fca5a5', name: 'Rose', cost: { cloth: 10 } },
    { id: '#a5b4fc', name: 'Mist', cost: { plastic: 15 } }
  ],
  roofColors: [
    { id: '#78350f', name: 'Thatch', cost: {} }, // Default
    { id: '#dc2626', name: 'Red Paint', cost: { wood: 10 } },
    { id: '#2563eb', name: 'Blue Tarp', cost: { plastic: 20 } },
    { id: '#059669', name: 'Green Canvas', cost: { cloth: 15 } },
    { id: '#4b5563', name: 'Iron', cost: { scrap: 20 } }
  ],
  hullShapes: [
    { id: 'classic', name: 'Classic', description: 'Reliable and balanced.', cost: {} },
    { id: 'catamaran', name: 'Catamaran', description: 'Double-hulled stability.', cost: { wood: 60, plastic: 20 } },
    { id: 'barge', name: 'Barge', description: 'Wide deck for heavy loads.', cost: { wood: 80, scrap: 30 } }
  ],
  cabinShapes: [
    { id: 'box', name: 'Box', description: 'Simple shelter.', cost: {} },
    { id: 'a-frame', name: 'A-Frame', description: 'Classic peaked roof.', cost: { wood: 30, cloth: 10 } },
    { id: 'dome', name: 'Dome', description: 'Aerodynamic geometry.', cost: { scrap: 40, plastic: 25 } }
  ],
  lightTypes: [
    { id: 'cone', name: 'Flashlight', description: 'Focused forward beam.', cost: {} },
    { id: 'beam', name: 'Spotlight', description: 'Long-range narrow beam.', cost: { river_gem: 1, scrap: 10 } },
    { id: 'radial', name: 'Lantern', description: 'Omni-directional glow.', cost: { plastic: 20, wood: 10 } }
  ],
  lightColors: [
    { id: '#f59e0b', name: 'Warm', cost: {} },
    { id: '#ffffff', name: 'Halogen', cost: { plastic: 10, scrap: 5 } },
    { id: '#ef4444', name: 'Warning', cost: { scrap: 15 } },
    { id: '#3b82f6', name: 'Xenon', cost: { river_gem: 1 } }
  ]
};

