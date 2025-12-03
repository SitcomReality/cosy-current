import { normalizeAngle, shortestAngleDiff } from '../utils.js';
import { getRiverInfo, getFlowAngleAt, getCenterAngleAt } from './riverUtils.js';

export function applyFlowFollow(c, dt, noise) {
  // Sample current position
  const r = getRiverInfo(noise, c.x, c.y);

  // 1. Base Flow Direction (tangent to gradient)
  const flowAngle = getFlowAngleAt(noise, c.x, c.y);
  let target = flowAngle;

  // 2. Wavy Motion (Sinusoidal offset)
  // Varies by creature ID or explicit per-creature wavePhase to desync group oscillations
  const waveFreq = 2.5;
  // Prefer an explicit per-creature phase if available (set at spawn), otherwise fall back
  const phaseFromId = (c.id && c.id.length) ? (c.id.charCodeAt(0) % 10) : 0;
  const wavePhase = (typeof c.wavePhase === 'number') ? c.wavePhase : phaseFromId;
  const waveVal = Math.sin(c.life * waveFreq + wavePhase);
  // Amplitude reduces when near banks to prevent accidental beaching
  const safeAmplitude = 0.8 * Math.max(0, 1.0 - r.value);
  target += waveVal * safeAmplitude;

  // 3. Look-ahead Avoidance (Whiskers)
  // Check left and right probes to steer away from rising terrain values
  const probeDist = 2.5;
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
    const urgency = Math.max(0.1, (r.value - 0.3) * 1.5);
    target += diff * urgency * 1.5;
  }

  // 4. Gradient Descent (Emergency Center Bias)
  // If very close to bank, override with direct center vector
  if (r.value > 0.7) {
    const deepAngle = getCenterAngleAt(noise, c.x, c.y); // toward deeper water
    const blend = Math.max(0, Math.min(0.6, (r.value - 0.7) * 2.0));
    // Blend current target with deepAngle
    target = normalizeAngle(target + shortestAngleDiff(target, deepAngle) * blend);
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

  c.targetAngle = target;

  // Modulate speed based on turn sharpness to simulate physics
  const turnStress = Math.abs(shortestAngleDiff(c.angle, target));
  c.speedMult = Math.max(0.5, 1.0 - (turnStress * 0.5));
}