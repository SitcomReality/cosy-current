// Rain rendering.
//
// Ground-plane impacts are drawn in a separate pass BEFORE objects, so trees
// and the raft occlude them naturally. Rain streaks and canopy impacts are
// drawn after the world in the foreground pass.
//
// Splash types are surface-aware:
//   * water: small, flattened diamond ripples (the camera looks across the
//     surface, so they should not be screen-wide squares),
//   * bank/grass: tiny ground ticks,
//   * forest: no ground splash; canopy impacts are attached to the trees.

import { getTreeLean } from '../objects/tree.js';

const MAX_DROPS = 400;
const MAX_GROUND_SPLASHES = 400;
const MAX_CANOPY_IMPACTS = 220;
const GROUND_SPLASH_RATE = 100;  // spawn attempts per second at max rain
const CANOPY_IMPACT_RATE = 55;   // impacts per second at max rain
const DRAW_THRESHOLD = 0.05;

function ensureRenderState(state) {
  if (!state.weather._renderState) {
    state.weather._renderState = {
      drops: [],
      splashes: [],          // ground-plane impacts
      canopy: [],            // canopy glints / drips
      lastTime: performance.now(),
      lastCamX: state.camera.x,
      lastCamY: state.camera.y,
      splashAccumulator: 0,
      canopyAccumulator: 0,
      _dt: 0,
      _dxCam: 0,
      _dyCam: 0
    };
  }
  return state.weather._renderState;
}

function ensureDropPool(state, rs) {
  if (rs.drops.length > 0) return;
  const width = state.width;
  const height = state.height;
  for (let i = 0; i < MAX_DROPS; i++) {
    rs.drops.push({
      x: Math.random() * width,
      y: Math.random() * height,
      speed: 800 + Math.random() * 400,
      len: 25 + Math.random() * 20,
      z: 0.5 + Math.random() * 0.5 // depth factor for parallax
    });
  }
}

// Called once per frame by the ground pass. The foreground pass reuses the same
// dt/camera delta so rain and splashes stay in lockstep.
function beginWeatherFrame(state) {
  const rs = ensureRenderState(state);
  const now = performance.now();
  let dt = (now - rs.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.1) dt = 0.1;
  rs.lastTime = now;

  rs._dxCam = (state.camera.x - rs.lastCamX) * state.tileSize;
  rs._dyCam = (state.camera.y - rs.lastCamY) * state.tileSize;
  rs.lastCamX = state.camera.x;
  rs.lastCamY = state.camera.y;
  rs._dt = dt;

  // Retire particles as soon as the rain stops; otherwise they freeze in the
  // array because the draw passes early-return while dry.
  if ((state.weather.precipIntensity || 0) <= DRAW_THRESHOLD) {
    rs.splashes.length = 0;
    rs.canopy.length = 0;
    rs.splashAccumulator = 0;
    rs.canopyAccumulator = 0;
  }

  return rs;
}

// ---------------------------------------------------------------------------
// Ground pass (draw before trees)
// ---------------------------------------------------------------------------

export function renderWeatherGroundPass(ctx, state, game, tileSize) {
  const rs = beginWeatherFrame(state);
  const precip = state.weather.precipIntensity || 0;
  if (precip <= DRAW_THRESHOLD) return;

  const dt = rs._dt;
  if (dt > 0) {
    rs.splashAccumulator += dt * precip * GROUND_SPLASH_RATE;
    let spawnCount = Math.floor(rs.splashAccumulator);
    rs.splashAccumulator -= spawnCount;
    if (Math.random() < rs.splashAccumulator) {
      spawnCount++;
      rs.splashAccumulator -= 1;
    }
    spawnCount = Math.min(spawnCount, 10);

    const width = state.width;
    const height = state.height;
    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < spawnCount; i++) {
      const sx = Math.random() * width;
      const sy = Math.random() * height;
      const wx = (sx - centerX) / tileSize + state.camera.x;
      const wy = (sy - centerY) / tileSize + state.camera.y;
      const tile = game.getTile(wx, wy);
      const perspective = 0.65 + 0.70 * (sy / Math.max(1, height));

      if (tile === game.CONSTANTS.TILE_WATER) {
        const size = tileSize * (0.055 + Math.random() * 0.070) * perspective;
        const life = 0.32 + Math.random() * 0.18;
        rs.splashes.push({
          kind: 'water',
          wx, wy,
          life,
          maxLife: life,
          size,
          squash: 0.42 + Math.random() * 0.16
        });
      } else if (tile === game.CONSTANTS.TILE_BANK || tile === game.CONSTANTS.TILE_GRASS) {
        const size = tileSize * (0.018 + Math.random() * 0.020) * perspective;
        const life = 0.18 + Math.random() * 0.10;
        rs.splashes.push({
          kind: 'land',
          wx, wy,
          life,
          maxLife: life,
          size
        });
      }
      // Forest floor: the canopy intercepts the rain. Canopy impacts are
      // spawned in the foreground pass instead of drawing a ground decal.
    }
  }

  // Update + draw the ground-plane particles. They are world-anchored, and
  // because this pass runs before objects, tree/raft geometry covers them.
  const centerX = state.width / 2;
  const centerY = state.height / 2;
  const waterAlpha = 0.42 + precip * 0.28;

  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(215, 240, 255, 1)';
  ctx.fillStyle = 'rgba(215, 240, 255, 1)';

  for (let i = rs.splashes.length - 1; i >= 0; i--) {
    const s = rs.splashes[i];
    s.life -= dt;
    if (s.life <= 0) {
      rs.splashes.splice(i, 1);
      continue;
    }

    const sx = (s.wx - state.camera.x) * tileSize + centerX;
    const sy = (s.wy - state.camera.y) * tileSize + centerY;
    if (sx < -60 || sx > state.width + 60 || sy < -60 || sy > state.height + 60) {
      continue;
    }

    const progress = 1 - (s.life / s.maxLife);
    const alpha = (s.life / s.maxLife) * waterAlpha;

    if (s.kind === 'water') {
      const r = s.size * (0.45 + 0.55 * progress);
      const ry = r * s.squash;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(sx, sy - ry);
      ctx.lineTo(sx + r, sy);
      ctx.lineTo(sx, sy + ry);
      ctx.lineTo(sx - r, sy);
      ctx.closePath();
      ctx.stroke();

      // Tiny impact glint in the middle of the ripple.
      ctx.globalAlpha = alpha * 0.75;
      ctx.fillRect(sx - 0.5, sy - 0.5, 1, 1);
    } else {
      // Ground tick: a short vertical mark, not an expanding diamond.
      const half = s.size * 0.5;
      ctx.globalAlpha = alpha * 0.55;
      ctx.beginPath();
      ctx.moveTo(sx, sy - half);
      ctx.lineTo(sx, sy + half);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
  if (rs.splashes.length > MAX_GROUND_SPLASHES) {
    rs.splashes.splice(0, rs.splashes.length - MAX_GROUND_SPLASHES);
  }
}

// ---------------------------------------------------------------------------
// Canopy impacts (attached to trees, draw after the world)
// ---------------------------------------------------------------------------

function spawnCanopyImpacts(state, chunkManager, tileSize, CHUNK_SIZE, rs, dt) {
  const precip = state.weather.precipIntensity || 0;
  rs.canopyAccumulator += dt * precip * CANOPY_IMPACT_RATE;
  let spawnCount = Math.floor(rs.canopyAccumulator);
  rs.canopyAccumulator -= spawnCount;
  if (Math.random() < rs.canopyAccumulator) {
    spawnCount++;
    rs.canopyAccumulator -= 1;
  }
  if (spawnCount <= 0) return;
  spawnCount = Math.min(spawnCount, 6);

  const viewLeft = state.camera.x - (state.width / 2) / tileSize;
  const viewRight = state.camera.x + (state.width / 2) / tileSize;
  const viewTop = state.camera.y - (state.height / 2) / tileSize;
  const viewBottom = state.camera.y + (state.height / 2) / tileSize;
  const startChunkX = Math.floor(viewLeft / CHUNK_SIZE);
  const endChunkX = Math.floor(viewRight / CHUNK_SIZE);
  const startChunkY = Math.floor(viewTop / CHUNK_SIZE);
  const endChunkY = Math.floor(viewBottom / CHUNK_SIZE);
  const cols = Math.max(1, endChunkX - startChunkX + 1);
  const rows = Math.max(1, endChunkY - startChunkY + 1);

  for (let i = 0; i < spawnCount; i++) {
    let prop = null;
    // A few random tries to find a tree; open-water views simply have fewer
    // canopy hits, which is correct.
    for (let tries = 0; tries < 4 && !prop; tries++) {
      const cx = startChunkX + Math.floor(Math.random() * cols);
      const cy = startChunkY + Math.floor(Math.random() * rows);
      const props = chunkManager.getChunkProps(cx, cy);
      if (!props || props.length === 0) continue;
      const candidate = props[Math.floor(Math.random() * props.length)];
      if (candidate && (candidate.type === 'forest' || candidate.type === 'grass')) {
        prop = candidate;
      }
    }
    if (!prop) continue;

    const treeH = tileSize * prop.h;
    const baseW = tileSize * 0.5 * prop.h;
    const drip = Math.random() < 0.22;
    const life = drip ? 0.42 + Math.random() * 0.24 : 0.20 + Math.random() * 0.14;

    rs.canopy.push({
      wx: prop.x,
      wy: prop.y,
      tree: prop,
      treeH,
      offX: (Math.random() - 0.5) * baseW * 0.60,
      offY: -treeH * (0.52 + Math.random() * 0.36),
      size: tileSize * (0.040 + Math.random() * 0.030) * (0.85 + prop.h * 0.10),
      life,
      maxLife: life,
      drip,
      fall: treeH * 0.30
    });
  }

  if (rs.canopy.length > MAX_CANOPY_IMPACTS) {
    rs.canopy.splice(0, rs.canopy.length - MAX_CANOPY_IMPACTS);
  }
}

function updateAndDrawCanopy(ctx, state, tileSize, rs, dt) {
  const precip = state.weather.precipIntensity || 0;
  const centerX = state.width / 2;
  const centerY = state.height / 2;

  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(225, 242, 255, 1)';
  const canopyLean = { x: 0, y: 0 };

  for (let i = rs.canopy.length - 1; i >= 0; i--) {
    const c = rs.canopy[i];
    c.life -= dt;
    if (c.life <= 0) {
      rs.canopy.splice(i, 1);
      continue;
    }

    const progress = 1 - (c.life / c.maxLife);
    if (c.tree) {
      getTreeLean(c.tree, state, tileSize, canopyLean);
    } else {
      canopyLean.x = 0;
      canopyLean.y = 0;
    }
    const heightFactor = c.treeH > 0 ? (-c.offY / c.treeH) : 0.7;
    const leanX = canopyLean.x * heightFactor;
    const leanY = canopyLean.y * heightFactor;
    const sx = (c.wx - state.camera.x) * tileSize + centerX + c.offX + leanX;
    const sy = (c.wy - state.camera.y) * tileSize + centerY + c.offY + leanY +
      (c.drip ? progress * c.fall : 0);
    if (sx < -30 || sx > state.width + 30 || sy < -30 || sy > state.height + 30) {
      continue;
    }

    const alpha = (c.life / c.maxLife) * (0.50 + precip * 0.40);
    const len = c.drip ? c.size * 2.8 : c.size;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    if (c.drip) {
      // A leaf releasing a drip: a short vertical streak falling from the canopy.
      ctx.moveTo(sx, sy - len * 0.5);
      ctx.lineTo(sx, sy + len * 0.5);
    } else {
      // A tiny impact glint on the canopy: a horizontal sparkle with a short
      // vertical tick. It reads as rain hitting leaves rather than another
      // raindrop, and it makes the forest feel like a surface.
      ctx.moveTo(sx - len, sy);
      ctx.lineTo(sx + len, sy);
      ctx.moveTo(sx, sy - len * 0.55);
      ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Foreground pass (rain + canopy impacts)
// ---------------------------------------------------------------------------

export function renderWeatherPass(ctx, state, chunkManager, tileSize, CHUNK_SIZE) {
  const rs = ensureRenderState(state);
  const precip = state.weather.precipIntensity || 0;
  if (precip <= DRAW_THRESHOLD) return;

  const dt = rs._dt || 0;
  const width = state.width;
  const height = state.height;
  const wind = state.weather.wind || { x: 0, y: 0, strength: 0, angle: 0 };

  // 1. Canopy impacts sit above the trees but below the foreground rain.
  if (dt > 0) {
    ensureDropPool(state, rs);
    spawnCanopyImpacts(state, chunkManager, tileSize, CHUNK_SIZE, rs, dt);
  }
  updateAndDrawCanopy(ctx, state, tileSize, rs, dt);

  // 2. Rain streaks.
  ensureDropPool(state, rs);
  const activeDrops = Math.floor(rs.drops.length * precip);
  const maxWindSpeed = 400;
  const windX = wind.x * maxWindSpeed;
  const windY = wind.y * maxWindSpeed * 0.35;
  const slantX = wind.x * 40;
  const slantY = wind.y * 12;
  const baseAlpha = 0.3 + precip * 0.4;

  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < activeDrops; i++) {
    const d = rs.drops[i];

    d.x += windX * dt;
    d.y += (d.speed + windY) * dt;

    // Camera parallax: closer drops (higher z) slip less, simulating their
    // presence in a world-space volume.
    d.x -= rs._dxCam * (d.z || 0.5);
    d.y -= rs._dyCam * (d.z || 0.5);

    if (d.y > height) {
      d.y = -d.len;
      d.x = Math.random() * width;
    }
    if (d.y < -d.len) d.y = height;
    if (d.x > width) d.x -= width;
    if (d.x < 0) d.x += width;

    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - slantX, d.y - d.len - slantY);
  }

  ctx.strokeStyle = `rgba(200, 230, 255, ${baseAlpha})`;
  ctx.stroke();
}
