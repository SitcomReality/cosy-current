// main.js — modern entrypoint for the canvas-based idle game

import { initApp } from './modules/app.js';

// Initialize the app once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('main-canvas');
  const controls = document.getElementById('controls');

  if (!canvas || !controls) {
    // Basic guard to avoid runtime errors if the layout changes
    console.warn('Game canvas or controls container not found in DOM.');
    return;
  }

  initApp({ canvas, controls });
});

// Tombstones for legacy, removed code from the original main.js:
//
// removed global map generation and noise configuration variables
//   (hash, seed, random_seed, dirlist, npc_elements, fgrx/fgrn/fgwx/fgwn,
//    fgb/fgc, gbr/gbc/grid_height/grid_width, smoothing settings, sine/perlin/
//    simplex/fourier/jacobi/chebyshev/permute parameters, etc.)
//
// removed function onPageLoad() {}
// removed function getSettings() {}
// removed function initGame() {}
// removed function getSeedFromDOM() {}
// removed function generateMiniMap() {}
// removed function generateMiniMapFromArray() {}
// removed function hashCode() {}
// removed function seededRand() {}
// removed function checkModifiedTile() {}
// removed function selectTile(noise) {}
// removed function generateTileRow(direction) {}
// removed function generateTileColumn(direction) {}
// removed function prepareTileElement(tiletype, col, innerhtml) {}
// removed function prepareCoinElement(money_amount) {}
//
// removed legacy timer-based game loop: gameStartPause(), gameStart(),
//   gamePause(), game_step() {}
//
// removed NPC social-logic helpers: countAdjacentFriends(), npcVolition(),
//   addToNPCArray() and related jQuery-based NPC coordinate scraping {}
//
// removed jQuery plugin extension $.fn.toggleText and other direct DOM-
//   manipulation/game-logic coupling {}