import { createAppState } from './state.js';
import { createRenderer } from './renderer/index.js';
import { createUI } from './ui.js';
import { createNoiseEngine } from './noise.js';
import { createGame } from './game.js';

export function initApp({ canvas, controls }) {
  const state = createAppState();
  const noise = createNoiseEngine(state);
  const game = createGame({ state, noise });
  // Pass noise to renderer for terrain perturbation effects
  const renderer = createRenderer({ canvas, state, game, noise });
  const ui = createUI({ container: controls, state, renderer, noise, game });

  renderer.start();
  ui.bind();

  // Input Handling
  const keys = {};
  window.addEventListener('keydown', e => { 
    keys[e.code] = true; 
    state.lastInputTime = performance.now();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  // Mouse wheel zoom handling (scroll to zoom in/out)
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomStep = 0.1;
    const factor = e.deltaY > 0 ? (1 - zoomStep) : (1 + zoomStep);
    const currentSize = state.tileSize;
    const newSize = Math.max(32, Math.min(128, currentSize * factor));
    if (Math.abs(newSize - currentSize) > 0.5) {
      state.tileSize = newSize;
      if (renderer.clearCache) renderer.clearCache();
      state.lastInputTime = performance.now();
    }
  }, { passive: false });

  let lastTime = performance.now();

  // --- MMB panning support ---
  let isPanning = false;
  const panStart = { x: 0, y: 0 };
  const camStart = { x: 0, y: 0 };

  // Convert pixel delta to world (tiles)
  function pixelsToWorld(dx, dy) {
    return {
      x: dx / state.tileSize,
      y: dy / state.tileSize
    };
  }

  // Start panning on middle mouse button down
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1) {
      e.preventDefault();
      isPanning = true;
      panStart.x = e.clientX;
      panStart.y = e.clientY;
      camStart.x = state.camera.x;
      camStart.y = state.camera.y;
      state.cameraLocked = false;
      state.lastInputTime = performance.now();
    }
  });

  // Move camera while panning
  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    const worldDelta = pixelsToWorld(dx, dy);
    // Invert movement so dragging follows typical map behavior
    state.camera.x = camStart.x - worldDelta.x;
    state.camera.y = camStart.y - worldDelta.y;
    state.lastInputTime = performance.now();
  });

  // End panning on mouseup / leave
  window.addEventListener('mouseup', (e) => {
    if (isPanning && e.button === 1) {
      isPanning = false;
      state.lastInputTime = performance.now();
    }
  });
  // Also stop on blur (safety)
  window.addEventListener('blur', () => { isPanning = false; });

  function loop(timestamp) {
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // 1. Update Game Logic
    // Apply steering input bias to player angle BEFORE update
    // The game logic will try to snap this to the road
    if (state.player && state.isPlaying) {
        if (keys['KeyA'] || keys['ArrowLeft']) {
            state.player.angle -= 3.0 * dt;
        }
        if (keys['KeyD'] || keys['ArrowRight']) {
            state.player.angle += 3.0 * dt;
        }
    }

    game.update(dt);

    // 2. Player Input (Steering) - MOVED TO GAME UPDATE or biased above
    // We removed the direct angle manipulation here to let the road logic handle "snapping"
    // while still allowing influence.

    // 3. Camera Control
    const camSpeed = 20 * dt;
    let manualCam = false;

    // Remove keyboard pan (W/S) — camera panning now via MMB drag only.

    // Check for inactivity
    const timeSinceInput = (timestamp - state.lastInputTime) / 1000;
    
    if (state.cameraLocked) {
        // Soft lock: follow player
        const targetX = state.player.x;
        const targetY = state.player.y;
        
        // Lerp camera
        state.camera.x += (targetX - state.camera.x) * 5 * dt;
        state.camera.y += (targetY - state.camera.y) * 5 * dt;
    } else {
        // If unlocked and no recent input, re-lock after timeout
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

