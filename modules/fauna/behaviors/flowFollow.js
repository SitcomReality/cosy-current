import { normalizeAngle, shortestAngleDiff } from '../utils.js';
import { getRiverInfo, getFlowAngleAt, getCenterAngleAt } from './riverUtils.js';

export function applyFlowFollow(c, dt, noise) {
  // Sample current position
  const r = getRiverInfo(noise, c.x, c.y);

  // 1. Base Flow Direction (tangent to gradient)
  const flowAngle = getFlowAngleAt(noise, c.x, c.y);
  let target = flowAngle;

  // --- Soft "loiter / orbit" mode for water creatures ---
  // Occasionally, instead of marching along the river, a creature will hang around
  // a small area, orbiting a local center in smooth curves.
  if (c.loiterTimer === undefined) c.loiterTimer = 0;
  if (!c.loiterPhase) c.loiterPhase = Math.random() * Math.PI * 2;

  const depthVal = r.value; // 0 = deep center, 1 = bank/land
  let inLoiter = c.loiterTimer > 0;

  // Chance to start loitering when in usable water band
  if (!inLoiter) {
    const depthOk = depthVal > 0.25 && depthVal < 0.9;
    // dt‑scaled probability so it's resolution independent
    if (depthOk && Math.random() < dt * 0.07) {
      inLoiter = true;
      c.loiterTimer = 4 + Math.random() * 8; // 4–12 seconds
      const radius = 4 + Math.random() * 6;  // tiles around current point
      const ang = Math.random() * Math.PI * 2;
      c.loiterCenter = {
        x: c.x + Math.cos(ang) * radius,
        y: c.y + Math.sin(ang) * radius
      };
      // Keep existing phase but jitter slightly so multiple entries differ
      c.loiterPhase += (Math.random() - 0.5) * 0.8;
    }
  }

  if (inLoiter) {
    c.loiterTimer -= dt;
    if (c.loiterTimer <= 0) {
      c.loiterTimer = 0;
    }

    const center = c.loiterCenter || { x: c.x, y: c.y };
    const toCenter = Math.atan2(center.y - c.y, center.x - c.x);

    // Orbit around the center; prefer a consistent direction using sideBias when present
    const sideBias = (typeof c.sideBias === 'number') ? c.sideBias : 0;
    const orbitDir = sideBias !== 0 ? Math.sign(sideBias) : (Math.random() < 0.5 ? -1 : 1);

    c.loiterPhase += dt * 0.6;
    const wiggle = Math.sin(c.loiterPhase) * 0.3;
    const orbitOffset = orbitDir * 0.9; // roughly perpendicular to center direction

    target = normalizeAngle(toCenter + orbitOffset + wiggle);

    // While loitering, move more gently; deeper water allows a little more motion.
    const depthFactor = Math.max(0, Math.min(1, 1.0 - depthVal));
    c.speedMult = 0.15 + depthFactor * 0.35;
    c.turnBoost = 1.2;

    c.targetAngle = target;
    return;
  }

  // 2. Wavy Motion (Sinusoidal offset)
  // Varies by creature ID or explicit per-creature wavePhase to desync group oscillations
  const baseWaveFreq = 2.5;
  // Prefer an explicit per-creature phase if available (set at spawn), otherwise fall back
  const phaseFromId = (c.id && c.id.length) ? (c.id.charCodeAt(0) % 10) : 0;
  const wavePhase = (typeof c.wavePhase === 'number') ? c.wavePhase : phaseFromId;

  // Use per-creature frequency multiplier if present
  const waveFreq = baseWaveFreq * (typeof c.waveFreqMult === 'number' ? c.waveFreqMult : 1.0);
  const waveVal = Math.sin(c.life * waveFreq + wavePhase);

  // Amplitude reduces when near banks to prevent accidental beaching
  // Reduce base amplitude so creatures don't hug the bank as much.
  const baseAmp = 0.6 * Math.max(0, 1.0 - r.value);
  // Apply per-creature amplitude multiplier if provided
  const ampMult = (typeof c.waveAmpMult === 'number') ? c.waveAmpMult : 1.0;
  // If part of a group, bias members to be closer to 1.0 but still jitter
  const safeAmplitude = baseAmp * ampMult;
  target += waveVal * safeAmplitude;

  // 3. Look-ahead Avoidance (Whiskers)
  // Check left and right probes to steer away from rising terrain values
  // Increase probe distance so creatures detect banks earlier and steer away sooner.
  const probeDist = 3.5;
  const probeAngle = 0.6; // ~35 degrees

  const angL = c.angle - probeAngle;
  const angR = c.angle + probeAngle;

  // Optimization: only probe if we aren't in deep center
  if (r.value > 0.15) {
    const lx = c.x + Math.cos(angL) * probeDist;
    const ly = c.y + Math.sin(angL) * probeDist;
    const rx = c.x + Math.cos(angR) * probeDist;
    const ry = c.y + Math.sin(angR) * probeDist;

    const vL = getRiverInfo(noise, lx, ly).value;
    const vR = getRiverInfo(noise, rx, ry).value;

    // If one side is significantly shallower (higher value), steer away
    const diff = vL - vR;
    // If vL > vR (Left is shallower), diff > 0. We want to turn Right (increase angle).
    // If vR > vL (Right is shallower), diff < 0. We want to turn Left (decrease angle).
    // Increase urgency scaling so creatures react more strongly when near banks.
    const urgency = Math.max(0.12, (r.value - 0.3) * 2.2);
    target += diff * urgency * 1.8;
  }

  // 4. Gradient Descent (Emergency Center Bias)
  // If approaching banks, more strongly bias back toward center so creatures stay further from edge.
  // Apply this earlier and allow a stronger blend as they get closer.
  if (r.value > 0.65) {
    const deepAngle = getCenterAngleAt(noise, c.x, c.y); // toward deeper water
    // Blend ramps from 0 at 0.65 up to ~0.8 when at extreme edge
    const blend = Math.max(0, Math.min(0.8, (r.value - 0.65) * 1.6));
    // Blend current target with deepAngle
    target = normalizeAngle(target + shortestAngleDiff(target, deepAngle) * blend);
  }

  // 4.5 Subtle per-creature side bias so some individuals favor one side of the river.
  const sideBias = (typeof c.sideBias === 'number') ? c.sideBias : 0;
  if (sideBias !== 0) {
    // Stronger in deeper water; fade the influence overall so side-preference doesn't pull them onto sand.
    const depthCenter = Math.max(0, Math.min(1, 1.0 - r.value));
    const biasStrength = 0.25 * depthCenter;
    target += sideBias * biasStrength;
  }

  // 5. Flocking (Optional)
  if (c.isFlocker && c.groupId) {
    let h = 0;
    for (let i = 0; i < c.groupId.length; i++) {
      h = (h * 31 + c.groupId.charCodeAt(i)) >>> 0;
    }
    const offset = (((h % 1000) / 999) - 0.5) * 0.5;
    const groupAngle = normalizeAngle(flowAngle + offset);
    const flockBase = c.flockStrength || 0;
    const depthFactor = Math.max(0, Math.min(1, 1.0 - r.value));
    const flockBlend = flockBase * (0.3 + 0.7 * depthFactor);
    if (flockBlend > 0) {
      target = normalizeAngle(
        target + shortestAngleDiff(target, groupAngle) * flockBlend
      );
    }
  }

  c.targetAngle = normalizeAngle(target);

  // Modulate speed based on turn sharpness to simulate physics
  const turnStress = Math.abs(shortestAngleDiff(c.angle, target));
  // Base speedMult from turning stress
  let computedSpeedMult = Math.max(0.5, 1.0 - (turnStress * 0.5));
  // Allow spawn-provided cruising bias to gently diversify group speeds
  if (typeof c.spawnSpeedMult === 'number') {
    computedSpeedMult *= c.spawnSpeedMult;
  }
  c.speedMult = computedSpeedMult;
}