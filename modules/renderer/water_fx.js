export function createWaterFX() {
  const wakes = []; 
  let spawnTimer = 0;

  function spawnWake(x, y, angle, speed) {
    wakes.push({
      x, y, angle, speed,
      age: 0,
      life: 2.5,
      id: Math.random()
    });
  }

  function update(dt, player) {
    // Spawn logic
    spawnTimer += dt;
    if (spawnTimer > 0.15 && player.speed > 0.5) {
      spawnWake(player.x, player.y, player.angle, player.speed);
      spawnTimer = 0;
    }

    // Update logic
    for (let i = wakes.length - 1; i >= 0; i--) {
      wakes[i].age += dt;
      if (wakes[i].age >= wakes[i].life) {
        wakes.splice(i, 1);
      }
    }
  }

  function render(ctx, camera, tileSize, centerX, centerY) {
    if (wakes.length === 0) return;

    ctx.save(); 
    ctx.lineCap = 'butt'; 

    wakes.forEach(w => {
      const progress = w.age / w.life;
      const alpha = Math.max(0, (1.0 - progress) * 0.6);

      const wx = w.x;
      const wy = w.y;

      const sx = (wx - camera.x) * tileSize + centerX;
      const sy = (wy - camera.y) * tileSize + centerY;

      // Wake expansion
      const dist = (0.6 + progress * 1.2) * tileSize;
      const spread = 0.5; // Angle off-center

      // Stern position (slightly behind player)
      const sternOffset = tileSize * 0.4;
      const ox = sx - Math.cos(w.angle) * sternOffset;
      const oy = sy - Math.sin(w.angle) * sternOffset;

      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(w.angle - spread) * dist, oy + Math.sin(w.angle - spread) * dist);
      ctx.lineTo(ox + Math.cos(w.angle + spread) * dist, oy + Math.sin(w.angle + spread) * dist);
      ctx.lineTo(ox, oy);
      ctx.stroke();
    });

    ctx.restore();
  }

  return { spawnWake, update, render };
}