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
    // ... existing complex terrained shadow code unchanged ...
  } 
  // Fallback for when noise isn't ready or shadow is off (though we usually want to skip drawing)
  else if (!cycle.raftLightActive && cycle.shadowAlpha > 0.01 && cycle.shadowLength > 0.0001) {
    // Legacy simple shadow
    ctx.save();
    const shadowLen = cycle.shadowLength;
    ctx.translate(px + shadowDir.x * tileSize * shadowLen, py + shadowDir.y * tileSize * shadowLen);
    ctx.fillStyle = `rgba(0,0,0,${cycle.shadowAlpha})`;
    ctx.rotate(p.angle);
    ctx.fillRect(-tileSize, -tileSize*0.6, tileSize*2, tileSize*1.2);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(px, py);

  ctx.rotate(p.angle);
  const raftLen = tileSize * 1.8;
  const raftWid = tileSize * 1.2;

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(-raftLen/2 + 2, -raftWid/2 + 2, raftLen, raftWid);

  ctx.fillStyle = '#92400e';
  ctx.fillRect(-raftLen/2, -raftWid/2, raftLen, raftWid);

  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const x = -raftLen/2 + (i / 4) * raftLen;
    ctx.beginPath();
    ctx.moveTo(x, -raftWid/2);
    ctx.lineTo(x, raftWid/2);
    ctx.stroke();
  }

  ctx.fillStyle = '#fef3c7';
  const cabinW = raftLen * 0.4;
  const cabinH = raftWid * 0.6;
  ctx.fillRect(-cabinW/2, -cabinH/2, cabinW, cabinH);

  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(-cabinW/4, -cabinH/4, cabinW/2, cabinH/3);

  // Rigid triangular light cap at the front of the raft (replaces round light)
  // Use an orange/yellow tone for the light to match the low-poly palette

  // If light is active, make the lamp look brighter/lit
  // Use raftLightFactor (0..1) for smooth fade-in/out
  const factor = cycle.raftLightFactor || 0;
  const lightColor = factor > 0.02 ? '#fff' : '#f59e0b';
  const baseGlow = cycle.raftLightActive ? 15 : 6;
  const lightGlow = baseGlow * Math.max(0.2, factor); // scale glow with factor

  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = lightGlow; // small softening while keeping a crisp shape
  ctx.fillStyle = lightColor; // orange light when off, white when fully on
  ctx.beginPath();
  const lx = raftLen/2 - 6;
  const ly = 0;
  const triH = 6; // triangle height in pixels
  const triW = 6; // triangle half-width in pixels
  // Triangle points (pointing forward)
  ctx.moveTo(lx + triH, ly);             // tip
  ctx.lineTo(lx - triH * 0.3, ly - triW); // back-top
  ctx.lineTo(lx - triH * 0.3, ly + triW); // back-bottom
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}