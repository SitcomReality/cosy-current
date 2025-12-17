// Player (raft) drawing helpers, including depth-aware shadow

export function drawPlayer(ctx, state, tileSize, cycle, shadowDir, noise) {
  const p = state.player;
  const centerX = state.width / 2;
  const centerY = state.height / 2;
  const px = (p.x - state.camera.x) * tileSize + centerX;
  const py = (p.y - state.camera.y) * tileSize + centerY;

  // Depth-aware Shadow Rendering
  // Skip player shadow if raft light is active (source is on the raft)
  if (!cycle.raftLightActive && cycle.shadowAlpha > 0.01 && cycle.shadowLength > 0.0001 && noise) {
    drawRaftShadow(ctx, state, tileSize, cycle, shadowDir, noise, px, py);
  } 
  else if (!cycle.raftLightActive && cycle.shadowAlpha > 0.01 && cycle.shadowLength > 0.0001) {
    // Fallback shadow
    ctx.save();
    const shadowLen = cycle.shadowLength;
    ctx.translate(px + shadowDir.x * tileSize * shadowLen, py + shadowDir.y * tileSize * shadowLen);
    ctx.fillStyle = `rgba(0,0,0,${cycle.shadowAlpha})`;
    ctx.rotate(p.angle);
    ctx.fillRect(-tileSize, -tileSize*0.6, tileSize*2, tileSize*1.2);
    ctx.restore();
  }

  // Draw the raft body using shared logic
  drawRaftSprite(ctx, px, py, p.angle, tileSize, state.raft, cycle);
}

// Extracted for re-use in customization preview
export function drawRaftSprite(ctx, x, y, angle, tileSize, config, cycle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const raftLen = tileSize * 1.8;
  const raftWid = tileSize * 1.2;

  // Water trail / foam under raft
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(-raftLen/2 + 2, -raftWid/2 + 2, raftLen, raftWid);

  // Hull
  ctx.fillStyle = config.hullColor || '#92400e';
  
  if (config.hullShape === 'catamaran') {
    // Two pontoons
    const pontoonW = raftWid * 0.3;
    ctx.fillRect(-raftLen/2, -raftWid/2, raftLen, pontoonW);
    ctx.fillRect(-raftLen/2, raftWid/2 - pontoonW, raftLen, pontoonW);
    // Deck
    ctx.fillStyle = '#78350f'; // darker deck
    ctx.fillRect(-raftLen/2 + 4, -raftWid/2 + 4, raftLen - 8, raftWid - 8);
  } else if (config.hullShape === 'barge') {
    // Wide barge with subtle curve suggestion
    ctx.beginPath();
    ctx.moveTo(-raftLen/2, -raftWid/2);
    ctx.lineTo(raftLen/2 - raftLen*0.08, -raftWid/2);
    ctx.lineTo(raftLen/2, 0);
    ctx.lineTo(raftLen/2 - raftLen*0.08, raftWid/2);
    ctx.lineTo(-raftLen/2, raftWid/2);
    ctx.closePath();
    ctx.fill();
  } else {
    // Classic Box
    ctx.fillRect(-raftLen/2, -raftWid/2, raftLen, raftWid);
  }

  // Deck planking detail (only on classic/barge or deck of catamaran)
  ctx.strokeStyle = '#333';
  ctx.globalAlpha = 0.1;
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const lx = -raftLen/2 + (i / 4) * raftLen;
    ctx.beginPath();
    ctx.moveTo(lx, -raftWid/2);
    ctx.lineTo(lx, raftWid/2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // Cabin
  ctx.fillStyle = config.cabinColor || '#fef3c7';
  const cabinW = raftLen * 0.4;
  const cabinH = raftWid * 0.6;
  
  if (config.cabinShape === 'dome') {
    // Dome: full ellipse
    ctx.beginPath();
    ctx.ellipse(0, 0, cabinW/2, cabinH/2, 0, 0, Math.PI*2);
    ctx.fill();
  } else if (config.cabinShape === 'a-frame') {
    // A-Frame: triangular roof peak
    ctx.beginPath();
    ctx.moveTo(-cabinW/2, cabinH/2);
    ctx.lineTo(0, -cabinH/2);
    ctx.lineTo(cabinW/2, cabinH/2);
    ctx.closePath();
    ctx.fill();
  } else {
    // Box: simple rectangle
    ctx.fillRect(-cabinW/2, -cabinH/2, cabinW, cabinH);
  }

  // Roof / Accent Detail
  ctx.fillStyle = config.roofColor || '#0ea5e9';
  if (config.cabinShape === 'dome') {
    // Inner circle detail for dome
    ctx.beginPath();
    ctx.ellipse(0, 0, cabinW/3, cabinH/3, 0, 0, Math.PI*2);
    ctx.fill();
  } else if (config.cabinShape === 'a-frame') {
    // Ridge line detail for a-frame
    ctx.strokeStyle = config.roofColor || '#0ea5e9';
    ctx.lineWidth = Math.max(1, cabinW * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, -cabinH/2);
    ctx.lineTo(0, cabinH/2);
    ctx.stroke();
  } else {
    // Window detail for box
    ctx.fillRect(-cabinW/4, -cabinH/4, cabinW/2, cabinH/3);
  }

  // Light Fixture (respects light type)
  drawLightFixture(ctx, raftLen, cycle, config);

  ctx.restore();
}

function drawLightFixture(ctx, raftLen, cycle, config) {
  const isActive = cycle && cycle.raftLightActive;
  const lightColor = isActive ? '#fff' : (config.lightColor || '#f59e0b');
  const casingColor = config.lightColor || '#f59e0b';
  const lightType = config.lightType || 'cone';
  
  const lx = raftLen/2 - 6;
  const ly = 0;

  if (isActive) {
    ctx.shadowColor = casingColor;
    ctx.shadowBlur = cycle.raftLightIntensity * 15;
  }

  ctx.fillStyle = lightColor;

  if (lightType === 'beam') {
    // Narrow spotlight: elongated triangle
    ctx.beginPath();
    ctx.moveTo(lx + 8, ly);
    ctx.lineTo(lx - 4, ly - 4);
    ctx.lineTo(lx - 4, ly + 4);
    ctx.closePath();
    ctx.fill();
  } else if (lightType === 'radial') {
    // Lantern: small circle with glow
    ctx.beginPath();
    ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Cone (default): forward-facing triangle
    const triH = 6;
    const triW = 6;
    ctx.beginPath();
    ctx.moveTo(lx + triH, ly);
    ctx.lineTo(lx - triH * 0.3, ly - triW);
    ctx.lineTo(lx - triH * 0.3, ly + triW);
    ctx.closePath();
    ctx.fill();
  }

  ctx.shadowBlur = 0;
}

function drawRaftShadow(ctx, state, tileSize, cycle, shadowDir, noise, px, py) {
  const p = state.player;
  const centerX = state.width / 2;
  const centerY = state.height / 2;

  const raftHalfLen = 1.0; 
  const raftHalfWid = 0.6;
  
  const localPoints = [
    {x: -raftHalfLen, y: -raftHalfWid}, 
    {x: 0, y: -raftHalfWid}, 
    {x: raftHalfLen, y: -raftHalfWid},
    {x: raftHalfLen, y: 0}, 
    {x: raftHalfLen, y: raftHalfWid}, 
    {x: 0, y: raftHalfWid}, 
    {x: -raftHalfLen, y: raftHalfWid},
    {x: -raftHalfLen, y: 0}
  ];

  const cos = Math.cos(p.angle);
  const sin = Math.sin(p.angle);
  
  const baseOffsetLen = tileSize * cycle.shadowLength; 
  
  ctx.fillStyle = `rgba(0,0,0,${cycle.shadowAlpha})`;
  ctx.beginPath();

  localPoints.forEach((lp, i) => {
    const rx = lp.x * cos - lp.y * sin;
    const ry = lp.x * sin + lp.y * cos;
    const wx = p.x + rx;
    const wy = p.y + ry;

    const testX = wx + shadowDir.x * (baseOffsetLen / tileSize);
    const testY = wy + shadowDir.y * (baseOffsetLen / tileSize);
    
    const riverInfo = noise.getRiverSystem(testX, testY);
    const depthFactor = Math.max(0, Math.min(1, 1.2 - riverInfo.value)); 
  
    let scale;
    if (depthFactor >= 0.6) {
      scale = 1.0;
    } else if (depthFactor >= 0.3) {
      scale = 1.0 + (0.6 - depthFactor) * 0.4; 
    } else {
      const u = depthFactor / 0.3; 
      const oversizeAtEdge = 1.08; 
      scale = 1.0 + (oversizeAtEdge - 1.0) * (1 - u);
    }
    
    let offsetLen;
    if (depthFactor >= 0.6) {
      offsetLen = baseOffsetLen;
    } else if (depthFactor >= 0.3) {
      const u = (depthFactor - 0.3) / 0.3; 
      offsetLen = baseOffsetLen * (0.15 + 0.85 * u); 
    } else {
      offsetLen = baseOffsetLen * 0.06 * (depthFactor / 0.3 + 0.05);
    }

    const sx = (wx - state.camera.x) * tileSize + centerX + (rx * tileSize * (scale - 1.0));
    const sy = (wy - state.camera.y) * tileSize + centerY + (ry * tileSize * (scale - 1.0));
    
    const finalX = sx + shadowDir.x * offsetLen;
    const finalY = sy + shadowDir.y * offsetLen;

    if (i === 0) ctx.moveTo(finalX, finalY);
    else ctx.lineTo(finalX, finalY);
  });

  ctx.closePath();
  ctx.fill();
}