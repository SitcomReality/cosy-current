// Fauna rendering entrypoint: composes shadows and geometry

import { drawCreatureShadow } from './shadows.js';
import { drawCreature } from './drawers.js';
import { shortestAngleDiff } from '../../fauna/utils.js';

export function renderFauna(ctx, state, tileSize, creatures, cycle, shadowDir, noise, raftLightActive) {
  if (!creatures || creatures.length === 0) return;

  const centerX = state.width / 2;
  const centerY = state.height / 2;
  
  const LIGHT_RADIUS = 14; 
  const LIGHT_ANGLE_WIDTH = 0.9;
  const lightIntensity = cycle.raftLightIntensity || 0;
  const effectiveLightRadius = LIGHT_RADIUS * lightIntensity;

  creatures.forEach(c => {
    // Skip birds in this pass; they'll be rendered in front of the player
    if (c.type === 'bird') return;

    const screenX = (c.x - state.camera.x) * tileSize + centerX;
    const screenY = (c.y - state.camera.y) * tileSize + centerY;

    // Cull off-screen
    if (screenX < -tileSize * 5 || screenX > state.width + tileSize * 5 ||
        screenY < -tileSize * 5 || screenY > state.height + tileSize * 5) return;

    const size = c.size * tileSize;

    // Shadow Logic
    let localCycle = cycle;
    let localShadowDir = shadowDir;
    let shouldDrawShadow = (cycle.shadowAlpha > 0.01 && cycle.shadowLength > 0.001);

    if (raftLightActive && effectiveLightRadius > 0.01) {
        // Default to no shadow at night unless in light
        shouldDrawShadow = false;
        
        const dx = c.x - state.player.x;
        const dy = c.y - state.player.y;
        const dist = Math.hypot(dx, dy);
        const angleTo = Math.atan2(dy, dx);
        const angleDiff = Math.abs(shortestAngleDiff(state.player.angle, angleTo));

        if (dist < effectiveLightRadius && angleDiff < LIGHT_ANGLE_WIDTH) {
            shouldDrawShadow = true;
            localShadowDir = { x: dx/dist, y: dy/dist };
            const falloff = 1.0 - (dist / effectiveLightRadius);
            localCycle = Object.assign({}, cycle, {
                shadowAlpha: 0.6 * falloff * lightIntensity,
                shadowLength: 1.0
            });
        }
    }

    // Draw shadow first
    if (shouldDrawShadow) {
      drawCreatureShadow(ctx, state, tileSize, c, screenX, screenY, size, localCycle, localShadowDir, noise);
    }

    // Draw creature
    drawCreature(ctx, c, screenX, screenY, size, cycle);
  });
}

// Dedicated bird rendering pass
export function renderBirds(ctx, state, tileSize, creatures, cycle, shadowDir, noise, raftLightActive) {
  if (!creatures || creatures.length === 0) return;

  const centerX = state.width / 2;
  const centerY = state.height / 2;
  
  const LIGHT_RADIUS = 14; 
  const LIGHT_ANGLE_WIDTH = 0.9;
  const lightIntensity = cycle.raftLightIntensity || 0;
  const effectiveLightRadius = LIGHT_RADIUS * lightIntensity;

  creatures.forEach(c => {
    if (c.type !== 'bird') return;

    const screenX = (c.x - state.camera.x) * tileSize + centerX;
    const screenY = (c.y - state.camera.y) * tileSize + centerY;

    if (screenX < -tileSize * 5 || screenX > state.width + tileSize * 5 ||
        screenY < -tileSize * 5 || screenY > state.height + tileSize * 5) return;

    const size = c.size * tileSize;

    let localCycle = cycle;
    let localShadowDir = shadowDir;
    let shouldDrawShadow = (cycle.shadowAlpha > 0.01 && cycle.shadowLength > 0.001);

    if (raftLightActive && effectiveLightRadius > 0.01) {
        shouldDrawShadow = false;
        const dx = c.x - state.player.x;
        const dy = c.y - state.player.y;
        const dist = Math.hypot(dx, dy);
        const angleTo = Math.atan2(dy, dx);
        const angleDiff = Math.abs(shortestAngleDiff(state.player.angle, angleTo));

        if (dist < effectiveLightRadius && angleDiff < LIGHT_ANGLE_WIDTH) {
            shouldDrawShadow = true;
            localShadowDir = { x: dx/dist, y: dy/dist };
            const falloff = 1.0 - (dist / effectiveLightRadius);
            localCycle = Object.assign({}, cycle, {
                shadowAlpha: 0.5 * falloff * lightIntensity,
                shadowLength: 1.5 // Birds cast longer shadows
            });
        }
    }

    if (shouldDrawShadow) {
      drawCreatureShadow(ctx, state, tileSize, c, screenX, screenY, size, localCycle, localShadowDir, noise);
    }
    drawCreature(ctx, c, screenX, screenY, size, cycle);
  });
}