export function drawFirefly(ctx, c, size) {
  // Brighter, tiny square center with thin yellow outline and stronger glow
  const baseColor = '#ffffff';
  const rimColor = '#fef08a'; // soft yellow outline
  // Pulsing factor for subtle glow animation
  const pulse = 0.65 + 0.35 * Math.sin(c.life * 4 + (c.id ? c.id.charCodeAt(0) : 0));
  // Reduced multiplier for glow from 10 -> 5 for less intense blur
  const glow = Math.max(1, size * 5 * pulse); // was 10

  ctx.save();
  ctx.translate(0, 0);

  // Glow (bigger than before)
  ctx.shadowColor = rimColor;
  ctx.shadowBlur = glow;
  ctx.globalAlpha = 0.95;

  // Tiny filled white square at center
  const coreSize = Math.max(2, Math.min(4, size * 0.25)); // Increased minimum core size for visibility
  ctx.fillStyle = baseColor;
  ctx.fillRect(-coreSize / 2, -coreSize / 2, coreSize, coreSize);

  // Thin yellow outline
  ctx.shadowBlur = glow * 0.6; // slightly smaller blur for outline
  ctx.strokeStyle = rimColor;
  ctx.lineWidth = Math.max(0.5, coreSize * 0.25);
  ctx.strokeRect(-coreSize / 2, -coreSize / 2, coreSize, coreSize);

  // Reset shadow and alpha
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}