import { createChunkManager } from './chunk.js';
import { getVertexOffset } from './vertex.js';
import { convexHull, floodFill } from './hull.js';
import { createWaterEffects } from '../water.js';

// This file composes the modular renderer pieces into the original public API
export function createRenderer({ canvas, state, game, noise }) {
  const ctx = canvas.getContext('2d', { alpha: false });

  // OKLCH Palette for a cozy, low-poly aesthetic
  // Note: OKLCH support is modern (Chrome 111+, Safari 15.4+, FF 113+)
  // Preferred OKLCH strings with fallback hex colors for older browsers.
  const PALETTE = {
    waterDeep: { oklch: 'oklch(45% 0.12 250)', hex: '#0b63a8' },      // Deep distinctive blue
    waterShallow: { oklch: 'oklch(65% 0.1 240)', hex: '#5fb2e6' },    // Lighter blue
    sand: { oklch: 'oklch(92% 0.06 95)', hex: '#f0d6a6' },            // Warm pale sand
    grass: { oklch: 'oklch(78% 0.16 135)', hex: '#6fbf3f' },          // Vibrant fresh green
    forest: { oklch: 'oklch(52% 0.14 145)', hex: '#2f6b2b' },         // Darker cool green
    hill: { oklch: 'oklch(70% 0.04 280)', hex: '#9a87a8' },           // Grey-ish purple
    mountain: { oklch: 'oklch(92% 0.01 280)', hex: '#f5f3f7' },       // Near white
    
    // Trees
    treeForest: { oklch: 'oklch(42% 0.14 145)', hex: '#254e22' },     // Slightly darker than forest floor
    treeGrass: { oklch: 'oklch(60% 0.16 140)', hex: '#49a33a' },      // Standout green
  };

  // Feature-detect whether the browser accepts OKLCH by trying to assign it to the canvas context.
  // If not supported, fall back to the provided hex strings.
  function chooseColor(ctx, entry) {
    if (!entry) return '#ff00ff';
    // Force hex fallback: The previous dynamic feature detection was unreliable, 
    // potentially causing invalid color strings to be returned, breaking 
    // water gradient calculations (which expect hex input in chunk.js) and 
    // resulting in black terrain where colors were unsupported.
    return entry.hex || entry.oklch || '#ff00ff';
  }

  const WATER_PALETTE = {
    // resolved at runtime below
  };

  const COLORS = {
    // resolved at runtime below
  };
  // Resolve palette entries to either OKLCH strings or safe hex fallbacks depending on runtime support.
  (function resolvePalettes() {
    const testCtx = document.createElement('canvas').getContext('2d');
    WATER_PALETTE.deep = chooseColor(testCtx, PALETTE.waterDeep);
    WATER_PALETTE.shallow = chooseColor(testCtx, PALETTE.waterShallow);

    COLORS[game.CONSTANTS.TILE_WATER] = chooseColor(testCtx, PALETTE.waterShallow);
    COLORS[game.CONSTANTS.TILE_BANK] = chooseColor(testCtx, PALETTE.sand);
    COLORS[game.CONSTANTS.TILE_GRASS] = chooseColor(testCtx, PALETTE.grass);
    COLORS[game.CONSTANTS.TILE_FOREST] = chooseColor(testCtx, PALETTE.forest);
    COLORS[game.CONSTANTS.TILE_HILL] = chooseColor(testCtx, PALETTE.hill);
    COLORS[game.CONSTANTS.TILE_MOUNTAIN] = chooseColor(testCtx, PALETTE.mountain);

    // Tree colors used in drawTree/drawTreeShadow
    PALETTE.treeForest = chooseColor(testCtx, PALETTE.treeForest);
    PALETTE.treeGrass = chooseColor(testCtx, PALETTE.treeGrass);
  })();

  const CHUNK_SIZE = 16;
  const chunkManager = createChunkManager({ CHUNK_SIZE, COLORS, WATER_PALETTE, state, game, noise, getVertexOffset });
  const waterEffects = createWaterEffects({ state, game, noise });

  function resize() {
    const dpr = state.pixelRatio;
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = state.width * dpr;
    canvas.height = state.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    chunkManager.clearCache();
  }

  // Calculate day/night cycle properties
  function getCycleProps() {
    // dayTime: 0..1
    // 0 = Midnight, 0.25 = Sunrise, 0.5 = Noon, 0.75 = Sunset
    const t = state.dayTime;
    
    // Shadow Direction: Sun moves East(0.25) -> Up(0.5) -> West(0.75)
    // We simulate shadows moving opposite to sun.
    // Sunrise (Sun at +X) -> Shadow points -X (Left)
    // Sunset (Sun at -X) -> Shadow points +X (Right)
    
    let shadowX = 0;
    let shadowY = 0;
    let shadowAlpha = 0;
    let ambientColor = 'transparent';

    // Cycle calculations
    if (t < 0.2 || t > 0.8) {
      // Night
      shadowAlpha = 0; // No hard shadows at night, maybe ambient
      ambientColor = 'rgba(10, 10, 30, 0.6)'; // Dark blue overlay
    } else if (t >= 0.2 && t < 0.3) {
      // Dawn
      const p = (t - 0.2) / 0.1; // 0..1
      shadowX = -2.0 * (1.0 - p) - 0.5; // Long left shadow shrinking
      shadowY = 0.5;
      shadowAlpha = 0.4 * p;
      ambientColor = `rgba(50, 20, 10, ${0.4 * (1-p)})`; // Red/Orange tint fading
    } else if (t >= 0.3 && t < 0.7) {
      // Day
      // 0.3 -> 0.5 (Noon) -> 0.7
      const mid = (t - 0.3) / 0.4; // 0..1
      // Shadow moves Left -> Right
      // At noon (0.5), shadow length is minimal
      const sunPos = (mid - 0.5) * 2; // -1 (Morning) to 1 (Afternoon)
      
      shadowX = sunPos * 1.5; 
      shadowY = 0.5; // Slight permanent slant
      shadowAlpha = 0.3;
      ambientColor = 'rgba(0,0,0,0)';
    } else if (t >= 0.7 && t <= 0.8) {
      // Dusk
      const p = (t - 0.7) / 0.1; // 0..1
      shadowX = 1.0 + p * 2.0; // Lengthening right shadow
      shadowY = 0.5;
      shadowAlpha = 0.3 * (1 - p);
      ambientColor = `rgba(40, 10, 40, ${0.5 * p})`; // Purple tint
    }
    
    return { shadowX, shadowY, shadowAlpha, ambientColor };
  }

  function renderFrame(timestamp) {
    // Update Day Cycle
    state.dayTime = (state.dayTime + state.daySpeed * 0.01) % 1.0;
    
    const cycle = getCycleProps();
    const shadowVec = { x: cycle.shadowX, y: cycle.shadowY };

    // Background
    ctx.fillStyle = '#0f172a'; // Fallback
    ctx.fillRect(0, 0, state.width, state.height);

    if (!state.isPlaying) {
      // Just draw a placeholder or menu bg
      const hue = (timestamp * 0.01) % 360;
      ctx.fillStyle = `oklch(20% 0.1 ${hue})`;
      ctx.fillRect(0, 0, state.width, state.height);
      return;
    }

    const tileSize = state.tileSize;
    const centerX = state.width / 2;
    const centerY = state.height / 2;
    const visibleWidth = state.width;
    const visibleHeight = state.height;

    // View bounds
    const viewLeftTile = state.camera.x - (visibleWidth / 2) / tileSize;
    const viewRightTile = state.camera.x + (visibleWidth / 2) / tileSize;
    const viewTopTile = state.camera.y - (visibleHeight / 2) / tileSize;
    const viewBottomTile = state.camera.y + (visibleHeight / 2) / tileSize;

    const startChunkX = Math.floor(viewLeftTile / CHUNK_SIZE);
    const endChunkX = Math.floor(viewRightTile / CHUNK_SIZE);
    const startChunkY = Math.floor(viewTopTile / CHUNK_SIZE);
    const endChunkY = Math.floor(viewBottomTile / CHUNK_SIZE);

    // 1. Render Terrain (Chunks)
    for (let cy = startChunkY; cy <= endChunkY; cy++) {
      for (let cx = startChunkX; cx <= endChunkX; cx++) {
        const chunkImg = chunkManager.getChunk(cx, cy);
        const screenX = (cx * CHUNK_SIZE - state.camera.x) * tileSize + centerX;
        const screenY = (cy * CHUNK_SIZE - state.camera.y) * tileSize + centerY;
        
        // Simple culling
        if (screenX > state.width || screenY > state.height || 
            screenX + chunkImg.width < 0 || screenY + chunkImg.height < 0) continue;

        ctx.drawImage(chunkImg, Math.round(screenX), Math.round(screenY));
      }
    }

    // 2. Render Water Effects (Flat, below objects)
    waterEffects.render(ctx, state.camera, tileSize);

    // 3. Render Objects (Trees, Player, Entities) - with Shadow Pass
    // We render shadows for all objects first, then objects? 
    // Or just render back-to-front. 
    // Trees are static. We can render them per chunk.
    
    // Shared Shadow settings
    ctx.fillStyle = `rgba(0,0,0,${cycle.shadowAlpha})`;

    // Helper to draw tree shadow
    const drawTreeShadow = (tx, ty, h) => {
       if (cycle.shadowAlpha <= 0.01) return;
       const sx = (tx - state.camera.x) * tileSize + centerX;
       const sy = (ty - state.camera.y) * tileSize + centerY;
       
       const baseW = tileSize * 0.4 * h;
       const tipX = sx + shadowVec.x * tileSize * h;
       const tipY = sy + shadowVec.y * tileSize * h; // Shadows fall on flat ground
       
       ctx.beginPath();
       ctx.moveTo(sx - baseW/2, sy);
       ctx.lineTo(sx + baseW/2, sy);
       ctx.lineTo(tipX, tipY - tileSize * h); // Project tip
       ctx.fill();
    };

    // Helper to draw tree
    const drawTree = (tx, ty, h, type) => {
       const sx = (tx - state.camera.x) * tileSize + centerX;
       const sy = (ty - state.camera.y) * tileSize + centerY;
       const baseW = tileSize * 0.4 * h;
       const treeH = tileSize * 1.0 * h;

       ctx.fillStyle = type === 'forest' ? PALETTE.treeForest : PALETTE.treeGrass;
       ctx.beginPath();
       ctx.moveTo(sx - baseW/2, sy);
       ctx.lineTo(sx + baseW/2, sy);
       ctx.lineTo(sx, sy - treeH);
       ctx.fill();
       
       // Highlight side
       ctx.fillStyle = 'rgba(255,255,255,0.1)';
       ctx.beginPath();
       ctx.moveTo(sx, sy);
       ctx.lineTo(sx + baseW/2, sy);
       ctx.lineTo(sx, sy - treeH);
       ctx.fill();
    };

    // Render Trees
    // To handle depth correctly, we should sort or just iterate Y.
    // Iterating chunks is roughly Y-sorted if we do Y loop outer.
    for (let cy = startChunkY; cy <= endChunkY; cy++) {
      for (let cx = startChunkX; cx <= endChunkX; cx++) {
        const props = chunkManager.getChunkProps(cx, cy);
        // Props are not sorted inside chunk, but trees are small enough 
        // that exact Z-sorting might not matter vs simple painter's algo.
        // Let's sort props by Y for better occlusion.
        // (Optim: caching sorted props in chunkManager would be better)
        
        for (const tree of props) {
            // Shadow first
            drawTreeShadow(tree.x, tree.y, tree.h);
        }
        for (const tree of props) {
            // Then Tree
            drawTree(tree.x, tree.y, tree.h, tree.type);
        }
      }
    }
    
    chunkManager.pruneCache();

    // 4. Entities
    // Helper to draw a jagged polygonal influence area (no roundness)
    const drawJaggedInfluence = (ctx, centerX, centerY, radius, seedStr, fillColor) => {
      // deterministic pseudo-hash from string
      let h = 0;
      for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
      // Decide number of sides between 6 and 14
      const sides = 6 + (h % 9);
      // jitter amplitude fraction of radius
      const jitter = 0.18 + ((h >> 8) % 40) / 200; // 0.18..0.38

      ctx.fillStyle = fillColor;
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const t = i / sides;
        const ang = t * Math.PI * 2;
        // per-vertex pseudo-random radius perturbation
        const vHash = (h ^ (i * 2654435761)) >>> 0;
        const vRnd = ((vHash % 1000) / 1000) * 2 - 1; // -1..1
        const r = Math.max(0.1, radius * (1 + vRnd * jitter));
        const px = centerX + Math.cos(ang) * r;
        const py = centerY + Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    };

    state.entities.forEach(ent => {
       const screenX = (ent.x - state.camera.x) * tileSize + centerX;
       const screenY = (ent.y - state.camera.y) * tileSize + centerY;

       if (screenX < -tileSize*2 || screenX > state.width + tileSize*2 ||
           screenY < -tileSize*2 || screenY > state.height + tileSize*2) return;

       if (ent.type === game.CONSTANTS.ENTITY_CITY) {
         // Use game interaction radius (in tiles) scaled to pixels for the visible influence circle
        const influenceRadiusPx = (game.CONSTANTS.INTERACTION_RADIUS || 35) * tileSize;
        drawJaggedInfluence(ctx, screenX + tileSize/2, screenY + tileSize/2, influenceRadiusPx, ent.id + '_city', 'rgba(16, 185, 129, 0.18)');

         ctx.fillStyle = '#10b981';
         ctx.fillRect(screenX, screenY, tileSize, tileSize);
         ctx.fillStyle = '#065f46';
         ctx.fillRect(screenX + tileSize/2 - tileSize*0.1, screenY, tileSize*0.2, tileSize*0.6);
       } else if (ent.type === game.CONSTANTS.ENTITY_RELIC) {
         // Use same interaction radius for relic highlight
        const influenceRadiusPx = (game.CONSTANTS.INTERACTION_RADIUS || 35) * tileSize;
        drawJaggedInfluence(ctx, screenX + tileSize/2, screenY + tileSize/2, influenceRadiusPx, ent.id + '_relic', 'rgba(245, 158, 11, 0.18)');

         ctx.fillStyle = '#f59e0b';
         ctx.beginPath();
         ctx.moveTo(screenX + tileSize/2, screenY);
         ctx.lineTo(screenX + tileSize, screenY + tileSize);
         ctx.lineTo(screenX, screenY + tileSize);
         ctx.fill();
       }
    });

    // 5. Player
    const p = state.player;
    const px = (p.x - state.camera.x) * tileSize + centerX;
    const py = (p.y - state.camera.y) * tileSize + centerY;

    ctx.save();
    ctx.translate(px, py);
    
    // Player Shadow
    if (cycle.shadowAlpha > 0.01) {
        ctx.save();
        // Skew transformation for shadow
        // Simple approach: draw the boat black at an offset, distorted
        const shadowLen = 1.0; 
        ctx.translate(shadowVec.x * tileSize * shadowLen, shadowVec.y * tileSize * shadowLen);
        ctx.fillStyle = `rgba(0,0,0,${cycle.shadowAlpha})`;
        ctx.rotate(p.angle);
        ctx.fillRect(-tileSize, -tileSize*0.6, tileSize*2, tileSize*1.2);
        ctx.restore();
    }

    ctx.rotate(p.angle);

    const raftLen = tileSize * 1.8;
    const raftWid = tileSize * 1.2;

    // Shadow (Ambient occlusion below raft, separate from sun shadow)
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-raftLen/2 + 2, -raftWid/2 + 2, raftLen, raftWid);

    // Main deck
    ctx.fillStyle = '#92400e';
    ctx.fillRect(-raftLen/2, -raftWid/2, raftLen, raftWid);

    // Plank lines
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const x = -raftLen/2 + (i / 4) * raftLen;
      ctx.beginPath();
      ctx.moveTo(x, -raftWid/2);
      ctx.lineTo(x, raftWid/2);
      ctx.stroke();
    }

    // Cabin structure
    ctx.fillStyle = '#fef3c7';
    const cabinW = raftLen * 0.4;
    const cabinH = raftWid * 0.6;
    ctx.fillRect(-cabinW/2, -cabinH/2, cabinW, cabinH);

    // Cabin window
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(-cabinW/4, -cabinH/4, cabinW/2, cabinH/3);

    // Bow light
    ctx.fillStyle = '#fef08a';
    ctx.shadowColor = '#fef08a';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(raftLen/2 - 5, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
    
    // 6. Atmosphere Overlay
    if (cycle.ambientColor !== 'transparent') {
        ctx.fillStyle = cycle.ambientColor;
        // Blend mode could be 'multiply' or 'overlay' but simple alpha is safer for performance
        ctx.fillRect(0, 0, state.width, state.height);
    }
    
    // Debug time
    /*
    ctx.fillStyle = 'white';
    ctx.fillText(`Time: ${state.dayTime.toFixed(2)}`, 10, 20);
    */
  }

  function start() {
    resize();
    window.addEventListener('resize', resize);
  }

  function stop() {
    window.removeEventListener('resize', resize);
  }

  function clearCache() {
    chunkManager.clearCache();
  }

  return { start, stop, resize, renderFrame, clearCache, waterEffects };
}