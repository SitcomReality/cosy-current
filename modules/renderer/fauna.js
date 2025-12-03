// Fauna rendering with depth-aware shadows
export function renderFauna(ctx, state, tileSize, creatures, cycle, shadowDir, noise) {
  if (!creatures || creatures.length === 0) return;

  const centerX = state.width / 2;
  const centerY = state.height / 2;

  creatures.forEach(c => {
    // Skip birds in this pass; they'll be rendered in front of the player
    if (c.type === 'bird') return;

    const screenX = (c.x - state.camera.x) * tileSize + centerX;
    const screenY = (c.y - state.camera.y) * tileSize + centerY;

    // Cull off-screen
    if (screenX < -tileSize * 5 || screenX > state.width + tileSize * 5 ||
        screenY < -tileSize * 5 || screenY > state.height + tileSize * 5) return;

    const size = c.size * tileSize;

    // Draw shadow first
    if (cycle.shadowAlpha > 0.01 && cycle.shadowLength > 0.001) {
      drawCreatureShadow(ctx, state, tileSize, c, screenX, screenY, size, cycle, shadowDir, noise);
    }

    // Draw creature
    drawCreature(ctx, c, screenX, screenY, size, cycle);
  });
}

// Dedicated bird rendering pass
export function renderBirds(ctx, state, tileSize, creatures, cycle, shadowDir, noise) {
  if (!creatures || creatures.length === 0) return;

  const centerX = state.width / 2;
  const centerY = state.height / 2;

  creatures.forEach(c => {
    if (c.type !== 'bird') return;

    const screenX = (c.x - state.camera.x) * tileSize + centerX;
    const screenY = (c.y - state.camera.y) * tileSize + centerY;

    if (screenX < -tileSize * 5 || screenX > state.width + tileSize * 5 ||
        screenY < -tileSize * 5 || screenY > state.height + tileSize * 5) return;

    const size = c.size * tileSize;

    if (cycle.shadowAlpha > 0.01 && cycle.shadowLength > 0.001) {
      drawCreatureShadow(ctx, state, tileSize, c, screenX, screenY, size, cycle, shadowDir, noise);
    }
    drawCreature(ctx, c, screenX, screenY, size, cycle);
  });
}

function drawCreatureShadow(ctx, state, tileSize, c, screenX, screenY, size, cycle, shadowDir, noise) {
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
    // Eels should cast a longer, sleeker shadow
    const eelLengthMul = isEel ? 1.9 : 1.0;
    // Make eel shadow noticeably slimmer
    const eelSlimness = isEel ? 0.28 : 0.7;

    // Offset scales with depthFactor so deeper gives a more separated shadow
    const offset = baseOffset * (0.3 + depthFactor * 0.7) * (isEel ? 1.1 : 1.0);
    const shadowScale = 1.0 + depthFactor * 0.3;

    // Compute oriented shadow by rotating the canvas to the creature angle,
    // so the shadow aligns with the creature's rotation.
    ctx.translate(screenX, screenY);
    ctx.rotate(c.angle);

    ctx.fillStyle = `rgba(0,0,0,${cycle.shadowAlpha * 0.6})`;

    // For eel: draw a single elongated capsule (rounded rectangle) along the creature's forward axis
    if (isEel) {
      const totalLen = size * 0.7 * eelLengthMul * shadowScale; // length in pixels (reduced)
      const halfLen = totalLen * 0.5;
      const halfWid = size * eelSlimness * shadowScale;

      // Shift shadow away from creature along shadowDir (apply in rotated space)
      const shiftX = shadowDir.x * offset;
      const shiftY = shadowDir.y * offset;

      // Single thin capsule path (rounded rectangle)
      ctx.beginPath();
      // Left semicircle
      ctx.arc(-halfLen + shiftX, shiftY, halfWid, Math.PI / 2, Math.PI * 3 / 2);
      // Top edge
      ctx.lineTo(halfLen + shiftX, shiftY - halfWid);
      // Right semicircle
      ctx.arc(halfLen + shiftX, shiftY, halfWid, Math.PI * 3 / 2, Math.PI / 2);
      // Bottom edge back to start
      ctx.lineTo(-halfLen + shiftX, shiftY + halfWid);
      ctx.closePath();
      ctx.fill();

      // Do not draw additional darker core ellipse — keep single clean shadow
    } else {
      // Generic water creature (fish) : rotated diamond-ish shadow elongated along facing axis
      const halfLen = size * 0.7 * shadowScale;
      const halfWid = size * 0.35 * shadowScale;

      const shiftX = shadowDir.x * offset;
      const shiftY = shadowDir.y * offset;

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
    // Land/Air/Amphibious shadow (unchanged behavior)
    // Preserve previous non-water shadow logic
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

function drawCreature(ctx, c, screenX, screenY, size, cycle) {
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(c.angle);

  if (c.type === 'fish') {
    drawFish(ctx, c, size);
  } else if (c.type === 'eel') {
    drawEel(ctx, c, size);
  } else if (c.type === 'bird') {
    drawBird(ctx, c, size, cycle);
  } else if (c.type === 'deer') {
    drawDeer(ctx, c, size);
  } else if (c.type === 'critter') {
    drawCritter(ctx, c, size);
  } else if (c.type === 'firefly') {
    drawFirefly(ctx, c, size);
  } else if (c.type === 'crab') {
    drawCrab(ctx, c, size);
  }

  ctx.restore();
}

function drawCrab(ctx, c, size) {
  const colors = c.segmentColors || [c.color, c.color];
  const w = size * 0.8;
  const h = size * 0.6;
  
  // Legs (zigzag lines)
  ctx.strokeStyle = c.color; // Use base color for legs
  ctx.lineWidth = size * 0.15;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Draw 3 legs per side
  for(let side of [-1, 1]) {
    for(let i=0; i<3; i++) {
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
  
  for(let i=0; i<segCount; i++) {
    const col = colors[i];
    const yOff = (i - (segCount-1)/2) * segStep * 0.8;
    const segScale = 1.0 - (i * 0.15); // Front segments slightly smaller? Or back smaller? Let's make back smaller.
    // Actually standard crab is wide carapace. Let's stack them.
    
    ctx.fillStyle = col;
    ctx.beginPath();
    
    // Draw a sharp angled polygon
    const sw = w * (0.8 - i * 0.1); 
    const sh = segStep * 1.2;
    
    // Local coords relative to center
    // Back segment drawn first (i=0)
    // Shift position forward? 
    // Let's just draw distinct overlapping shapes.
    
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
  ctx.arc(-w*0.3, -h*0.6, size*0.1, 0, Math.PI*2);
  ctx.arc(w*0.3, -h*0.6, size*0.1, 0, Math.PI*2);
  ctx.fill();
}

function drawFish(ctx, c, size) {
  const len = size * 1.2;
  const width = size * 0.5;

  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.moveTo(len * 0.5, 0);
  ctx.lineTo(-len * 0.5, -width * 0.5);
  ctx.lineTo(-len * 0.5, width * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-len * 0.5, 0);
  ctx.lineTo(-len * 0.8, -width * 0.4);
  ctx.lineTo(-len * 0.8, width * 0.4);
  ctx.closePath();
  ctx.fill();
}

function drawEel(ctx, c, size) {
  const segments = c.segmentCount || 4;
  const totalLen = size * 2.0;
  const segLen = totalLen / Math.max(1, segments);
  // Reduced thickness to make eels sleeker
  const baseThickness = size * 0.16;

  // Build smooth spine points with per-segment sinusoidal offsets.
  // The head is at +half totalLen, tail at -half totalLen in local coords.
  const points = [];
  const speedFactor = 3.8; // how fast the wave travels
  const time = c.life * speedFactor;
  const phaseOffset = 0.7; // phase difference between segments
  const waveAmp = baseThickness * 2.2; // base amplitude
  for (let i = 0; i < segments; i++) {
    const t = i / Math.max(1, segments - 1); // 0..1 along body
    const x = -totalLen * 0.5 + segLen * (i + 0.5);
    // Attenuate amplitude towards head so head is steadier and tail more wavy
    const attenuation = 0.25 + 0.75 * (1 - t);
    const phase = time + i * phaseOffset;
    // Subtle, smooth offset along Y
    const y = Math.sin(phase) * waveAmp * attenuation;
    points.push({ x, y, t });
  }

  // To make body follow a smooth curve, interpolate additional intermediate points.
  const smoothPts = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    // push p0
    smoothPts.push(p0);
    // insert one mid-point for smoothing
    smoothPts.push({
      x: (p0.x + p1.x) * 0.5,
      y: (p0.y + p1.y) * 0.5,
      t: (p0.t + p1.t) * 0.5
    });
  }
  smoothPts.push(points[points.length - 1]);

  // Build polygonal straight-edged mesh from the spine by computing normals and placing
  // left/right vertices per spine point, then connecting them with straight lines.
  const leftVerts = [];
  const rightVerts = [];

  for (let i = 0; i < smoothPts.length; i++) {
    const p = smoothPts[i];
    // Compute tangent by difference to next point (or previous for last)
    const next = smoothPts[Math.min(i + 1, smoothPts.length - 1)];
    const prev = smoothPts[Math.max(i - 1, 0)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    // Perpendicular (normal) vector
    let nx = -dy;
    let ny = dx;
    const lenN = Math.hypot(nx, ny) || 1;
    nx /= lenN;
    ny /= lenN;

    // Taper thickness from head (thinner) to mid-body then tail
    const thickness = baseThickness * (1.1 + 0.8 * (1 - p.t));

    // Straight offsets for left and right vertices
    leftVerts.push({ x: p.x + nx * thickness, y: p.y + ny * thickness });
    rightVerts.push({ x: p.x - nx * thickness, y: p.y - ny * thickness });
  }

  // Compose polygon vertices: left side from head->tail then right side tail->head to close
  const poly = [];
  for (let i = 0; i < leftVerts.length; i++) poly.push(leftVerts[i]);
  for (let i = rightVerts.length - 1; i >= 0; i--) poly.push(rightVerts[i]);

  // Draw the straight-edged eel body polygon
  ctx.save();
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';

  // Outline (slightly darker)
  ctx.beginPath();
  for (let i = 0; i < poly.length; i++) {
    const v = poly[i];
    if (i === 0) ctx.moveTo(v.x, v.y);
    else ctx.lineTo(v.x, v.y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fill();

  // Fill with main color (sharp edges preserved)
  ctx.beginPath();
  for (let i = 0; i < poly.length; i++) {
    const v = poly[i];
    if (i === 0) ctx.moveTo(v.x, v.y);
    else ctx.lineTo(v.x, v.y);
  }
  ctx.closePath();
  ctx.fillStyle = c.color;
  ctx.fill();

  // Head: draw a straight triangular head cap at the forward-most spine point
  if (smoothPts.length >= 2) {
    const tailIdx = smoothPts.length - 1;
    const headPt = smoothPts[tailIdx];
    const prevPt = smoothPts[tailIdx - 1];
    const dx = headPt.x - prevPt.x;
    const dy = headPt.y - prevPt.y;
    const ang = Math.atan2(dy, dx);

    // Triangle pointed forward
    const headLen = segLen * 0.6;
    const headWid = baseThickness * 2.2;
    // Compute three triangle points in local coords relative to headPt
    const hx1 = headPt.x;
    const hy1 = headPt.y;
    const hx2 = headPt.x - Math.cos(ang) * headLen + Math.sin(ang) * headWid * 0.5;
    const hy2 = headPt.y - Math.sin(ang) * headLen - Math.cos(ang) * headWid * 0.5;
    const hx3 = headPt.x - Math.cos(ang) * headLen - Math.sin(ang) * headWid * 0.5;
    const hy3 = headPt.y - Math.sin(ang) * headLen + Math.cos(ang) * headWid * 0.5;

    ctx.beginPath();
    ctx.moveTo(hx1, hy1);
    ctx.lineTo(hx2, hy2);
    ctx.lineTo(hx3, hy3);
    ctx.closePath();
    ctx.fillStyle = c.color;
    ctx.fill();

    // small eye as a sharp dot (kept small and geometric)
    const eyeX = headPt.x - Math.cos(ang) * (headLen * 0.25) + Math.sin(ang) * (headWid * 0.12);
    const eyeY = headPt.y - Math.sin(ang) * (headLen * 0.25) - Math.cos(ang) * (headWid * 0.12);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(eyeX - 1, eyeY - 1, 2, 2);
  }

  // Tail tip: straight triangular cap at the tail-most point
  if (smoothPts.length >= 2) {
    const tailPt = smoothPts[0];
    const nextPt = smoothPts[1];
    const dx = tailPt.x - nextPt.x;
    const dy = tailPt.y - nextPt.y;
    const ang = Math.atan2(dy, dx);

    const tailLen = segLen * 0.5;
    const tailWid = baseThickness * 1.8;

    const tx1 = tailPt.x;
    const ty1 = tailPt.y;
    const tx2 = tailPt.x + Math.cos(ang) * tailLen + Math.sin(ang) * tailWid * 0.5;
    const ty2 = tailPt.y + Math.sin(ang) * tailLen - Math.cos(ang) * tailWid * 0.5;
    const tx3 = tailPt.x + Math.cos(ang) * tailLen - Math.sin(ang) * tailWid * 0.5;
    const ty3 = tailPt.y + Math.sin(ang) * tailLen + Math.cos(ang) * tailWid * 0.5;

    ctx.beginPath();
    ctx.moveTo(tx1, ty1);
    ctx.lineTo(tx2, ty2);
    ctx.lineTo(tx3, ty3);
    ctx.closePath();
    ctx.fillStyle = c.color;
    ctx.fill();
  }

  ctx.restore();
}

function drawBird(ctx, c, size, cycle) {
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

  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawDeer(ctx, c, size) {
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.moveTo(size * 0.4, -size * 0.3);
  ctx.lineTo(size * 0.4, size * 0.3);
  ctx.lineTo(-size * 0.5, size * 0.4);
  ctx.lineTo(-size * 0.5, -size * 0.4);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(size * 0.4, -size * 0.1);
  ctx.lineTo(size * 0.7, -size * 0.2);
  ctx.lineTo(size * 0.4, size * 0.1);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = c.color;
  ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.beginPath();
  ctx.moveTo(size * 0.6, -size * 0.2);
  ctx.lineTo(size * 0.75, -size * 0.5);
  ctx.moveTo(size * 0.65, -size * 0.2);
  ctx.lineTo(size * 0.85, -size * 0.45);
  ctx.stroke();
}

function drawCritter(ctx, c, size) {
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

function drawFirefly(ctx, c, size) {
  const glowIntensity = 0.5 + 0.5 * Math.sin(c.life * 3 + c.id.charCodeAt(0));
  ctx.shadowColor = c.color;
  ctx.shadowBlur = size * 4 * glowIntensity;
  ctx.fillStyle = c.color;
  ctx.globalAlpha = 0.8;

  ctx.beginPath();
  ctx.moveTo(size * 0.3, 0);
  ctx.lineTo(-size * 0.2, -size * 0.2);
  ctx.lineTo(-size * 0.2, size * 0.2);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = size * 6 * glowIntensity;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}