import { createChunkManager } from './chunk.js';
import { getVertexOffset } from './vertex.js';
import { createWaterEffects } from './water/index.js';
import { resolvePalettes } from './palette.js';
import { advanceDayTime, getCycleProps } from './daycycle.js';
import { drawPlayer } from './objects.js';
import { renderTerrainPass } from './passes/terrain.js';
import { renderWaterShadingPass } from './passes/waterShading.js';
import { renderFaunaPass, renderBirdsPass } from './passes/fauna.js';
import { renderObjectsPass } from './passes/objects.js';
import { renderAtmospherePass } from './passes/atmosphere.js';

export function createRenderer({ canvas, state, game, noise }) {
  const ctx = canvas.getContext('2d', { alpha: false });

  const { WATER_PALETTE, COLORS, TREES, FLORA } = resolvePalettes(game);

  const CHUNK_SIZE = 16;
  const chunkManager = createChunkManager({ CHUNK_SIZE, COLORS, WATER_PALETTE, state, game, noise, getVertexOffset });
  const waterEffects = createWaterEffects({ state, game, noise });

  function resize() {
    const dpr = state.pixelRatio;
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = state.width * dpr;
    canvas.height = state.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    chunkManager.clearCache();
  }

  function renderFrame(timestamp) {
    advanceDayTime(state);
    const cycle = getCycleProps(state);
    const shadowDir = { x: cycle.shadowDirX, y: cycle.shadowDirY };
    const now = performance.now();

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, state.width, state.height);

    if (!state.isPlaying) {
      ctx.fillStyle = `rgba(32,40,55,1)`;
      ctx.fillRect(0, 0, state.width, state.height);
      return;
    }

    const tileSize = state.tileSize;

    // Render passes in order
    renderTerrainPass(ctx, state, game, chunkManager, CHUNK_SIZE, cycle, now);
    renderWaterShadingPass(ctx, state, game, noise, cycle, shadowDir);
    waterEffects.render(ctx, state.camera, tileSize);

    if (state.fauna && state.fauna.creatures) {
      renderFaunaPass(ctx, state, tileSize, state.fauna.creatures, cycle, shadowDir, noise, cycle.raftLightActive);
    }

    renderObjectsPass(ctx, state, game, chunkManager, tileSize, cycle, shadowDir, noise, CHUNK_SIZE, TREES, FLORA);
    chunkManager.pruneCache();

    drawPlayer(ctx, state, tileSize, cycle, shadowDir, noise);

    if (state.fauna && state.fauna.creatures) {
      renderBirdsPass(ctx, state, tileSize, state.fauna.creatures, cycle, shadowDir, noise, cycle.raftLightActive);
    }

    renderAtmospherePass(ctx, state, cycle, 0.9);
  }

  function start() {
    resize();
    window.addEventListener('resize', resize);
  }

  function stop() {
    window.removeEventListener('resize', resize);
  }

  function clearCache() {
    chunkManager.clearCache();
  }

  return { start, stop, resize, renderFrame, clearCache, waterEffects };
}
