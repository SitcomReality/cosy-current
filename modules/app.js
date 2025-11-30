import { createAppState } from './state.js';
import { createRenderer } from './canvas.js';
import { createUI } from './ui.js';
import { createNoiseEngine } from './noise.js';
import { createGame } from './game.js';

export function initApp({ canvas, controls }) {
  const state = createAppState();
  const noise = createNoiseEngine(state);
  const game = createGame({ state, noise });
  const renderer = createRenderer({ canvas, state, game });
  const ui = createUI({ container: controls, state, renderer, noise, game });

  renderer.start();
  ui.bind();

  // Input Handling
  const keys = {};
  window.addEventListener('keydown', e => { 
    keys[e.code] = true; 
    state.lastInputTime = performance.now();
    // Unlock camera if manual movement keys are pressed
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      state.cameraLocked = false;
    }
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  let lastTime = performance.now();

  function loop(timestamp) {
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // 1. Update Game Logic
    game.update(dt);

    // 2. Player Input (Steering)
    if (keys['KeyA'] || keys['ArrowLeft']) {
        state.player.angle -= 2.0 * dt;
    }
    if (keys['KeyD'] || keys['ArrowRight']) {
        state.player.angle += 2.0 * dt;
    }

    // 3. Camera Control
    const camSpeed = 20 * dt;
    let manualCam = false;

    // Manual Pan
    if (keys['KeyW'] || keys['ArrowUp']) { state.camera.y -= camSpeed; manualCam = true; }
    if (keys['KeyS'] || keys['ArrowDown']) { state.camera.y += camSpeed; manualCam = true; }
    // Note: A/D are used for steering now, so we only pan with mouse/other keys or if we change control scheme.
    // Let's use I/J/K/L or just mouse drag later. For now, W/S for forward/back pan is weird if A/D steer.
    // Let's make the camera strictly follow unless specific "Look" keys are used, or mouse drag.
    // For simplicity in this iteration: Camera is locked unless we implement mouse drag, 
    // or we use different keys for pan. 
    // Let's rely on the requested "slide back" behavior.
    
    // Check for inactivity
    const timeSinceInput = (timestamp - state.lastInputTime) / 1000;
    
    if (state.cameraLocked) {
        // Soft lock
        const targetX = state.player.x;
        const targetY = state.player.y;
        
        // Lerp camera
        state.camera.x += (targetX - state.camera.x) * 5 * dt;
        state.camera.y += (targetY - state.camera.y) * 5 * dt;
    } else {
        // If unlocked, we stay where we are, but check if we should lock back
        if (timeSinceInput > 2.0) {
            state.cameraLocked = true;
        }
    }

    // UI Updates
    if (typeof ui.update === 'function') {
      ui.update(dt);
    }

    // Render
    renderer.renderFrame(timestamp);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  return { state, noise, game, renderer, ui };
}

