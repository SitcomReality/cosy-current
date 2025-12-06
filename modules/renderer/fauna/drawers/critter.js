export function drawCritter(ctx, c, size) {
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, 0);
  ctx.lineTo(-size * 0.3, -size * 0.4);
  ctx.lineTo(-size * 0.3, size * 0.4);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = c.color;
  ctx.lineWidth = Math.max(1, size * 0.1);
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, 0);
  ctx.lineTo(-size * 0.6, size * 0.2);
  ctx.stroke();
}

