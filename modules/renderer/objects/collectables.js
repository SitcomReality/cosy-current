import { ITEM_REGISTRY } from '../../data/items.js';
import { COLLECTABLE_DRAWERS } from './collectables/drawers.js';

// Define standard colors used for item icons/glows
const MATERIAL_COLOR = '#9ca3af'; // Grey/Silver for generic material components
const COLLECTABLE_COLOR = '#a78bfa'; // Purple for rare
const GOLD_COLOR = '#fbbf24';

function getItemColor(item) {
  if (item.id === 'wood') return '#92400e';
  if (item.id === 'scrap' || item.id === 'plastic') return MATERIAL_COLOR;
  if (item.id === 'cloth') return '#fef3c7'; // off-white cloth

  // Collectables get the special purple/gold treatment
  if (item.type === 'collectable') {
    return COLLECTABLE_COLOR; 
  }
  
  // Fallback based on rarity for other materials
  if (item.rarity < 0.5) {
    return '#ef4444'; // red for less common
  }
  return GOLD_COLOR;
}

// Helper function to draw the universal visual indicator for collectables
function drawCollectableIndicator(ctx, size, color, lifetime) {
  ctx.save();
  
  const indicatorSize = size * 1.5;
  const rotationSpeed = 0.05;
  const rotation = lifetime * rotationSpeed;
  
  // 1. Draw universal angular background/halo (Bright & Angular)
  const haloColor = GOLD_COLOR;
  
  ctx.rotate(rotation);
  
  // Base polygon: tilted square (diamond shape)
  ctx.fillStyle = haloColor;
  ctx.beginPath();
  ctx.moveTo(0, -indicatorSize);
  ctx.lineTo(indicatorSize, 0);
  ctx.lineTo(0, indicatorSize);
  ctx.lineTo(-indicatorSize, 0);
  ctx.closePath();
  ctx.fill();
  
  // Inner diamond, slightly rotated relative to outer one, and darkened
  ctx.rotate(Math.PI / 4);
  const innerSize = indicatorSize * 0.6;
  const darkerGold = '#cc7722'; 
  ctx.fillStyle = darkerGold; 
  ctx.beginPath();
  ctx.moveTo(0, -innerSize);
  ctx.lineTo(innerSize, 0);
  ctx.lineTo(0, innerSize);
  ctx.lineTo(-innerSize, 0);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}


export function drawCollectable(ctx, collectable, screenX, screenY, collectableDrawSize) {
  const item = ITEM_REGISTRY[collectable.itemId];
  if (!item) return;

  const color = getItemColor(item);
  const drawer = COLLECTABLE_DRAWERS[collectable.itemId];

  if (!drawer) {
    console.warn(`No drawer found for item ID: ${collectable.itemId}`);
    // Fallback to generic star/diamond if drawer missing
    drawGenericCollectable(ctx, screenX, screenY, collectableDrawSize, color, collectable);
    return;
  }
  
  const fadeIn = Math.min(1, collectable.lifetime / 10);
  const pulse = 0.8 + 0.2 * Math.sin(collectable.lifetime * 4);
  
  // Base radius passed to item drawers (e.g., tileSize * 0.25)
  const itemRadius = collectableDrawSize * 0.5;

  // Calculate vertical bobbing offset for the entire object group
  const bobbingSpeed = 3.0;
  const bobbingAmplitude = collectableDrawSize * 0.25; 
  const bobbingOffset = Math.sin(collectable.lifetime * bobbingSpeed) * bobbingAmplitude;

  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.globalAlpha = fadeIn;

  // 1. Draw Universal Indicator (Halo/Base)
  ctx.save();
  ctx.translate(0, bobbingOffset);
  drawCollectableIndicator(ctx, itemRadius, color, collectable.lifetime);
  ctx.restore();

  // 2. Draw Item Sprite
  // Item sprite should sit slightly above the indicator base, centered on the bobbing motion.
  const spriteOffsetCorrection = -itemRadius * 0.2; 
  
  ctx.save();
  ctx.translate(0, bobbingOffset + spriteOffsetCorrection);

  // Glow (only apply glow/pulse effect to collectables, not generic materials)
  if (item.type === 'collectable') {
    ctx.shadowColor = color;
    ctx.shadowBlur = collectableDrawSize * 2 * pulse;
  }
  
  // Dispatch drawing using the item's preferred color
  drawer(ctx, color, itemRadius); 

  ctx.restore(); // Restore from item offset

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawGenericCollectable(ctx, screenX, screenY, collectableDrawSize, color, collectable) {
  const fadeIn = Math.min(1, collectable.lifetime / 10);
  const pulse = 0.8 + 0.2 * Math.sin(collectable.lifetime * 4);

  const itemRadius = collectableDrawSize * 0.5;

  const bobbingSpeed = 3.0;
  const bobbingAmplitude = collectableDrawSize * 0.25; 
  const bobbingOffset = Math.sin(collectable.lifetime * bobbingSpeed) * bobbingAmplitude;
  const spriteOffsetCorrection = -itemRadius * 0.2; 
  
  ctx.save();
  ctx.globalAlpha = fadeIn;
  ctx.translate(screenX, screenY);

  // 1. Draw Universal Indicator (Halo/Base)
  ctx.save();
  ctx.translate(0, bobbingOffset);
  drawCollectableIndicator(ctx, itemRadius, color, collectable.lifetime);
  ctx.restore();

  // 2. Draw Generic Item Sprite
  ctx.save();
  ctx.translate(0, bobbingOffset + spriteOffsetCorrection);

  // Glow
  ctx.shadowColor = color;
  ctx.shadowBlur = collectableDrawSize * 2 * pulse;
  ctx.fillStyle = color;
  
  // Draw as a small star/diamond
  const pts = 4;
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const a = (i / (pts * 2)) * Math.PI * 2;
    const r = itemRadius * (i % 2 === 0 ? 1 : 0.6);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.restore(); // Restore item sprite offset

  ctx.shadowBlur = 0;
  ctx.restore(); // Restore screen X/Y offset
}

