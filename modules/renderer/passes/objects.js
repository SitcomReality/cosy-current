import { drawTreeShadow, drawTree, drawAquaticPlant, drawAquaticShadow } from '../objects.js';
import { shortestAngleDiff } from '../../fauna/utils.js';

export function renderObjectsPass(ctx, state, game, chunkManager, tileSize, cycle, shadowDir, noise, CHUNK_SIZE, TREES, FLORA) {
  const centerX = state.width / 2;
  const centerY = state.height / 2;

  const viewLeftTile = state.camera.x - (state.width / 2) / tileSize;
  const viewRightTile = state.camera.x + (state.width / 2) / tileSize;
  const viewTopTile = state.camera.y - (state.height / 2) / tileSize;
  const viewBottomTile = state.camera.y + (state.height / 2) / tileSize;

  const startChunkX = Math.floor(viewLeftTile / CHUNK_SIZE);
  const endChunkX = Math.floor(viewRightTile / CHUNK_SIZE);
  const startChunkY = Math.floor(viewTopTile / CHUNK_SIZE);
  const endChunkY = Math.floor(viewBottomTile / CHUNK_SIZE);

  const LIGHT_RADIUS = 14;
  const LIGHT_ANGLE_WIDTH = 0.9;
  const lightIntensity = cycle.raftLightIntensity || 0;
  const effectiveLightRadius = LIGHT_RADIUS * lightIntensity;
  const TREE_LIGHT_FADE_MS = 300;
  const now = performance.now();

  for (let cy = startChunkY; cy <= endChunkY; cy++) {
    for (let cx = startChunkX; cx <= endChunkX; cx++) {
      const props = chunkManager.getChunkProps(cx, cy);

      // Draw shadows first
      for (const prop of props) {
        let propCycle = cycle;
        let propShadowDir = shadowDir;

        if (cycle.raftLightActive && effectiveLightRadius > 0.01) {
          const dx = prop.x - state.player.x;
          const dy = prop.y - state.player.y;
          const dist = Math.hypot(dx, dy);
          const angleTo = Math.atan2(dy, dx);
          const angleDiff = Math.abs(shortestAngleDiff(state.player.angle, angleTo));

          let brightness = 0;
          let litNow = false;

          if (dist < effectiveLightRadius && angleDiff < LIGHT_ANGLE_WIDTH) {
            const falloff = (1.0 - (dist / effectiveLightRadius)) * (cycle.raftLightIntensity || 0);
            brightness = Math.max(0, Math.min(1, falloff));
            litNow = true;
            prop._lastLightStrength = brightness;
            prop._lastLightTime = now;
            prop._lastLightDirX = dx / Math.max(dist, 1e-6);
          } else {
            const lastTime = prop._lastLightTime || 0;
            const elapsed = lastTime ? (now - lastTime) : Infinity;
            const lastStrength = prop._lastLightStrength || 0;
            const fade = Math.max(0, 1 - elapsed / TREE_LIGHT_FADE_MS);
            brightness = lastStrength * fade;
          }

          if (brightness > 0.01) {
            const dirX = dist > 1e-6 ? dx / dist : (prop._lastLightDirX || 0);
            const dirY = dist > 1e-6 ? dy / dist : 0;
            propShadowDir = { x: dirX, y: dirY };

            if (prop.type === 'forest' || prop.type === 'grass') {
              const lightDirX = (typeof prop._lastLightDirX === 'number' && !litNow)
                ? prop._lastLightDirX
                : propShadowDir.x;
              const nightShade = computeTreeShadeFromHeadlight(brightness, lightDirX);
              propCycle = Object.assign({}, cycle, {
                shadowAlpha: 0.6 * brightness,
                shadowLength: 1.0,
                shadeProgression: nightShade
              });
            } else {
              propCycle = Object.assign({}, cycle, {
                shadowAlpha: 0.6 * brightness,
                shadowLength: 1.0,
                shadeProgression: 0.5
              });
            }
          } else {
            continue;
          }
        }

        if (prop.type === 'forest' || prop.type === 'grass') {
          drawTreeShadow(ctx, state, state.camera, tileSize, prop, propCycle, propShadowDir);
        } else {
          drawAquaticShadow(ctx, state, tileSize, prop, propCycle, propShadowDir);
        }
      }

      // Then draw geometry
      for (const prop of props) {
        let propCycle = cycle;
        if (cycle.raftLightActive && effectiveLightRadius > 0.01) {
          const dx = prop.x - state.player.x;
          const dy = prop.y - state.player.y;
          const dist = Math.hypot(dx, dy);
          const angleTo = Math.atan2(dy, dx);
          const angleDiff = Math.abs(shortestAngleDiff(state.player.angle, angleTo));

          let brightness = 0;
          let litNow = false;

          if (dist < effectiveLightRadius && angleDiff < LIGHT_ANGLE_WIDTH) {
            const falloff = (1.0 - (dist / effectiveLightRadius)) * (cycle.raftLightIntensity || 0);
            brightness = Math.max(0, Math.min(1, falloff));
            litNow = true;
            prop._lastLightStrength = brightness;
            prop._lastLightTime = now;
            prop._lastLightDirX = dx / Math.max(dist, 1e-6);
          } else {
            const lastTime = prop._lastLightTime || 0;
            const elapsed = lastTime ? (now - lastTime) : Infinity;
            const lastStrength = prop._lastLightStrength || 0;
            const fade = Math.max(0, 1 - elapsed / TREE_LIGHT_FADE_MS);
            brightness = lastStrength * fade;
          }

          if (brightness > 0.01) {
            if (prop.type === 'forest' || prop.type === 'grass') {
              const lightDirX = (typeof prop._lastLightDirX === 'number' && !litNow)
                ? prop._lastLightDirX
                : (dist > 1e-6 ? dx / dist : (prop._lastLightDirX || 0));
              const nightShade = computeTreeShadeFromHeadlight(brightness, lightDirX);
              propCycle = Object.assign({}, cycle, {
                shadeProgression: nightShade,
                shadowAlpha: 0.6 * brightness
              });
            } else {
              propCycle = Object.assign({}, cycle, {
                shadeProgression: 0.5,
                shadowAlpha: 0.6 * brightness
              });
            }
          } else {
            propCycle = cycle;
          }
        }

        if (prop.type === 'forest' || prop.type === 'grass') {
          drawTree(ctx, state, tileSize, prop, TREES, propCycle);
        } else {
          drawAquaticPlant(ctx, state, tileSize, prop, FLORA);
        }
      }
    }
  }
}

function computeTreeShadeFromHeadlight(falloffBrightness, lightDirX) {
  const b = Math.max(0, Math.min(1, falloffBrightness || 0));
  const fromRight = lightDirX < 0;

  if (fromRight) {
    const minS = 0.05;
    const maxS = 0.45;
    return minS + b * (maxS - minS);
  } else {
    const minS = 0.55;
    const maxS = 0.95;
    return maxS - b * (maxS - minS);
  }
}

