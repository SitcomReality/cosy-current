import { ITEM_REGISTRY } from '../../data/items.js';

export function drawCollectable(ctx, collectable, screenX, screenY, size) {
  const item = ITEM_REGISTRY[collectable.itemId];
  if (!item) return;

  // Assign color based on rarity and type
  let color = '#fbbf24'; // default gold
  if (item.type === 'collectable') {
    color = '#a78bfa'; // purple for rare
  } else if (item.rarity < 0.5) {
    color = '#ef4444'; // red for less common
  }

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

