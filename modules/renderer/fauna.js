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

// New: dedicated bird rendering pass so birds appear in front of the raft
export function renderBirds(ctx, state, tileSize, creatures, cycle, shadowDir, noise) {
  if (!creatures || creatures.length === 0) return;

  const centerX = state.width / 2;
  const centerY = state.height / 2;

  creatures.forEach(c => {
    if (c.type !== 'bird') return;

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

function drawCreatureShadow(ctx, state, tileSize, c, screenX, screenY, size, cycle, shadowDir, noise) {
  ctx.save();  

  if (c.habitat === 'water' && noise) {
    // Depth-aware underwater shadow (low-poly polygon)
    const riverInfo = noise.getRiverSystem(c.x, c.y);
    const waterDepth = Math.max(0, Math.min(1, 1.2 - riverInfo.value));

    // Creature depth in water (0 = surface, 1 = bottom)
    const creatureDepth = c.depth || 0.3;

    // Shadow offset increases with both water depth and creature depth
    const depthFactor = waterDepth * creatureDepth;
    const baseOffset = tileSize * cycle.shadowLength * 0.8;
    const offset = baseOffset * (0.3 + depthFactor * 0.7);

    // Shadow size increases slightly in deeper water
    const shadowScale = 1.0 + depthFactor * 0.3;

    const shadowX = screenX + shadowDir.x * offset;
    const shadowY = screenY + shadowDir.y * offset;

    ctx.fillStyle = `rgba(0,0,0,${cycle.shadowAlpha * 0.6})`;

    // Diamond-like polygon shadow to stay low-poly
    const halfLen = size * 0.7 * shadowScale;
    const halfWid = size * 0.35 * shadowScale;

    ctx.beginPath();
    ctx.moveTo(shadowX - halfLen, shadowY);        // left
    ctx.lineTo(shadowX, shadowY - halfWid);        // top
    ctx.lineTo(shadowX + halfLen, shadowY);        // right
    ctx.lineTo(shadowX, shadowY + halfWid);        // bottom
    ctx.closePath();
    ctx.fill();
  } else {
    // Land / air creature shadow (low-poly polygon)
    let baseOffset = tileSize * cycle.shadowLength * 0.5;

    // Birds: push shadows further and consistently farther away from the birds,
    // removing the previous time-of-day bias so shadows remain apparent all day.
    if (c.type === 'bird') {
      // Make shadows noticeably further: scale up and ensure a reasonable minimum distance.
      baseOffset = tileSize * Math.max(0.9, cycle.shadowLength * 2.0);
    }

    const shadowX = screenX + shadowDir.x * baseOffset;
    const shadowY = screenY + shadowDir.y * baseOffset;

    ctx.fillStyle = `rgba(0,0,0,${cycle.shadowAlpha * 0.4})`;

    const halfSize = size * 0.5;

    ctx.beginPath();
    ctx.moveTo(shadowX - halfSize, shadowY);       // left
    ctx.lineTo(shadowX, shadowY - halfSize * 0.6); // top
    ctx.lineTo(shadowX + halfSize, shadowY);       // right
    ctx.lineTo(shadowX, shadowY + halfSize * 0.6); // bottom
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();  
}

function drawCreature(ctx, c, screenX, screenY, size, cycle) {
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(c.angle);

  // Different shapes for different types
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
  }

  ctx.restore();
}

function drawFish(ctx, c, size) {
  const len = size * 1.2;
  const width = size * 0.5;

  ctx.fillStyle = c.color;

  // Body (triangle)
  ctx.beginPath();
  ctx.moveTo(len * 0.5, 0);
  ctx.lineTo(-len * 0.5, -width * 0.5);
  ctx.lineTo(-len * 0.5, width * 0.5);
  ctx.closePath();
  ctx.fill();

  // Tail (smaller triangle)
  ctx.beginPath();
  ctx.moveTo(-len * 0.5, 0);
  ctx.lineTo(-len * 0.8, -width * 0.4);
  ctx.lineTo(-len * 0.8, width * 0.4);
  ctx.closePath();
  ctx.fill();
}

function drawBird(ctx, c, size, cycle) {
  // Flapping animation
  const flapPhase = Math.sin(c.life * 8);
  const wingSpan = size * 1.5;
  const wingY = size * 0.3 * flapPhase;

  ctx.strokeStyle = c.color;
  ctx.lineWidth = Math.max(1, size * 0.15);
  ctx.lineCap = 'round';

  // Wings (V shape)
  ctx.beginPath();
  ctx.moveTo(-wingSpan * 0.5, wingY);
  ctx.lineTo(0, 0);
  ctx.lineTo(wingSpan * 0.5, wingY);
  ctx.stroke();

  // Body dot
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawDeer(ctx, c, size) {
  ctx.fillStyle = c.color;

  // Body (quadrilateral)
  ctx.beginPath();
  ctx.moveTo(size * 0.4, -size * 0.3);
  ctx.lineTo(size * 0.4, size * 0.3);
  ctx.lineTo(-size * 0.5, size * 0.4);
  ctx.lineTo(-size * 0.5, -size * 0.4);
  ctx.closePath();
  ctx.fill();

  // Head (small triangle)
  ctx.beginPath();
  ctx.moveTo(size * 0.4, -size * 0.1);
  ctx.lineTo(size * 0.7, -size * 0.2);
  ctx.lineTo(size * 0.4, size * 0.1);
  ctx.closePath();
  ctx.fill();

  // Antlers (two lines)
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
  // Small scurrying creature (simple triangle)
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, 0);
  ctx.lineTo(-size * 0.3, -size * 0.4);
  ctx.lineTo(-size * 0.3, size * 0.4);
  ctx.closePath();
  ctx.fill();

  // Tail
  ctx.strokeStyle = c.color;
  ctx.lineWidth = Math.max(1, size * 0.1);
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, 0);
  ctx.lineTo(-size * 0.6, size * 0.2);
  ctx.stroke();
}

function drawFirefly(ctx, c, size) {
  // Glow pulse
  const glowIntensity = 0.5 + 0.5 * Math.sin(c.life * 3 + c.id.charCodeAt(0));

  // Glow
  ctx.shadowColor = c.color;
  ctx.shadowBlur = size * 4 * glowIntensity;
  ctx.fillStyle = c.color;
  ctx.globalAlpha = 0.8;

  // Body (tiny triangle)
  ctx.beginPath();
  ctx.moveTo(size * 0.3, 0);
  ctx.lineTo(-size * 0.2, -size * 0.2);
  ctx.lineTo(-size * 0.2, size * 0.2);
  ctx.closePath();
  ctx.fill();

  // Bright center
  ctx.shadowBlur = size * 6 * glowIntensity;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}