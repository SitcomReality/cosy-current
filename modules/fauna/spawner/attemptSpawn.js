import { getWeightedRandomType, getOffscreenSpawnPosition } from './utils.js';
import { getFlowAngleAt, getBankInfo, getWaterClearance } from '../behaviors/riverUtils.js';

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

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
    // Spawn by absolute clearance rather than a fixed normalized band, so
    // species can start in their own preferred lane even on wide water.
    const laneMin = def.lane ? def.lane.minClearance : 1.5;
    const minSpawnClearance = Math.max(1.0, laneMin - 0.15);
    const clearance = getWaterClearance(r);

    if (clearance >= minSpawnClearance) {
      let neighClear = true;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const tx = Math.floor(sx) + ox;
          const ty = Math.floor(sy) + oy;
          const infoN = noise.getRiverSystem(tx + 0.5, ty + 0.5);
          const t = game.getTile(tx, ty);
          if (getWaterClearance(infoN) < 0.6 || t === game.CONSTANTS.TILE_BANK) {
            neighClear = false;
            break;
          }
        }
        if (!neighClear) break;
      }

      valid = neighClear;
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
  if (typeKey === 'firefly') count = Math.floor(randomRange(4, 10));
  if (typeKey === 'bird')    count = Math.floor(randomRange(4, 14));
  if (typeKey === 'fish')    count = Math.floor(randomRange(2, 7));
  if (typeKey === 'eel')     count = Math.floor(randomRange(1, 4));
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

  const isWaterSpawn = def.pool === 'water';
  let waterFlowAngle = 0;
  let waterBankAngle = 0;
  if (isWaterSpawn) {
    waterFlowAngle = getFlowAngleAt(noise, sx, sy);
    const bankInfo = getBankInfo(noise, sx, sy);
    // On an exact centre line the gradient is ambiguous; any perpendicular is
    // fine for spreading the group across the channel.
    waterBankAngle = bankInfo.mag > 0.01 ? bankInfo.angle : waterFlowAngle + Math.PI / 2;
  }

  // Choose one travel direction per shoal so a group enters the river
  // together; across spawns both directions are represented.
  const waterDirectionFlip = isWaterSpawn && Math.random() < 0.5 ? Math.PI : 0;

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
    } else if (isWaterSpawn) {
      // Water groups enter already spread along and across the channel rather
      // than as a single point that has to untangle itself.
      const along = (i - (count - 1) / 2) * (1.9 + Math.random() * 0.9);
      const lateral = (Math.random() - 0.5) * 3.2;
      spawnX += Math.cos(waterFlowAngle) * along + Math.cos(waterBankAngle) * lateral;
      spawnY += Math.sin(waterFlowAngle) * along + Math.sin(waterBankAngle) * lateral;
      spawnX += (Math.random() - 0.5) * 0.8;
      spawnY += (Math.random() - 0.5) * 0.8;

      // Never start a creature on the sand if the spread pushed it shoreward.
      const spreadInfo = noise.getRiverSystem(spawnX, spawnY);
      if (getWaterClearance(spreadInfo) < 0.85) {
        spawnX = sx + (Math.random() - 0.5) * 1.6;
        spawnY = sy + (Math.random() - 0.5) * 1.6;
      }
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
    if (isDirectedFlock) {
      initialAngle = groupHeading + (Math.random() - 0.5) * 0.2;
    } else if (isWaterSpawn) {
      // Enter the river already aligned with it, with both directions of
      // travel represented across spawns.
      initialAngle = waterFlowAngle + waterDirectionFlip + (Math.random() - 0.5) * 0.35;
    }

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

    // Start each individual in its own lane, based on where it actually
    // spawned. This is the main source of cross-river variety: two fish from
    // the same shoal no longer share one centre-line target.
    let laneClearance = 0;
    let lanePhase = 0;
    let laneSpeedMult = 1;
    let laneAmpMult = 1;
    if (isWaterSpawn) {
      const memberRiver = noise.getRiverSystem(spawnX, spawnY);
      const memberHalfWidth = memberRiver.localHalfWidth || 7.5;
      const memberClearance = getWaterClearance(memberRiver);
      const lane = def.lane || {};
      const laneMin = lane.minClearance ?? 1.5;
      const laneMax = Math.max(
        laneMin,
        Math.min(lane.maxClearance ?? 5.0, memberHalfWidth - 1.0)
      );
      laneClearance = clamp(memberClearance + (Math.random() - 0.5) * 1.4, laneMin, laneMax);
      lanePhase = Math.random() * Math.PI * 2;
      laneSpeedMult = 0.75 + Math.random() * 0.5;
      laneAmpMult = 0.7 + Math.random() * 0.6;
    }

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
      sideBias: def.pool === 'water' ? (Math.random() - 0.5) * 0.7 : 0,
      laneClearance: isWaterSpawn ? laneClearance : undefined,
      lanePhase: isWaterSpawn ? lanePhase : undefined,
      laneSpeedMult: isWaterSpawn ? laneSpeedMult : undefined,
      laneAmpMult: isWaterSpawn ? laneAmpMult : undefined,
      orbitDir: Math.random() < 0.5 ? -1 : 1,
      junctionBias: (Math.random() - 0.5) * 0.25,
      loiterCenter: null,
      loiterTimer: 0
    });
  }
}

