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
    const raftHalfLen = 1.0; // Slightly larger than raft (0.9) to match original shadow size
    const raftHalfWid = 0.6;
    
    // Define perimeter points for the shadow polygon
    // We use enough points to allow the shadow to bend across depth changes
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
    
    // Base shadow offset (deep water behavior)
    // Matches roughly the original linear offset behavior
    const baseOffsetLen = tileSize * cycle.shadowLength; 
    
    ctx.fillStyle = `rgba(0,0,0,${cycle.shadowAlpha})`;
    ctx.beginPath();

    localPoints.forEach((lp, i) => {
      // 1. Transform local point to world space relative to boat center
      const rx = lp.x * cos - lp.y * sin;
      const ry = lp.x * sin + lp.y * cos;
      const wx = p.x + rx;
      const wy = p.y + ry;

      // 2. Sample river depth at expected shadow location
      // We project out to where the shadow WOULD be in deep water to check the terrain there
      const testX = wx + shadowDir.x * (baseOffsetLen / tileSize);
      const testY = wy + shadowDir.y * (baseOffsetLen / tileSize);
      
      const riverInfo = noise.getRiverSystem(testX, testY);
      
      // Calculate depth factor: 0.0 (shallow/bank) to 1.0 (deep center)
      // riverInfo.value is 0 at center, ~1 at bank
      const depthFactor = Math.max(0, Math.min(1, 1.2 - riverInfo.value)); 
    
      // 3. Determine Shadow Scale (Larger in shallow water)
      // "At the edges... shadow should be closer to the boat and a bit larger"
      // We'll map depthFactor so that in very shallow areas the shadow collapses to near-raft footprint.
      let scale;
      if (depthFactor >= 0.6) {
        // deep water: original subtle scaling
        scale = 1.0;
      } else if (depthFactor >= 0.3) {
        // mid-depth: modest expansion
        scale = 1.0 + (0.6 - depthFactor) * 0.4; // up to ~1.12
      } else {
        // very shallow: keep shadow nearly identical to raft footprint with tiny allowance
        // interpolate from slight oversize to near-exact footprint as depthFactor -> 0
        const u = depthFactor / 0.3; // 0..1
        const oversizeAtEdge = 1.08; // small allowance when beached
        scale = 1.0 + (oversizeAtEdge - 1.0) * (1 - u);
      }
      
      // 4. Determine Shadow Offset (Closer in shallow water)
      // Deep water: uses full baseOffsetLen
      // Shallow water: offset shrinks towards almost zero so shadow sits under raft
      let offsetLen;
      if (depthFactor >= 0.6) {
        offsetLen = baseOffsetLen;
      } else if (depthFactor >= 0.3) {
        // smooth interpolation between full offset and small offset
        const u = (depthFactor - 0.3) / 0.3; // 0..1
        offsetLen = baseOffsetLen * (0.15 + 0.85 * u); // never fully zero here
      } else {
        // very shallow: nearly zero offset so shadow aligns with raft
        // keep a tiny non-zero offset so it can still peek out when beached
        offsetLen = baseOffsetLen * 0.06 * (depthFactor / 0.3 + 0.05);
      }

      // 5. Compute Final Screen Coordinates
      // Apply scaling to the local offset from boat center (simulating shadow spread/size)
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
  const lightColor = cycle.raftLightActive ? '#fff' : '#f59e0b';
  const lightGlow = (cycle.raftLightIntensity || 0) * 15;

  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = lightGlow; // small softening while keeping a crisp shape
  ctx.fillStyle = lightColor; // orange light
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