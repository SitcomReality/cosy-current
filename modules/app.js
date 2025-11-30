import { createAppState } from './state.js';
import { createRenderer } from './canvas.js';
import { createUI } from './ui.js';
import { createNoiseEngine } from './noise.js';

export function initApp({ canvas, controls }) {
  const state = createAppState();

  const noise = createNoiseEngine(state);
  const renderer = createRenderer({ canvas, state, noise });
  const ui = createUI({ container: controls, state, renderer, noise });

  renderer.start();
  ui.bind();
}

