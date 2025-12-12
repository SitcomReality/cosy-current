import { CREATURE_DEFS } from '../constants.js';

// Estimate water coverage near the player (uses game.getTile + noise)
export function estimateWaterCoverage(game, noise, player, sampleRadius, sampleCount = 80) {
  let water = 0;
  for (let i = 0; i < sampleCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * sampleRadius;
    const sx = player.x + Math.cos(a) * r;
    const sy = player.y + Math.sin(a) * r;
    const tile = game.getTile(Math.floor(sx), Math.floor(sy));
    if (tile === undefined) continue;
    const rinfo = noise.getRiverSystem(sx, sy);
    if (rinfo.value < 1.0 || tile === game.CONSTANTS.TILE_WATER) water++;
  }
  return Math.max(0, Math.min(1, water / sampleCount));
}

// Choose a creature type for a pool using weighted rules
export function getWeightedRandomType(poolName, dayTime) {
  const isNight = dayTime < 0.2 || dayTime > 0.8;
  const isDawnDusk = (dayTime > 0.2 && dayTime < 0.3) || (dayTime > 0.7 && dayTime < 0.8);

  const candidates = [];

  for (const key in CREATURE_DEFS) {
    const def = CREATURE_DEFS[key];
    if (def.pool !== poolName) continue;

    let weight = 1;

    if (def.nightOnly && !isNight) weight = 0;
    if (def.nightOnly && isNight) weight = 12;

    if (key === 'bird' && isDawnDusk) weight = 6;
    if (key === 'eel') weight *= 2;
    if (key === 'turtle') weight *= 0.8;
    if (key === 'sheep') weight *= 1.3;

    for (let i = 0; i < weight; i++) candidates.push(key);
  }

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Pick a spawn position just offscreen around the camera
export function getOffscreenSpawnPosition(state) {
  const tileSize = state.tileSize || 64;
  const halfW = (state.width / 2) / tileSize;
  const halfH = (state.height / 2) / tileSize;
  const margin = 4;

  const side = Math.floor(Math.random() * 4);
  let sx, sy;

  if (side === 0) {
    sx = state.camera.x - halfW - margin;
    sy = state.camera.y + (Math.random() * 2 - 1) * halfH;
  } else if (side === 1) {
    sx = state.camera.x + halfW + margin;
    sy = state.camera.y + (Math.random() * 2 - 1) * halfH;
  } else if (side === 2) {
    sx = state.camera.x + (Math.random() * 2 - 1) * halfW;
    sy = state.camera.y - halfH - margin;
  } else {
    sx = state.camera.x + (Math.random() * 2 - 1) * halfW;
    sy = state.camera.y + halfH + margin;
  }

  return { sx, sy };
}

