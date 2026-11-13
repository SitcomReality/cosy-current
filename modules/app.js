import { createAppState } from './state.js';
import { createRenderer } from './renderer/index.js';
import { createUI } from './ui.js';
import { createNoiseEngine } from './noise.js';
import { createGame } from './game.js';
import { createFaunaSystem } from './fauna/index.js';
import { loadGame, saveGame } from './persistence.js';
import { RELIC_IDS } from './game/collectables.js';

export function initApp({ canvas, controls }) {
  // Load saved game if available
  const savedData = loadGame();
  
  const state = createAppState(savedData);
  const noise = createNoiseEngine(state);
  const game = createGame({ state, noise });
  const fauna = createFaunaSystem({ state, game, noise });
  state.fauna = fauna; // Attach to state for renderer access
  // Pass noise to renderer for terrain perturbation effects
  const renderer = createRenderer({ canvas, state, game, noise });
  const ui = createUI({ container: controls, state, renderer, noise, game });

  renderer.start();
  ui.bind();

  // Input Handling
  const keys = {};
  let gatherPressed = false;
  window.addEventListener('keydown', e => { 
    keys[e.code] = true; 
    state.lastInputTime = performance.now();
    state._keysDown = keys; // Expose to player module for steering authority

    // Speed-up key (numpad /) engages a multiplier while held
    if (e.code === 'NumpadDivide') {
      state.speedMultiplier = 10;
    }
    // Gather action (Space) - pulls nearby items with magnet effect
    if (e.code === 'Space' && !e.repeat) {
      gatherPressed = true;
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', e => { 
    keys[e.code] = false; 
    state._keysDown = keys;
    // Release speed-up
    if (e.code === 'NumpadDivide') {
      state.speedMultiplier = 1;
    }
    if (e.code === 'Space') {
      gatherPressed = false;
    }
  });

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

  // Collectable click/tap interaction (mouse)
  canvas.addEventListener('click', (e) => {
    if (!state.isPlaying && !state.freePlayMode) return;
    if (!state.collectables) return;
    handleCollectableTap(e.clientX, e.clientY);
  });

  // Touch support for collectable collection
  canvas.addEventListener('touchstart', (e) => {
    if (!state.isPlaying && !state.freePlayMode) return;
    if (!state.collectables) return;
    // Only handle single touch for collection
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      handleCollectableTap(touch.clientX, touch.clientY);
    }
  }, { passive: true });

  function handleCollectableTap(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    // Use CSS pixels for both click and render coordinates
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;
    
    const centerX = state.width / 2;
    const centerY = state.height / 2;
    const tileSize = state.tileSize;

    // Check collectables near click (within ~28px CSS for better touch target)
    const hitRadius = 28;
    for (let i = state.collectables.length - 1; i >= 0; i--) {
      const c = state.collectables[i];
      const screenX = (c.x - state.camera.x) * tileSize + centerX;
      const screenY = (c.y - state.camera.y) * tileSize + centerY;
      
      const dist = Math.hypot(clickX - screenX, clickY - screenY);
      if (dist < hitRadius) {
        game.collectItem(c.itemId, i);
        break;
      }
    }
  }

  // Touch steering - drag on canvas to steer
  let touchSteering = false;
  let touchStartX = 0;
  
  canvas.addEventListener('touchstart', (e) => {
    if (!state.isPlaying && !state.freePlayMode) return;
    if (e.touches.length === 1) {
      // Check if this is a steering gesture (not on a collectable)
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      
      // Only start steering if touch is on left or right third of screen
      if (touchX < state.width / 3 || touchX > state.width * 2 / 3) {
        touchSteering = true;
        touchStartX = touchX;
        state.cameraLocked = false; // Allow camera unlock during steering
        state.lastInputTime = performance.now();
        e.preventDefault();
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (!touchSteering || !state.isPlaying && !state.freePlayMode) return;
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      
      // Calculate steering delta
      const deltaX = touchX - touchStartX;
      const steerAmount = (deltaX / state.width) * 2.0; // radians
      
      if (state.player) {
        state.player.angle += steerAmount;
        touchStartX = touchX; // Reset for continuous steering
      }
      state.lastInputTime = performance.now();
      e.preventDefault();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (touchSteering) {
      touchSteering = false;
      // Re-lock camera after a delay
      setTimeout(() => {
        if (!isPanning) state.cameraLocked = true;
      }, 1000);
    }
  }, { passive: true });

  let lastTime = performance.now();
  const MAX_DT = 0.12; // seconds — clamp large dt after tab switches or stalls
  // Keep a visibility handler to reset timing when tab regains focus to avoid huge dt spikes
  function handleVisibilityChange() {
    if (!document.hidden) {
      // reset lastTime so the next frame doesn't integrate a huge dt
      lastTime = performance.now();
      state.lastInputTime = performance.now();
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);

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

  // Auto-save Loop (every 30 seconds)
  const AUTOSAVE_INTERVAL = 30000;
  let timeSinceSave = 0;

  // Ending check - called each frame to detect 4 relics discovered
  function checkEnding() {
    if (state.endingTriggered || state.freePlayMode) return;
    
    const discoveredCount = RELIC_IDS.filter(id => state.collection[id]).length;
    if (discoveredCount >= RELIC_IDS.length) {
      triggerEnding();
    }
  }

  function triggerEnding() {
    state.endingTriggered = true;
    state.endingSeen = true;
    state.freePlayMode = true;
    state.isPlaying = false; // Pause gameplay during ending
    
    // Show ending notification via UI
    if (state.notifications && typeof state.notifications.info === 'function') {
      state.notifications.info('All 4 relics discovered! The river widens ahead...');
    }
    
    // Save immediately
    saveGame(state);
  }

  function loop(timestamp) {
    let dt = (timestamp - lastTime) / 1000;
    // Clamp dt to avoid runaway simulation after tab is hidden / system sleep
    if (!isFinite(dt) || dt <= 0) dt = 0;
    if (dt > MAX_DT) dt = MAX_DT;
    lastTime = timestamp;

    // Accumulate total run time for noise-based systems (weather)
    state.time = (state.time || 0) + dt;

    // 1. Update Game Logic
    // Apply steering input bias to player angle BEFORE update
    // The game logic will try to snap this to the river
    if (state.player && state.isPlaying && !state.freePlayMode) {
        if (keys['KeyA'] || keys['ArrowLeft']) {
            state.player.angle -= 3.0 * dt;
        }
        if (keys['KeyD'] || keys['ArrowRight']) {
            state.player.angle += 3.0 * dt;
        }
    }

    if (state.isPlaying && !state.freePlayMode) {
      game.update(dt);
      
      // Auto-collect nearby items
      const AUTO_COLLECT_RADIUS = 3.0; // increased from 2.5
      if (state.collectables && state.player) {
        for (let i = state.collectables.length - 1; i >= 0; i--) {
          const c = state.collectables[i];
          const d = Math.hypot(c.x - state.player.x, c.y - state.player.y);
          if (d < AUTO_COLLECT_RADIUS) {
            game.collectItem(c.itemId, i);
          }
        }
      }
      
      // Gather action (hold Space) - pulls items in a larger radius
      if (gatherPressed && state.collectables && state.player) {
        const GATHER_RADIUS = 8.0;
        const GATHER_FORCE = 15.0; // tiles per second
        for (let i = state.collectables.length - 1; i >= 0; i--) {
          const c = state.collectables[i];
          const d = Math.hypot(c.x - state.player.x, c.y - state.player.y);
          if (d < GATHER_RADIUS && d > 0.5 && !c.collecting) {
            // Start magnet collection
            game.collectItem(c.itemId, i);
          }
        }
      }
      
      // Update fauna
      fauna.update(dt);

      // Maintain collectables (spawn, despawn, update lifetimes)
      if (state.collectablesModule) {
        state.collectablesModule.maintainCollectables(dt, state.player, game, noise);
      }
      
      // Check for ending condition
      checkEnding();
    }
    
    // Update water effects (always run for visual continuity)
    if (renderer.waterEffects) {
      renderer.waterEffects.update(dt);
    }

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
    
    // Update onboarding hints
    if (state.notifications && typeof state.notifications.updateHints === 'function') {
      state.notifications.updateHints(dt, state.onboardingSeen);
    }

    // Render
    renderer.renderFrame(timestamp);

    // Auto-save
    if (state.isPlaying || state.freePlayMode) {
      timeSinceSave += dt * 1000;
      if (timeSinceSave >= AUTOSAVE_INTERVAL) {
        saveGame(state);
        timeSinceSave = 0;
      }
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
  
  // Save on exit/visibility hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.isPlaying) {
      saveGame(state);
    }
  });

  return { state, noise, game, renderer, ui };
}

