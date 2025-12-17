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


export function drawCollectable(ctx, collectable, screenX, screenY, size) {
  const item = ITEM_REGISTRY[collectable.itemId];
  if (!item) return;

  const color = getItemColor(item);
  const drawer = COLLECTABLE_DRAWERS[collectable.itemId];

  if (!drawer) {
    console.warn(`No drawer found for item ID: ${collectable.itemId}`);
    // Fallback to generic star/diamond if drawer missing
    drawGenericCollectable(ctx, screenX, screenY, size, color, collectable);
    return;
  }
  
  const fadeIn = Math.min(1, collectable.lifetime / 10);
  const pulse = 0.8 + 0.2 * Math.sin(collectable.lifetime * 4);

  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.globalAlpha = fadeIn;

  // Glow (only apply glow/pulse effect to collectables, not generic materials)
  if (item.type === 'collectable') {
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 2 * pulse;
  }
  
  // Dispatch drawing using the item's preferred color
  drawer(ctx, color, size * 0.5); // Pass half size as drawers use radius/half-dims

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawGenericCollectable(ctx, screenX, screenY, size, color, collectable) {
  const fadeIn = Math.min(1, collectable.lifetime / 10);
  const pulse = 0.8 + 0.2 * Math.sin(collectable.lifetime * 4);
  
  ctx.save();
  ctx.globalAlpha = fadeIn;

  // Glow
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 2 * pulse;
  ctx.fillStyle = color;
  
  // Draw as a small star/diamond
  const pts = 4;
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const a = (i / (pts * 2)) * Math.PI * 2;
    const r = size * (i % 2 === 0 ? 1 : 0.6);
    const x = screenX + Math.cos(a) * r;
    const y = screenY + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

