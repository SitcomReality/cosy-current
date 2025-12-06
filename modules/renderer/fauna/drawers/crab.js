export function drawCrab(ctx, c, size) {
  const colors = c.segmentColors || [c.color, c.color];
  const w = size * 0.8;
  const h = size * 0.6;

  // Legs (zigzag lines)
  ctx.strokeStyle = c.color; // Use base color for legs
  ctx.lineWidth = size * 0.15;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw 3 legs per side
  for (let side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const legOffset = (i - 1) * (w * 0.4);
      ctx.beginPath();
      ctx.moveTo(0, legOffset);
      ctx.lineTo(side * w * 0.8, legOffset - h * 0.3); // Knee
      ctx.lineTo(side * w * 1.2, legOffset + h * 0.2); // Foot
      ctx.stroke();
    }
    // Claw
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.4);
    ctx.lineTo(side * w * 0.6, -h * 0.8);
    ctx.lineTo(side * w * 0.9, -h * 1.2); // Pointy claw tip
    ctx.stroke();
  }

  // Shell Segments (Pointy trapezoids/polygons)
  // Stacked back-to-front
  const segCount = colors.length;
  const segStep = (h * 1.2) / segCount;

  for (let i = 0; i < segCount; i++) {
    const col = colors[i];
    const yOff = (i - (segCount - 1) / 2) * segStep * 0.8;
    const segScale = 1.0 - (i * 0.15);

    ctx.fillStyle = col;
    ctx.beginPath();

    const sw = w * (0.8 - i * 0.1); 
    const sh = segStep * 1.2;

    const localY = (i * segStep) - (h * 0.5);

    ctx.moveTo(-sw, localY + sh);
    ctx.lineTo(-sw * 0.8, localY); // top left
    ctx.lineTo(0, localY - sh * 0.3); // top point
    ctx.lineTo(sw * 0.8, localY); // top right
    ctx.lineTo(sw, localY + sh); // bottom right
    ctx.lineTo(0, localY + sh * 0.8); // bottom center indent
    ctx.closePath();
    ctx.fill();

    // Rim
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Eyes
  ctx.fillStyle = 'black';
  ctx.beginPath();
  ctx.arc(-w * 0.3, -h * 0.6, size * 0.1, 0, Math.PI * 2);
  ctx.arc(w * 0.3, -h * 0.6, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
}