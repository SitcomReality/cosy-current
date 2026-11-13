// Chunk props (trees + aquatic flora) generation, extracted from the main manager.

export function createChunkPropsManager({ CHUNK_SIZE, game, noise }) {
  const chunkPropsCache = new Map();

  function clearPropsCache() {
    chunkPropsCache.clear();
  }

  function prunePropsCache() {
    const now = performance.now();
    for (const [key, val] of chunkPropsCache) {
      if (now - val.lastUsed > 2000) {
        chunkPropsCache.delete(key);
      }
    }
  }

  // Get tree/prop data for a chunk
  function getChunkProps(cx, cy) {
    const key = `${cx},${cy}`;
    if (chunkPropsCache.has(key)) {
      const data = chunkPropsCache.get(key);
      data.lastUsed = performance.now();
      return data.props;
    }

    const props = [];
    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;

    // Deterministic seed for this chunk
    const chunkSeed = (cx * 73856093) ^ (cy * 19349663);

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = startX + x;
        const worldY = startY + y;
        const tile = game.getTile(worldX, worldY);

        // Simple hash
        const h = Math.sin(worldX * 12.9898 + worldY * 78.233 + chunkSeed) * 43758.5453;
        const rand = h - Math.floor(h);

        // Trees
        if (tile === game.CONSTANTS.TILE_FOREST) {
          if (rand < 0.50) { // reduced from 65% -> 50% to avoid overcrowding when larger
             // Add some jitter to position
             const jx = (Math.sin(h) * 0.5) + 0.5; 
             const jy = (Math.cos(h) * 0.5) + 0.5;
             props.push({ 
               x: worldX + jx * 0.8, 
               y: worldY + jy * 0.8, 
               h: 2.0 + rand * 1.6, // doubled size range (was 1.0 + rand * 0.8)
               type: 'forest',
               phase: rand * Math.PI * 2
             });
          }
        } else if (tile === game.CONSTANTS.TILE_GRASS) {
          if (rand < 0.05) { // 5% density kept for grass props
             const jx = (Math.sin(h) * 0.5) + 0.5; 
             const jy = (Math.cos(h) * 0.5) + 0.5;
             props.push({ 
               x: worldX + jx * 0.8, 
               y: worldY + jy * 0.8, 
               h: 2.0 + rand * 1.6, // now matches forest size range and doubled from previous grass sizes
               type: 'grass',
               phase: rand * Math.PI * 2
             });
          }
        } else if (tile === game.CONSTANTS.TILE_WATER) {
          // Aquatic flora generation
          // r.value: 0.0 (deep) -> 1.0 (bank)
          const r = noise.getRiverSystem(worldX, worldY);
          
          // Probability checks based on depth
          // We want more plants near edges, fewer in deep center channel to keep navigation clear-ish
          let chance = 0;
          let type = null;
          let hMult = 1.0;

          if (r.value > 0.85) {
             // Very shallow/bank: Reeds
             // Halved probability (approx) to reduce overall flora
             chance = 0.125; // was 0.25
             type = 'reeds';
             hMult = 0.8;
          } else if (r.value > 0.4) {
             // Mid depth: Seagrass
             chance = 0.075; // was 0.15
             type = 'seagrass';
             hMult = 0.6;
          } else {
             // Deep: Kelp
             // Reduced kelp frequency further (about half previous)
             chance = 0.013; // was 0.026
             type = 'kelp';
             hMult = 1.2;
          }

          if (rand < chance) {
             const jx = (Math.sin(h) * 0.5) + 0.5; 
             const jy = (Math.cos(h) * 0.5) + 0.5;
             
             // Calculate depth factor (0=surface/bank, 1=deepest) for tinting
             const depthFactor = Math.max(0, Math.min(1, (1.0 - r.value) * 1.2));

             props.push({ 
               x: worldX + jx * 0.8, 
               y: worldY + jy * 0.8, 
               h: (1.0 + rand * 1.0) * hMult, 
               type: type,
               depth: depthFactor,
               // Store a random phase for any sway animation if we add it later
               phase: rand * Math.PI * 2
             });
          }
        }
      }
    }

    chunkPropsCache.set(key, { props, lastUsed: performance.now() });
    return props;
  }

  return { getChunkProps, clearPropsCache, prunePropsCache };
}
