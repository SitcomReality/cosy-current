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

  // Input Handling (Vanilla JS)
  const keys = {};
  window.addEventListener('keydown', e => { keys[e.code] = true; });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  let lastTime = performance.now();

  function loop(timestamp) {
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // Update Game Logic
    game.update(dt);

    // Update Input / camera
    const speed = 10 * dt; // Camera speed in tiles per second
    if (keys['ArrowUp'] || keys['KeyW']) state.camera.y -= speed;
    if (keys['ArrowDown'] || keys['KeyS']) state.camera.y += speed;
    if (keys['ArrowLeft'] || keys['KeyA']) state.camera.x -= speed;
    if (keys['ArrowRight'] || keys['KeyD']) state.camera.x += speed;

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

