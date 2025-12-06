export function drawBird(ctx, c, size, cycle) {
  const flapPhase = Math.sin(c.life * 8);
  const wingSpan = size * 1.5;
  const wingY = size * 0.3 * flapPhase;

  ctx.strokeStyle = c.color;
  ctx.lineWidth = Math.max(1, size * 0.15);
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(-wingSpan * 0.5, wingY);
  ctx.lineTo(0, 0);
  ctx.lineTo(wingSpan * 0.5, wingY);
  ctx.stroke();

  // Replace circular body with a straight-edged triangular body
  ctx.fillStyle = c.color;

  // Rotate the triangular body by 90 degrees so it points forward relative to wings
  ctx.save();
  // Flip the body triangle 180° relative to its current orientation so the point faces the other direction
  ctx.rotate(Math.PI / 2 + Math.PI);

  // Draw the body triangle without an extra internal rotation (we rotated the whole bird earlier)
  const bodyLen = size * 0.9;
  const bodyWid = Math.max(0.2, size * 0.6);
  ctx.beginPath();
  ctx.moveTo(bodyLen * 0.5, 0);                    // front tip
  ctx.lineTo(-bodyLen * 0.5, -bodyWid * 0.5);      // back top
  ctx.lineTo(-bodyLen * 0.5, bodyWid * 0.5);       // back bottom
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}