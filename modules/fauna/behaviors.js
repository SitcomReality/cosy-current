import { normalizeAngle, shortestAngleDiff } from './utils.js';

export function updateCreatureBehavior(c, dt, noise, game) {
  // Update timers
  c.life += dt;
  c.wanderTimer -= dt;
  if (c.wanderTimer < 0) c.wanderTimer = 0;

  // 1. Determine Target Angle based on behavior
  const behavior = c.def.behavior || 'wander';

  if (behavior === 'flow_follow') {
    applyFlowFollow(c, dt, noise);
  } else if (behavior === 'fly_straight') {
    applyFlyStraight(c, dt);
  } else if (behavior === 'scuttle') {
    applyScuttle(c, dt);
  } else {
    // Default wander
    applyWander(c, dt);
  }

  // 2. Boundary Enforcement (Bounce/Steer away from forbidden terrain)
  enforceBoundaries(c, dt, noise, game);

  // 3. Physics (Turn & Move)
  // Scuttle has special movement handling (stop and go)
  if (behavior === 'scuttle' && c.isStopped) {
    // Don't move
  } else {
    const turnSpeed = c.turnRate * dt;
    const angleDiff = shortestAngleDiff(c.angle, c.targetAngle);
    const turn = Math.max(-turnSpeed, Math.min(turnSpeed, angleDiff));
    c.angle = normalizeAngle(c.angle + turn);

    const speed = c.speed * (c.speedMult || 1.0);
    c.x += Math.cos(c.angle) * speed * dt;
    c.y += Math.sin(c.angle) * speed * dt;
  }
}

function applyWander(c, dt) {
  if (c.wanderTimer <= 0) {
    c.wanderTimer = 1.0 + Math.random() * 2.0;
    const delta = (Math.random() - 0.5) * (Math.PI / 1.5);
    c.targetAngle = normalizeAngle(c.targetAngle + delta);
  }
}

function applyScuttle(c, dt) {
  // Crabs pause frequently
  if (c.wanderTimer <= 0) {
    if (c.isStopped) {
      // Start moving
      c.isStopped = false;
      c.wanderTimer = 0.5 + Math.random() * 1.5;
      // Pick new direction
      const delta = (Math.random() - 0.5) * (Math.PI);
      c.targetAngle = normalizeAngle(c.targetAngle + delta);
    } else {
      // Stop
      c.isStopped = true;
      c.wanderTimer = 0.5 + Math.random() * 1.0;
    }
  }
}

function applyFlyStraight(c, dt) {
  // Birds pick a distant point and stick to it mostly
  if (c.wanderTimer <= 0) {
    c.wanderTimer = 3.0 + Math.random() * 2.0;
    // Slight course correction
    const delta = (Math.random() - 0.5) * 0.2;
    c.targetAngle = normalizeAngle(c.targetAngle + delta);
  }
}

function applyFlowFollow(c, dt, noise) {
  // Fish align with river flow
  // River gradient (gx, gy) points to bank. Flow is perpendicular.
  const r = noise.getRiverSystem(c.x, c.y);

  if (c.wanderTimer <= 0) {
    c.wanderTimer = 0.5;

    // Calculate flow vector (tangent to gradient)
    // We arbitrarily pick one winding direction (-gy, gx)
    const flowAngle = Math.atan2(r.gx, -r.gy); // Rotate 90 deg

    // Mix flow angle with some wander
    const wander = (Math.random() - 0.5) * 1.0;

    // If we are facing roughly against flow, should we turn around?
    // Let's just steer towards flow.
    c.targetAngle = normalizeAngle(flowAngle + wander);

    // Avoid shallow water actively
    if (r.value > 0.6) {
      // Steer towards deep (0 value), which is opposite to gradient (gx, gy)
      const deepAngle = Math.atan2(-r.gy, -r.gx);
      // Blend it in
      c.targetAngle = normalizeAngle(deepAngle);
    }
  }
}

// New helper: search in expanding rings for nearest tile satisfying predicate
function findNearestValidDirection(x, y, game, noise, predicate, maxRadius = 20, step = 1) {
  // sample at integer tile offsets in rings
  for (let r = 1; r <= maxRadius; r += step) {
    const samples = Math.max(12, Math.floor(6 * r));
    for (let i = 0; i < samples; i++) {
      const a = (i / samples) * Math.PI * 2;
      const sx = x + Math.cos(a) * r;
      const sy = y + Math.sin(a) * r;
      const tx = Math.floor(sx);
      const ty = Math.floor(sy);
      const tile = game.getTile(tx, ty);
      if (tile === undefined) continue;
      if (predicate({ x: sx, y: sy, tile })) {
        return { angle: Math.atan2(sy - y, sx - x), dist: r, foundX: sx, foundY: sy };
      }
    }
  }
  return null;
}

function enforceBoundaries(c, dt, noise, game) {
  const lookAhead = 1.0;
  const nx = c.x + Math.cos(c.angle) * lookAhead;
  const ny = c.y + Math.sin(c.angle) * lookAhead;

  const river = noise.getRiverSystem(nx, ny);
  const isWater = river.value < 1.0;

  const pool = c.def.pool;

  if (pool === 'water') {
    // If creature is not in water currently, actively find nearest water and steer there
    const currentRiver = noise.getRiverSystem(c.x, c.y);
    const currentlyWater = currentRiver.value < 1.0;

    if (!currentlyWater) {
      // Find nearest water tile (prefer deeper bands)
      const best = findNearestValidDirection(c.x, c.y, game, noise, ({ x, y }) => {
        const r = noise.getRiverSystem(x, y);
        return r.value < 1.0;
      }, 30, 1);

      if (best) {
        // Head towards found water, reduce speed so we don't overshoot
        c.targetAngle = normalizeAngle(best.angle);
        c.speedMult = 0.6; // slow while returning
      } else {
        // fallback: use gradient if available
        c.targetAngle = normalizeAngle(Math.atan2(-river.gy, -river.gx));
        c.speedMult = 0.6;
      }
    } else {
      // Normal water steering; ensure speedMult resets
      c.speedMult = 1.0;
      // Additionally if immediate lookAhead is land, nudge target towards water
      if (!isWater) {
        c.targetAngle = normalizeAngle(Math.atan2(-river.gy, -river.gx));
      }
    }

  } else if (pool === 'land') {
    // If land creature is in water, steer toward nearest land tile
    const currentRiver = noise.getRiverSystem(c.x, c.y);
    const currentlyWater = currentRiver.value < 1.0;

    if (currentlyWater) {
      const best = findNearestValidDirection(c.x, c.y, game, noise, ({ x, y, tile }) => {
        // land is defined as river.value >= 1.0 OR tile equals bank/grass/forest
        const r = noise.getRiverSystem(x, y);
        if (r.value >= 1.0) return true;
        // fallback check to tile constants
        const T = game.CONSTANTS;
        return tile === T.TILE_BANK || tile === T.TILE_GRASS || tile === T.TILE_FOREST;
      }, 30, 1);

      if (best) {
        c.targetAngle = normalizeAngle(best.angle);
        c.speedMult = 0.6; // slow while returning
      } else {
        // Hard snap away from water gradient
        c.targetAngle = normalizeAngle(Math.atan2(river.gy, river.gx));
        c.speedMult = 0.6;
      }
    } else {
      // On land — ensure crab/land critters don't wander into water immediately
      c.speedMult = 1.0;
      if (isWater) {
        // if immediate forward step would place them into water, nudge angle toward land gradient
        c.targetAngle = normalizeAngle(Math.atan2(river.gy, river.gx));
      }
    }
  } else {
    // Air creatures no enforcement
    c.speedMult = 1.0;
  }

  // Keep speed multiplier bounded and restore over time
  if (c.speedMult === undefined) c.speedMult = 1.0;
  c.speedMult = Math.max(0.4, Math.min(1.0, c.speedMult));
}