export function drawSheep(ctx, c, size) {
  // Chunky blocky sheep: rectangle body, small head, tiny legs, no curves
  const bodyLen = size * 0.9;
  const bodyWid = size * 0.6;
  const headLen = size * 0.32;
  const headWid = size * 0.28;
  const legLen = size * 0.18;
  const legWid = size * 0.08;

  const woolColor = c.color || '#e5e7eb';
  // Slightly darker for face/legs
  const faceColor = '#4b5563';

  // Body
  ctx.fillStyle = woolColor;
  ctx.beginPath();
  ctx.rect(-bodyLen * 0.5, -bodyWid * 0.5, bodyLen, bodyWid);
  ctx.fill();

  // Simple top "ridge" to make the wool look chunky
  ctx.fillStyle = '#d4d4d8';
  ctx.beginPath();
  ctx.rect(-bodyLen * 0.45, -bodyWid * 0.5, bodyLen * 0.9, bodyWid * 0.22);
  ctx.fill();

  // Head at front-right of body
  ctx.fillStyle = faceColor;
  ctx.beginPath();
  ctx.rect(bodyLen * 0.5, -headWid * 0.5, headLen, headWid);
  ctx.fill();

  // Simple ear as a small block
  ctx.beginPath();
  ctx.rect(bodyLen * 0.5 + headLen * 0.2, -headWid * 0.8, headLen * 0.25, headWid * 0.4);
  ctx.fill();

  // Legs: four blocks under body corners
  ctx.fillStyle = faceColor;
  const legOffsetX = bodyLen * 0.3;
  const legOffsetY = bodyWid * 0.4;
  // front-right
  ctx.fillRect(legOffsetX, -legOffsetY, legWid, legLen);
  // front-left
  ctx.fillRect(legOffsetX, legOffsetY - legLen, legWid, legLen);
  // rear-right
  ctx.fillRect(-legOffsetX - legWid, -legOffsetY, legWid, legLen);
  // rear-left
  ctx.fillRect(-legOffsetX - legWid, legOffsetY - legLen, legWid, legLen);
}