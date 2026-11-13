import { normalizeAngle, shortestAngleDiff } from '../utils.js';
import {
  getRiverInfo,
  getBankInfo,
  getCenterAngleAt,
  getWaterClearance,
  isNearJunction,
  chooseJunctionExit
} from './riverUtils.js';

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

// Per-species movement character. Everything is optional so new water
// creatures only need to define what makes them different.
function getLaneConfig(c) {
  if (c.laneCfg) return c.laneCfg;
  const lane = c.def.lane || {};
  c.laneCfg = {
    minClearance: lane.minClearance ?? 1.5,
    maxClearance: lane.maxClearance ?? 5.0,
    meanderAmp: lane.meanderAmp ?? 0.9,
    meanderSpeed: lane.meanderSpeed ?? 0.16,
    waveAmp: lane.waveAmp ?? 0.38,
    loiterChance: c.def.loiterChance ?? 0.01,
    personalSpace: c.def.personalSpace ?? 1.3,
    schoolRadius: c.def.schoolRadius ?? 7,
    schoolCohesion: c.def.schoolCohesion ?? 0.3,
    schoolAlign: c.def.schoolAlign ?? 0.2
  };
  return c.laneCfg;
}

function ensureLaneState(c, params) {
  if (typeof c.laneClearance !== 'number') {
    c.laneClearance = (params.minClearance + params.maxClearance) * 0.5;
  }
  if (typeof c.lanePhase !== 'number') c.lanePhase = Math.random() * TAU;
  if (typeof c.laneSpeedMult !== 'number') c.laneSpeedMult = 0.7 + Math.random() * 0.6;
  if (typeof c.laneAmpMult !== 'number') c.laneAmpMult = 0.7 + Math.random() * 0.6;
  if (typeof c.orbitDir !== 'number') c.orbitDir = Math.random() < 0.5 ? -1 : 1;
  if (typeof c.junctionBias !== 'number') c.junctionBias = (Math.random() - 0.5) * 0.25;
  if (typeof c.loiterTimer !== 'number') c.loiterTimer = 0;
  if (typeof c.loiterPhase !== 'number') c.loiterPhase = Math.random() * TAU;
}

// Separation keeps individuals from collapsing into one tight shoal; for
// schooling groups a weak cohesion/alignment term keeps the school together
// without forcing everyone onto the same exact line.
function applyNeighborSteering(c, neighbors, target, params, schooling) {
  if (!neighbors || neighbors.length === 0) return target;

  let sepX = 0;
  let sepY = 0;
  let sepCount = 0;
  let cohX = 0;
  let cohY = 0;
  let aliX = 0;
  let aliY = 0;
  let schoolCount = 0;

  const canSchool = schooling && c.isFlocker && c.groupId &&
    typeof c.flockStrength === 'number' && c.flockStrength > 0;
  const schoolRadius = params.schoolRadius;

  for (let i = 0; i < neighbors.length; i++) {
    const other = neighbors[i];
    if (!other || other === c) continue;

    const dx = c.x - other.x;
    const dy = c.y - other.y;
    const d2 = dx * dx + dy * dy;

    if (d2 < 1e-4) {
      // Exactly stacked: nudge apart in a random direction.
      sepX += (Math.random() - 0.5) * 2;
      sepY += (Math.random() - 0.5) * 2;
      sepCount++;
      continue;
    }

    const dist = Math.sqrt(d2);
    if (dist < params.personalSpace) {
      const weight = (params.personalSpace - dist) / params.personalSpace;
      sepX += (dx / dist) * weight;
      sepY += (dy / dist) * weight;
      sepCount++;
    }

    if (canSchool && other.groupId === c.groupId && dist < schoolRadius) {
      cohX += other.x;
      cohY += other.y;
      aliX += Math.cos(other.angle);
      aliY += Math.sin(other.angle);
      schoolCount++;
    }
  }

  if (sepCount > 0) {
    const sepAngle = Math.atan2(sepY, sepX);
    const sepWeight = clamp(0.16 + sepCount * 0.1, 0, 0.55);
    target = normalizeAngle(target + shortestAngleDiff(target, sepAngle) * sepWeight);
  }

  if (canSchool && schoolCount > 1) {
    const strength = clamp(c.flockStrength, 0, 0.5);
    const centerAngle = Math.atan2(cohY / schoolCount - c.y, cohX / schoolCount - c.x);
    const alignAngle = Math.atan2(aliY, aliX);
    target = normalizeAngle(
      target + shortestAngleDiff(target, centerAngle) * strength * params.schoolCohesion
    );
    target = normalizeAngle(
      target + shortestAngleDiff(target, alignAngle) * strength * params.schoolAlign
    );
  }

  return normalizeAngle(target);
}

// A small, water-safe orbit around a point. Returns null if we can't find a
// center that is well away from banks and crossings.
function findLoiterCenter(c, noise, flowAngle) {
  const baseAngle = typeof flowAngle === 'number' ? flowAngle : c.angle;
  for (let attempt = 0; attempt < 5; attempt++) {
    const radius = 2 + Math.random() * 4;
    // Bias the centre ahead of the creature so loitering reads as "stopping to
    // look around" rather than turning back into the shoal behind it.
    const angle = baseAngle + (Math.random() - 0.5) * 2.4;
    const cx = c.x + Math.cos(angle) * radius;
    const cy = c.y + Math.sin(angle) * radius;
    const info = noise.getRiverSystem(cx, cy);
    if (getWaterClearance(info) > 1.4 && !isNearJunction(info, 1.35)) {
      return { x: cx, y: cy };
    }
  }
  return null;
}

function applyJunctionPassage(c, dt, noise, riverInfo, clearance, neighbors, params) {
  // Loitering has no place in the middle of a crossing.
  c.loiterTimer = 0;
  c.loiterCenter = null;

  if (c.junctionTimer > 0) c.junctionTimer -= dt;

  if (c.junctionTimer <= 0 || typeof c.junctionExitAngle !== 'number') {
    c.junctionExitAngle = chooseJunctionExit(
      noise, c.x, c.y, c.angle, riverInfo, c.junctionBias
    );
    // Re-evaluate occasionally, but hold an exit long enough to actually
    // commit to it rather than dithering in the middle.
    c.junctionTimer = 1.0 + Math.random() * 1.2;
  }

  let target = c.junctionExitAngle;
  // A little undulation keeps the straight crossing from looking mechanical.
  target = normalizeAngle(target + Math.sin(c.life * 1.6 + (c.wavePhase || 0)) * 0.07);
  target = applyNeighborSteering(c, neighbors, target, params, false);

  c.targetAngle = target;

  const turnStress = Math.abs(shortestAngleDiff(c.angle, target));
  c.speedMult = clamp(0.95 - turnStress * 0.25, 0.65, 1.05);
  c.turnBoost = 1.0;
  c.lastFlowAngle = target;

  // Near a bank even while crossing, let the normal panic steer win next
  // frame (boundaries.js runs after this module).
  if (clearance < 0.9) c.turnBoost = 2.5;
}

export function applyFlowFollow(c, dt, noise, neighbors) {
  const params = getLaneConfig(c);
  ensureLaneState(c, params);

  const riverInfo = getRiverInfo(noise, c.x, c.y);
  const halfWidth = riverInfo.localHalfWidth || 7.5;
  const clearance = getWaterClearance(riverInfo);

  // Advance the slow lane meander even while loitering/crossing so it never
  // snaps when a creature resumes cruising.
  c.lanePhase = (c.lanePhase + dt * params.meanderSpeed * c.laneSpeedMult) % TAU;

  // --- Junction passage (must come before flow-following) ---
  // The flow field is singular at a crossing; following it produces the
  // clockwise vortex. Instead, pick a clear arm matching our heading and hold
  // it until we're out of the junction's neighbourhood.
  if (isNearJunction(riverInfo, 1.15)) {
    applyJunctionPassage(c, dt, noise, riverInfo, clearance, neighbors, params);
    return;
  }

  // Reset junction state once we're clear.
  c.junctionTimer = 0;
  c.junctionExitAngle = undefined;

  // --- Soft "loiter / orbit" mode for water creatures ---
  let inLoiter = c.loiterTimer > 0;

  if (!inLoiter && c.life > 1.5 && !c.loiterCenter) {
    // Only consider resting in a comfortable band, and keep rest stops rare:
    // the old high frequency is what made whole shoals hang around together.
    const depthOk = clearance > 1.2 && riverInfo.value < 0.9;
    if (depthOk && Math.random() < params.loiterChance * dt) {
      const flowAngle = getFlowAngleFromRiver(noise, c);
      const center = findLoiterCenter(c, noise, flowAngle);
      if (center) {
        c.loiterCenter = center;
        c.loiterTimer = 3.5 + Math.random() * 5.5;
        c.loiterPhase += (Math.random() - 0.5) * 0.8;
        inLoiter = true;
      }
    }
  }

  if (inLoiter) {
    c.loiterTimer -= dt;

    let center = c.loiterCenter;
    let centerInfo = null;
    if (center) centerInfo = noise.getRiverSystem(center.x, center.y);

    const centerLost = !center || c.loiterTimer <= 0 ||
      getWaterClearance(centerInfo) < 0.55 ||
      isNearJunction(centerInfo, 1.3) ||
      Math.hypot(c.x - center.x, c.y - center.y) > 9;

    if (!centerLost) {
      const toCenter = Math.atan2(center.y - c.y, center.x - c.x);

      c.loiterPhase += dt * 0.55;
      const orbit = c.orbitDir * (0.55 + Math.sin(c.loiterPhase * 1.3) * 0.22);
      const wiggle = Math.sin(c.loiterPhase * 2.1) * 0.28;

      let target = normalizeAngle(toCenter + orbit + wiggle);
      target = applyNeighborSteering(c, neighbors, target, params, false);

      // Gentle, unhurried movement; deeper water allows a little more drift.
      const depthFactor = clamp(1 - riverInfo.value, 0, 1);
      c.speedMult = 0.18 + depthFactor * 0.3;
      c.turnBoost = 1.15;
      c.targetAngle = target;
      return;
    }

    // Finished resting: clear and resume cruising this frame.
    c.loiterTimer = 0;
    c.loiterCenter = null;
  }

  // --- Normal cruise: flow direction plus a personal cross-river lane ---
  const bank = getBankInfo(noise, c.x, c.y);
  let flowAngle;

  if (bank.mag < 0.02) {
    // Exactly on a centre line the gradient is ambiguous. Continuing with the
    // last known flow avoids the random per-frame jitter the old code had.
    flowAngle = typeof c.lastFlowAngle === 'number' ? c.lastFlowAngle : c.angle;
  } else {
    flowAngle = normalizeAngle(bank.angle + Math.PI / 2);
    // Keep the tangent oriented the way the creature is already swimming.
    if (Math.cos(flowAngle - c.angle) < 0) {
      flowAngle = normalizeAngle(flowAngle + Math.PI);
    }
    c.lastFlowAngle = flowAngle;
  }

  let target = flowAngle;

  // Lane control works in absolute clearance (tiles from the bank), not the
  // width-normalized river value. That lets creatures spread out on wide
  // stretches while still keeping a safe margin on thin ones.
  const maxSafeClearance = Math.max(0.8, halfWidth - 1.0);
  const laneMin = Math.min(params.minClearance, maxSafeClearance);
  const laneMax = Math.max(laneMin, Math.min(params.maxClearance, maxSafeClearance));
  let desiredClearance = typeof c.laneClearance === 'number' ? c.laneClearance : (laneMin + laneMax) * 0.5;
  desiredClearance += Math.sin(c.lanePhase) * params.meanderAmp * c.laneAmpMult;
  desiredClearance = clamp(desiredClearance, laneMin, laneMax);

  if (bank.mag >= 0.02) {
    const clearanceError = clearance - desiredClearance; // positive = too central
    const correction = clamp(clearanceError * 0.42, -0.8, 0.95);
    const bankSide = shortestAngleDiff(flowAngle, bank.angle) >= 0 ? 1 : -1;
    target = normalizeAngle(flowAngle + bankSide * correction);
  }

  // Shallow undulation, strongest in open water and fading near the bank so
  // it never pushes a creature onto the sand.
  const depthFactor = clamp(1 - clearance / Math.max(1, halfWidth), 0, 1);
  const baseWaveFreq = 2.2;
  const wavePhase = (typeof c.wavePhase === 'number') ? c.wavePhase : 0;
  const waveFreq = baseWaveFreq * (typeof c.waveFreqMult === 'number' ? c.waveFreqMult : 1.0);
  const waveAmp = params.waveAmp * (typeof c.waveAmpMult === 'number' ? c.waveAmpMult : 1.0);
  target += Math.sin(c.life * waveFreq + wavePhase) * waveAmp * depthFactor;

  // --- Whisker avoidance ---
  // Probe ahead-left and ahead-right; steer away from whichever side gets
  // shallower. Because the trigger is absolute clearance, this stays quiet in
  // the middle of the river instead of herding everyone onto the centre line.
  const probeDist = clamp(1.8 + c.speed * 0.5, 2.0, 3.4);
  const probeAngle = 0.55;
  const angL = c.angle - probeAngle;
  const angR = c.angle + probeAngle;

  const leftInfo = getRiverInfo(
    noise, c.x + Math.cos(angL) * probeDist, c.y + Math.sin(angL) * probeDist
  );
  const rightInfo = getRiverInfo(
    noise, c.x + Math.cos(angR) * probeDist, c.y + Math.sin(angR) * probeDist
  );
  const leftClearance = getWaterClearance(leftInfo);
  const rightClearance = getWaterClearance(rightInfo);

  const whiskerSafety = Math.max(1.0, desiredClearance * 0.65);
  const danger = Math.max(0, whiskerSafety - Math.min(leftClearance, rightClearance));
  if (danger > 0) {
    const sideDiff = leftInfo.value - rightInfo.value;
    target += sideDiff * clamp(0.35 + danger * 0.55, 0, 1.1);
  }

  // --- Bank emergency (soft) ---
  // Only take over when genuinely close to land; the lane controller should
  // handle ordinary near-bank swimming.
  if (clearance < 1.0) {
    const deepAngle = getCenterAngleAt(noise, c.x, c.y);
    const urgency = clamp((1.0 - clearance) / 1.0, 0, 1);
    target = normalizeAngle(target + shortestAngleDiff(target, deepAngle) * urgency * 0.75);
  }

  // --- Neighbours: spacing first, schooling second ---
  target = applyNeighborSteering(c, neighbors, target, params, true);

  // A very small persistent side preference adds individual character without
  // dragging the whole population toward one bank.
  if (typeof c.sideBias === 'number' && c.sideBias !== 0) {
    target += c.sideBias * 0.18 * depthFactor;
  }

  c.targetAngle = normalizeAngle(target);

  // Modulate speed by how hard we're turning; keep a floor so creatures don't
  // crawl when a shoal or bank jostles them.
  const turnStress = Math.abs(shortestAngleDiff(c.angle, c.targetAngle));
  let speedMult = clamp(1.02 - turnStress * 0.38, 0.55, 1.02);
  if (typeof c.spawnSpeedMult === 'number') speedMult *= c.spawnSpeedMult;
  c.speedMult = speedMult;
  c.turnBoost = 1.0;
}

function getFlowAngleFromRiver(noise, c) {
  const bank = getBankInfo(noise, c.x, c.y);
  if (bank.mag < 0.02) {
    return typeof c.lastFlowAngle === 'number' ? c.lastFlowAngle : c.angle;
  }
  let angle = normalizeAngle(bank.angle + Math.PI / 2);
  if (Math.cos(angle - c.angle) < 0) angle = normalizeAngle(angle + Math.PI);
  return angle;
}
