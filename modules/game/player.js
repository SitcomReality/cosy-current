import { INTERACTION_RADIUS } from './constants.js';

// Short helper: shortest signed angle diff
function shortestAngleDiff(a, b) {
  let diff = b - a;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return diff;
}

export function createPlayerModule(state, noise, heightModule, riverModule, entitiesModule) {
  function update(dt) {
    if (!state.isPlaying) return;

    const p = state.player;
    const river = noise.getRiverSystem(p.x, p.y);

    if (p.targetAngle === undefined || Number.isNaN(p.targetAngle)) {
      p.targetAngle = p.angle;
    }

    // Anticipatory intersection detection & flow-locking
    if (!p.flowLockActive && river.isRiver) {
      const lookaheadDistances = [2.0, 4.0, 8.0];
      for (let d of lookaheadDistances) {
        const probeX = p.x + Math.cos(p.angle) * d;
        const probeY = p.y + Math.sin(p.angle) * d;
        const probeInfo = noise.getRiverSystem(probeX, probeY);
        if (probeInfo.isIntersection) {
          const chosenAngle = riverModule.getRiverVector(noise, probeX, probeY, p.angle);
          p.flowLockActive = true;
          p.flowLockAngle = chosenAngle;
          p.flowLockTimer = 3.5;
          break;
        }
      }
    }

    if (p.flowLockActive) {
      p.flowLockTimer -= dt;
      if (p.flowLockTimer <= 0 || !river.isRiver) {
        p.flowLockActive = false;
        p.flowLockTimer = 0;
      }
    }

    let targetAngle = p.targetAngle;

    if (river.isRiver) {
      if (river.isIntersection) {
        let desired = p.flowLockActive ? p.flowLockAngle : riverModule.getRiverVector(noise, p.x, p.y, p.angle);
        const diff = shortestAngleDiff(targetAngle, desired);
        targetAngle = targetAngle + diff * Math.min(1, 4.5 * dt);
      } else {
        let desired = p.flowLockActive ? p.flowLockAngle : riverModule.getRiverVector(noise, p.x, p.y, p.angle);
        const diff = shortestAngleDiff(targetAngle, desired);
        targetAngle = targetAngle + diff * Math.min(1, 3 * dt);
      }

      p.targetAngle = targetAngle;

      const angleDiff = shortestAngleDiff(p.angle, p.targetAngle);
      const maxTurnRate = 2.0;
      const maxStep = maxTurnRate * dt;
      const clamped = Math.max(-maxStep, Math.min(maxStep, angleDiff));
      p.angle += clamped;

      const accel = 5 * (state.speedMultiplier || 1);
      if (p.speed < p.targetSpeed) p.speed += dt * accel;
    } else {
      p.speed = Math.max(0.5, p.speed - dt * 2);
    }

    const effectiveSpeed = p.speed * (state.speedMultiplier || 1);
    p.x += Math.cos(p.angle) * effectiveSpeed * dt;
    p.y += Math.sin(p.angle) * effectiveSpeed * dt;

    // Resources
    const tileType = heightModule.getTile(p.x, p.y);
    const collectionRate = 1.0 * dt;
    if (tileType === undefined) {} // defensive
    if (tileType === 4) state.resources.bio += collectionRate * 2;
    else if (tileType === 3) state.resources.bio += collectionRate;

    state.resources.fuel -= dt * 0.1;
    if (state.resources.fuel < 0) state.resources.fuel = 0;

    // Entities interactions
    entitiesModule.maintainEntities(heightModule.getHeight, p);

    state.entities.forEach(e => {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < INTERACTION_RADIUS) {
        if (e.type === 'city') {
          if (state.resources.bio > 5) {
            state.resources.bio -= dt * 10;
            state.resources.fuel += dt * 5;
            state.resources.scrap += dt * 1;
          }
        } else if (e.type === 'relic') {
          state.resources.scrap += dt * 5;
        }
      }
    });
  }

  return { update };
}