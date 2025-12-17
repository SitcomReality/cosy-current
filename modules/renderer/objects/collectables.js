import { ITEM_REGISTRY } from '../../data/items.js';
import { COLLECTABLE_DRAWERS } from './collectables/drawers.js';

// Small helper to convert hex like "#rrggbb" to rgba(r,g,b,a)
function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const num = parseInt(h, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

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
 // Now renders a soft radial haze (opaque center → transparent edge) and gently rotates
 // based on the collectable's age (maxLifetime - lifetime) so the halo animates while bobbing.
function drawCollectableIndicator(ctx, size, color, collectable) {
  ctx.save();

  // Reduced indicator size to make the glow more subtle
  const indicatorSize = size * 1.0;
  const rotationSpeed = 0.25; // radians per second (gentle)

  // Compute age from stored lifetimes; fallback to provided lifetime-like number if shape differs
  const age = (collectable && typeof collectable.maxLifetime === 'number' && typeof collectable.lifetime === 'number')
    ? (collectable.maxLifetime - collectable.lifetime)
    : (typeof collectable === 'number' ? collectable : 0);

  const rotation = age * rotationSpeed;

  // Apply gentle rotation to the whole halo so it slowly turns while bobbing
  ctx.rotate(rotation);

  // Create a radial gradient: opaque center -> transparent edge
  const outer = indicatorSize;
  const inner = indicatorSize * 0.22;

  // Slightly tint center with GOLD_COLOR, mix toward provided color for a subtle hue
  const centerColor = GOLD_COLOR;
  const midColor = color || centerColor;

  const grad = ctx.createRadialGradient(0, 0, inner, 0, 0, outer);
  grad.addColorStop(0.0, centerColor);
  grad.addColorStop(0.2, midColor);
  grad.addColorStop(0.6, hexToRgba(midColor, 0.28));
  grad.addColorStop(1.0, hexToRgba(midColor, 0.0));

  // Draw circular haze using gradient
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, outer, 0, Math.PI * 2);
  ctx.fill();

  // Add a subtle inner angular core (small diamond) to retain the collectable "badge" silhouette,
  // but keep it semi-transparent so the gradient remains the dominant visual.
  ctx.rotate(Math.PI / 8); // slight offset for visual interest
  // Increased innerSize further to make the white core more prominent and legible.
  const innerSize = indicatorSize * 0.80;
  ctx.fillStyle = hexToRgba('#ffffff', 0.06);
  ctx.beginPath();
  ctx.moveTo(0, -innerSize);
  ctx.lineTo(innerSize, 0);
  ctx.lineTo(0, innerSize);
  ctx.lineTo(-innerSize, 0);
  ctx.closePath();
  ctx.fill();

  ctx.globalCompositeOperation = 'source-over';
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
  drawCollectableIndicator(ctx, itemRadius, color, collectable);
  ctx.restore();

  // 2. Draw Item Sprite
  // Item sprite should sit slightly above the indicator base, centered on the bobbing motion.
  const spriteOffsetCorrection = -itemRadius * 0.2; 
  
  ctx.save();
  ctx.translate(0, bobbingOffset + spriteOffsetCorrection);

  // Glow (only apply glow/pulse effect to collectables, not generic materials)
  if (item.type === 'collectable') {
    ctx.shadowColor = color;
    // Reduced blur to make glow less large and intrusive
    ctx.shadowBlur = collectableDrawSize * 1.2 * pulse;
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
  drawCollectableIndicator(ctx, itemRadius, color, collectable);
  ctx.restore();

  // 2. Draw Generic Item Sprite
  ctx.save();
  ctx.translate(0, bobbingOffset + spriteOffsetCorrection);

  // Glow
  ctx.shadowColor = color;
  // Reduced blur here as well to match the main collectable glow scaling
  ctx.shadowBlur = collectableDrawSize * 1.2 * pulse;
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

