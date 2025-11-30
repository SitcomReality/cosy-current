import { initApp } from './modules/app.js';

// Entry point: keep this file very small and focused on wiring.
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('main-canvas');
  const controls = document.getElementById('controls');

  if (!canvas || !controls) {
    console.error('Required DOM elements missing');
    return;
  }

  initApp({ canvas, controls });
});