export function drawTurtle(ctx, c, size) {
  // Rigid top-down turtle: angular shell polygon, blocky head and legs, no curves
  const shellLen = size * 0.9;
  const shellWid = size * 0.7;
  const headLen = size * 0.25;
  const headWid = size * 0.2;
  const legLen = size * 0.18;
  const legWid = size * 0.14;

  const shellColor = c.color || '#166534';
  const rimColor = '#065f46';
  const limbColor = '#374151';

  // Shell polygon (octagon-ish but only straight lines)
  const halfL = shellLen * 0.5;
  const halfW = shellWid * 0.5;

  ctx.fillStyle = shellColor;
  ctx.beginPath();
  ctx.moveTo(-halfL * 0.9, -halfW * 0.5);
  ctx.lineTo(-halfL * 0.5, -halfW);
  ctx.lineTo(halfL * 0.5, -halfW);
  ctx.lineTo(halfL * 0.9, -halfW * 0.5);
  ctx.lineTo(halfL * 0.9, halfW * 0.5);
  ctx.lineTo(halfL * 0.5, halfW);
  ctx.lineTo(-halfL * 0.5, halfW);
  ctx.lineTo(-halfL * 0.9, halfW * 0.5);
  ctx.closePath();
  ctx.fill();

  // Shell "grid" pattern: a couple of straight lines
  ctx.strokeStyle = rimColor;
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.beginPath();
  // Longitudinal
  ctx.moveTo(0, -halfW);
  ctx.lineTo(0, halfW);
  // Cross
  ctx.moveTo(-halfL * 0.6, 0);
  ctx.lineTo(halfL * 0.6, 0);
  ctx.stroke();

  // Head block at front
  ctx.fillStyle = limbColor;
  ctx.beginPath();
  ctx.rect(halfL, -headWid * 0.5, headLen, headWid);
  ctx.fill();

  // Legs: four rectangular blocks at shell corners
  const legOffsetX = halfL * 0.7;
  const legOffsetY = halfW * 0.7;

  // front-right
  ctx.fillRect(legOffsetX, -legOffsetY - legWid * 0.5, legLen, legWid);
  // front-left
  ctx.fillRect(legOffsetX, legOffsetY - legWid * 0.5, legLen, legWid);
  // rear-right
  ctx.fillRect(-legOffsetX - legLen, -legOffsetY - legWid * 0.5, legLen, legWid);
  // rear-left
  ctx.fillRect(-legOffsetX - legLen, legOffsetY - legWid * 0.5, legLen, legWid);
}