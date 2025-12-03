// Fauna shadow rendering helpers

export function drawCreatureShadow(ctx, state, tileSize, c, screenX, screenY, size, cycle, shadowDir, noise) {
  ctx.save();  

  // Use definition type for logic
  const isWaterCreature = (c.def && c.def.pool === 'water');

  if (isWaterCreature && noise) {
    const riverInfo = noise.getRiverSystem(c.x, c.y);
    const waterDepth = Math.max(0, Math.min(1, 1.2 - riverInfo.value));
    const creatureDepth = c.depth || 0.3;

    const depthFactor = waterDepth * creatureDepth;
    const baseOffset = tileSize * cycle.shadowLength * 0.8;

    // Differentiate eel vs generic fish for shadow styling
    const isEel = c.type === 'eel';
    // Eels should cast a longer, sleeker shadow; length will be scaled by segmentCount
    const eelLengthBase = isEel ? 1.0 : 0.7;
    // Make eel shadow noticeably slimmer factor (used as thickness multiplier)
    const eelSlimness = isEel ? 0.26 : 0.7;

    // Offset scales with depthFactor so deeper gives a more separated shadow
    const offset = baseOffset * (0.3 + depthFactor * 0.7) * (isEel ? 1.05 : 1.0);
    const shadowScale = 1.0 + depthFactor * 0.3;

    // Compute oriented shadow by rotating the canvas to the creature angle,
    // so the shadow aligns with the creature's rotation.
    ctx.translate(screenX, screenY);
    ctx.rotate(c.angle);

    ctx.fillStyle = `rgba(0,0,0,${cycle.shadowAlpha * 0.6})`;

    if (isEel) {
      // Determine eel length from segmentCount (fallback to size-based estimate)
      const segments = Math.max(1, c.segmentCount || Math.round(size / (tileSize * 0.4)));
      // Base length in pixels: scale with size and segment count
      const totalLen = size * eelLengthBase * (0.9 + 0.25 * segments);
      const halfLen = totalLen * 0.5 * shadowScale;
      // Thin half-width based on size and slimness
      const halfWid = size * eelSlimness * shadowScale;

      // Create a polygonal, straight-edged shadow (an elongated hex-like polygon)
      // Shift applied along shadowDir in rotated space (approx project that into local coords)
      const shiftX = shadowDir.x * offset;
      const shiftY = shadowDir.y * offset;

      // Build polygon points in local coordinates (straight edges, no arcs)
      const poly = [
        { x: -halfLen + shiftX, y: -halfWid + shiftY },
        { x: -halfLen * 0.4 + shiftX, y: -halfWid * 0.65 + shiftY },
        { x: halfLen - shiftX * 0.0 + shiftX, y: -halfWid + shiftY },
        { x: halfLen - shiftX * 0.0 + shiftX, y: halfWid + shiftY },
        { x: -halfLen * 0.4 + shiftX, y: halfWid * 0.65 + shiftY },
        { x: -halfLen + shiftX, y: halfWid + shiftY }
      ];

      ctx.beginPath();
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fill();

    } else {
      // Generic water creature (fish) : rotated diamond-ish shadow elongated along facing axis
      const halfLen = size * 0.7 * shadowScale;
      const halfWid = size * 0.35 * shadowScale;

      const shiftX = shadowDir.x * offset;
      const shiftY = shadowDir.y * offset;

      // Straight-edged diamond polygon (no curves)
      ctx.beginPath();
      ctx.moveTo(-halfLen + shiftX, 0 + shiftY);
      ctx.lineTo(0 + shiftX, -halfWid + shiftY);
      ctx.lineTo(halfLen + shiftX, 0 + shiftY);
      ctx.lineTo(0 + shiftX, halfWid + shiftY);
      ctx.closePath();
      ctx.fill();
    }

    // Restore transform/stack
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  } else {
    // Land/Air/Amphibious shadow
    let baseOffset = tileSize * cycle.shadowLength * 0.5;

    // Birds: Ensure shadow is noticeably separate
    if (c.type === 'bird') {
      baseOffset = tileSize * Math.max(0.9, cycle.shadowLength * 2.0);
    }
    // Crabs: Keep shadow tight
    if (c.type === 'crab') {
      baseOffset = tileSize * cycle.shadowLength * 0.3;
    }

    const shadowX = screenX + shadowDir.x * baseOffset;
    const shadowY = screenY + shadowDir.y * baseOffset;

    ctx.fillStyle = `rgba(0,0,0,${cycle.shadowAlpha * 0.4})`;

    const halfSize = size * 0.5;

    ctx.beginPath();
    // Round shadow for crab
    if (c.type === 'crab') {
       ctx.ellipse(shadowX, shadowY, halfSize, halfSize * 0.7, 0, 0, Math.PI*2);
    } else {
       ctx.moveTo(shadowX - halfSize, shadowY);       
       ctx.lineTo(shadowX, shadowY - halfSize * 0.6); 
       ctx.lineTo(shadowX + halfSize, shadowY);       
       ctx.lineTo(shadowX, shadowY + halfSize * 0.6); 
    }
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();  
}