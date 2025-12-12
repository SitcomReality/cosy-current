import { getWeightedRandomType, getOffscreenSpawnPosition } from './utils.js';

// Single-responsibility spawn implementation. Accepts a params object to avoid tight coupling.
export function attemptSpawn({
  poolName, player, dayTime, addCreature,
  game, noise, state, CREATURE_DEFS, groupPhaseMap, randomRange
}) {
  const typeKey = getWeightedRandomType(poolName, dayTime);
  if (!typeKey) return;
  const def = CREATURE_DEFS[typeKey];

  const { sx, sy } = getOffscreenSpawnPosition(state);

  const r = noise.getRiverSystem(sx, sy);
  const tile = game.getTile(Math.floor(sx), Math.floor(sy));

  let valid = false;

  if (poolName === 'water') {
    const EEL_INSET_THRESHOLD = 0.4;
    const DEFAULT_INSET_THRESHOLD = 0.5;
    const neighMaxValueDefault = 0.85;
    const neighMaxValueForEel = 0.75;

    const insetThreshold = (typeKey === 'eel') ? EEL_INSET_THRESHOLD : DEFAULT_INSET_THRESHOLD;
    const neighMaxValue = (typeKey === 'eel') ? neighMaxValueForEel : neighMaxValueDefault;

    if (r.value < insetThreshold) {
      let neighClear = true;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const tx = Math.floor(sx) + ox;
          const ty = Math.floor(sy) + oy;
          const infoN = noise.getRiverSystem(tx + 0.5, ty + 0.5);
          const t = game.getTile(tx, ty);
          if (infoN.value >= neighMaxValue || t === game.CONSTANTS.TILE_BANK) {
            neighClear = false;
            break;
          }
        }
        if (!neighClear) break;
      }

      if (neighClear) {
        if (def.depth && r.value > (1.0 - def.depth - 0.05)) {
          valid = false;
        } else {
          valid = true;
        }
      } else {
        valid = false;
      }
    }
  } else if (poolName === 'land') {
    if (r.value >= 1.0) {
      const habits = def.habitat || [];
      const T = game.CONSTANTS;
      const mapping = { 'forest': T.TILE_FOREST, 'grass': T.TILE_GRASS, 'bank': T.TILE_BANK };

      if (habits.length > 0) {
        if (habits.some(h => mapping[h] === tile)) {
          if (typeKey === 'firefly' && tile === T.TILE_GRASS) {
            if (Math.random() < 0.35) valid = true;
            else valid = false;
          } else {
            valid = true;
          }
        }
      } else {
        valid = true;
      }
    }
  } else if (poolName === 'air') {
    valid = true;
  }

  if (typeKey === 'firefly' && !valid) {
    for (let ox = -3; ox <= 3; ox += 3) {
      for (let oy = -3; oy <= 3; oy += 3) {
        const tx = Math.floor(sx + ox);
        const ty = Math.floor(sy + oy);
        if (game.getTile(tx, ty) === game.CONSTANTS.TILE_FOREST) {
          valid = true;
          break;
        }
      }
      if (valid) break;
    }
  }

  if (!valid) return;

  let count = 1;
  if (typeKey === 'firefly') count = randomRange(4, 9);
  if (typeKey === 'bird')    count = Math.floor(randomRange(4, 14));
  if (typeKey === 'fish')    count = randomRange(2, 6);
  if (typeKey === 'eel')     count = randomRange(1, 3);
  if (typeKey === 'sheep')   count = Math.floor(randomRange(3, 9));
  if (typeKey === 'turtle')  count = Math.floor(randomRange(1, 5));

  const groupId = count > 1 ? Math.random().toString(36) : null;
  if (groupId) groupPhaseMap.set(groupId, Math.random() * Math.PI * 2);

  let groupHeading = Math.random() * Math.PI * 2;
  const isDirectedFlock = (typeKey === 'bird' && count > 1);

  if (isDirectedFlock) {
    const cx = state.camera.x;
    const cy = state.camera.y;
    groupHeading = Math.atan2(cy - sy, cx - sx);
    groupHeading += (Math.random() - 0.5) * 0.8;
  }

  const baseColor = def.colors[Math.floor(Math.random() * def.colors.length)];
  const groupCanFlock = (typeKey === 'fish' || typeKey === 'eel' || typeKey === 'bird');
  const groupIsFlocker = groupCanFlock && (typeKey === 'bird' ? (Math.random() < 0.95) : (Math.random() < 0.4));
  let baseFlockStrength = 0;
  if (groupIsFlocker) {
    if (typeKey === 'fish' || typeKey === 'eel') baseFlockStrength = randomRange(0.15, 0.45);
    else baseFlockStrength = randomRange(0.35, 0.6);
  }

  for (let i = 0; i < count; i++) {
    let spawnX = sx;
    let spawnY = sy;

    if (isDirectedFlock) {
      const perp = groupHeading + Math.PI / 2;
      const spread = 2.5;
      const offset = (i - (count - 1) / 2) * spread;
      const pullback = Math.abs(i - (count - 1) / 2) * 1.5;

      spawnX += Math.cos(perp) * offset - Math.cos(groupHeading) * pullback;
      spawnY += Math.sin(perp) * offset - Math.sin(groupHeading) * pullback;

      spawnX += (Math.random() - 0.5) * 1.5;
      spawnY += (Math.random() - 0.5) * 1.5;
    } else {
      spawnX += (Math.random() - 0.5) * 3;
      spawnY += (Math.random() - 0.5) * 3;
    }

    let segmentColors = null;
    if (def.segments) {
      segmentColors = [];
      const segCount = 3;
      const isRainbow = Math.random() < 0.2;
      for (let k = 0; k < segCount; k++) {
        if (isRainbow) segmentColors.push(def.colors[Math.floor(Math.random() * def.colors.length)]);
        else segmentColors.push(baseColor);
      }
    }

    let segmentCount = undefined;
    if (typeKey === 'eel') segmentCount = Math.floor(randomRange(3, 6));

    let initialAngle = Math.random() * Math.PI * 2;
    if (isDirectedFlock) initialAngle = groupHeading + (Math.random() - 0.5) * 0.2;

    let wavePhase;
    if (groupId) {
      const basePhase = groupPhaseMap.get(groupId) || (Math.random() * Math.PI * 2);
      wavePhase = basePhase + (i * 0.27) + (Math.random() * 0.18 - 0.09);
    } else {
      wavePhase = Math.random() * Math.PI * 2;
    }

    const baseWaveAmp = 1.0;
    const baseWaveFreq = 1.0;
    let waveAmpMult = baseWaveAmp * (0.85 + Math.random() * 0.3);
    let waveFreqMult = baseWaveFreq * (0.9 + Math.random() * 0.25);
    if (groupId) {
      waveAmpMult = baseWaveAmp * (0.95 + (Math.random() - 0.5) * 0.12);
      waveFreqMult = baseWaveFreq * (0.98 + (Math.random() - 0.5) * 0.06);
    }

    const spawnSpeedMult = 0.92 + Math.random() * 0.16;

    addCreature(poolName, {
      x: spawnX,
      y: spawnY,
      type: typeKey,
      def: def,
      angle: initialAngle,
      targetAngle: initialAngle,
      speed: def.speed * randomRange(0.8, 1.2),
      baseSpeed: def.speed,
      turnRate: def.turnRate,
      size: def.size,
      color: baseColor,
      segmentColors: segmentColors,
      wanderTimer: Math.random(),
      groupId: groupId,
      life: 0,
      id: Math.random().toString(36),
      depth: def.depth,
      glow: def.glow,
      segmentCount,
      isFlocker: groupIsFlocker,
      flockStrength: baseFlockStrength,
      groupBaseAngle: isDirectedFlock ? groupHeading : initialAngle,
      wavePhase,
      waveAmpMult,
      waveFreqMult,
      spawnSpeedMult,
      sideBias: def.pool === 'water' ? (Math.random() - 0.5) * 0.7 : 0
    });
  }
}

