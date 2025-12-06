// Rigid top-down turtle: angular shell polygon and a stretching neck/head, no curves or visible legs
export function drawTurtle(ctx, c, size) {
  // Shell sizes
  const shellLen = size * 0.9;
  const shellWid = size * 0.7;

  const shellColor = c.color || '#166534';
  const rimColor = '#065f46';
  const limbColor = '#374151';

  const halfL = shellLen * 0.5;
  const halfW = shellWid * 0.5;

  // Shell polygon (straight-edged octagon-ish)
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

  // Shell "grid" pattern: longitudinal and cross lines
  ctx.strokeStyle = rimColor;
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, -halfW);
  ctx.lineTo(0, halfW);
  ctx.moveTo(-halfL * 0.6, 0);
  ctx.lineTo(halfL * 0.6, 0);
  ctx.stroke();

  // Head stretch behavior:
  // Use a deterministic-ish phase from id when available to desync individuals.
  const basePhase = (c.id && c.id.length) ? c.id.charCodeAt(0) : 1;
  // Smooth periodic stretch + occasional stronger poke
  const periodic = Math.max(0, Math.sin(c.life * 1.6 + basePhase * 0.13));
  // Occasional stronger stretch triggered when periodic is near its peak
  const poke = periodic > 0.85 ? (periodic - 0.85) / 0.15 : 0;
  // Compose stretch factor (1.0 = resting, up to ~1.8 when fully poking)
  const stretchFactor = 1.0 + periodic * 0.35 + poke * 0.5;

  // Head dimensions (head extends from front of shell)
  const baseHeadLen = size * 0.25;
  const headLen = baseHeadLen * stretchFactor;
  const headWid = size * 0.2;

  // Draw head block (no legs)
  ctx.fillStyle = limbColor;
  ctx.beginPath();
  ctx.rect(halfL, -headWid * 0.5, headLen, headWid);
  ctx.fill();

  // Small ear/block detail
  ctx.beginPath();
  ctx.rect(halfL + headLen * 0.2, -headWid * 0.8, headLen * 0.22, headWid * 0.4);
  ctx.fill();

  // Remove legs for top-down simplified view (no visible feet)

  // Subtle eye indicator as a tiny square for readability at small sizes
  const eyeX = halfL + headLen * 0.45;
  const eyeY = -headWid * 0.15;
  ctx.fillStyle = 'black';
  ctx.fillRect(eyeX - 1, eyeY - 1, 2, 2);
}