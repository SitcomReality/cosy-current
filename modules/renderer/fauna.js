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
  const isWaterCreature = (c.def && c.def.type === 'water_strict');

  if (isWaterCreature && noise) {
    const riverInfo = noise.getRiverSystem(c.x, c.y);
    const waterDepth = Math.max(0, Math.min(1, 1.2 - riverInfo.value));
    const creatureDepth = c.depth || 0.3;

    const depthFactor = waterDepth * creatureDepth;
    const baseOffset = tileSize * cycle.shadowLength * 0.8;
    const offset = baseOffset * (0.3 + depthFactor * 0.7);
    const shadowScale = 1.0 + depthFactor * 0.3;

    const shadowX = screenX + shadowDir.x * offset;
    const shadowY = screenY + shadowDir.y * offset;

    ctx.fillStyle = `rgba(0,0,0,${cycle.shadowAlpha * 0.6})`;

    const halfLen = size * 0.7 * shadowScale;
    const halfWid = size * 0.35 * shadowScale;

    ctx.beginPath();
    ctx.moveTo(shadowX - halfLen, shadowY);       
    ctx.lineTo(shadowX, shadowY - halfWid);       
    ctx.lineTo(shadowX + halfLen, shadowY);       
    ctx.lineTo(shadowX, shadowY + halfWid);       
    ctx.closePath();
    ctx.fill();
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

function drawCreature(ctx, c, screenX, screenY, size, cycle) {
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(c.angle);

  if (c.type === 'fish' || c.type === 'eel') {
    drawFish(ctx, c, size);
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