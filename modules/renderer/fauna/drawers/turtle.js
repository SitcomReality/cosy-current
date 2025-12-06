export function drawTurtle(ctx, c, size) {
  // Simplified top-down turtle: angular shell polygon and a rectangular head that can extend.
  const shellLen = size * 0.9;
  const shellWid = size * 0.7;

  // Head base sizes (will be modulated by a subtle periodic "stretch" to simulate neck extension)
  const headWid = size * 0.2;
  const headBaseLen = size * 0.25;

  const shellColor = c.color || '#166534';
  const rimColor = '#065f46';
  const headColor = '#374151';

  // Shell polygon (straight-edged)
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

  // Shell "grid" pattern: two straight lines for a crossing
  ctx.strokeStyle = rimColor;
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, -halfW);
  ctx.lineTo(0, halfW);
  ctx.moveTo(-halfL * 0.6, 0);
  ctx.lineTo(halfL * 0.6, 0);
  ctx.stroke();

  // Head stretch animation: subtle periodic extension based on life + optional id-based phase
  const phaseSeed = (c && c.id) ? (c.id.charCodeAt(0) % 17) : 7;
  const phase = (c && typeof c.life === 'number') ? (c.life * 1.6 + phaseSeed * 0.3) : phaseSeed;
  // Sine in [-1,1] -> map to [0.65, 1.35] for 35% extension range
  const stretch = 1.0 + Math.sin(phase) * 0.35;
  const headLen = headBaseLen * stretch;

  // Draw head as a simple rectangle extending from the shell front; no eyes/features
  ctx.fillStyle = headColor;
  ctx.beginPath();
  ctx.rect(halfL, -headWid * 0.5, headLen, headWid);
  ctx.fill();
}