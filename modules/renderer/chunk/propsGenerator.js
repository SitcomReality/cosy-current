// Props generator: deterministic per-chunk prop placement (trees, grasses, aquatic flora)

export function createPropsGenerator({ CHUNK_SIZE, game, noise }) {

  function getChunkProps(cx, cy) {
    const key = `${cx},${cy}`;
    // Keep caller-side cache; this module only generates when asked.
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
          if (rand < 0.50) {
             const jx = (Math.sin(h) * 0.5) + 0.5;
             const jy = (Math.cos(h) * 0.5) + 0.5;
             props.push({
               x: worldX + jx * 0.8,
               y: worldY + jy * 0.8,
               h: 2.0 + rand * 1.6,
               type: 'forest'
             });
          }
        } else if (tile === game.CONSTANTS.TILE_GRASS) {
          if (rand < 0.05) {
             const jx = (Math.sin(h) * 0.5) + 0.5;
             const jy = (Math.cos(h) * 0.5) + 0.5;
             props.push({
               x: worldX + jx * 0.8,
               y: worldY + jy * 0.8,
               h: 2.0 + rand * 1.6,
               type: 'grass'
             });
          }
        } else if (tile === game.CONSTANTS.TILE_WATER) {
          // Aquatic flora generation
          const r = noise.getRiverSystem(worldX, worldY);
          let chance = 0;
          let type = null;
          let hMult = 1.0;

          if (r.value > 0.85) {
             chance = 0.125;
             type = 'reeds';
             hMult = 0.8;
          } else if (r.value > 0.4) {
             chance = 0.075;
             type = 'seagrass';
             hMult = 0.6;
          } else {
             chance = 0.013;
             type = 'kelp';
             hMult = 1.2;
          }

          if (rand < chance) {
             const jx = (Math.sin(h) * 0.5) + 0.5;
             const jy = (Math.cos(h) * 0.5) + 0.5;
             const depthFactor = Math.max(0, Math.min(1, (1.0 - r.value) * 1.2));

             props.push({
               x: worldX + jx * 0.8,
               y: worldY + jy * 0.8,
               h: (1.0 + rand * 1.0) * hMult,
               type: type,
               depth: depthFactor,
               phase: rand * Math.PI * 2
             });
          }
        }
      }
    }

    return props;
  }

  return { getChunkProps };
}