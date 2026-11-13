// main.js — modern entrypoint for the canvas-based idle game

import { initApp } from './modules/app.js';

// Initialize the app once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('main-canvas');
  // The UI layer in index.html is #ui-layer — use it so UI controls (Start button, settings)
  // are properly bound. Previously we looked for a non-existent #controls element.
  const controls = document.getElementById('ui-layer') || document.body;

  if (!canvas) {
    console.warn('Game canvas not found in DOM.');
    return;
  }

  const app = initApp({ canvas, controls });

  // Readiness hook for the local browser smoke tests (webgame_smoke).
  // Queued after the game's first rAF callback so screenshots never race the
  // initial render.
  requestAnimationFrame(() => {
    window.__APP_READY__ = true;

    const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
    window.__webgame = {
      get ready() { return Boolean(window.__APP_READY__); },
      get canvas() { return canvas; },

      snapshot() {
        const state = app.state;
        const w = state.weather;
        return {
          ready: Boolean(window.__APP_READY__),
          isPlaying: Boolean(state.isPlaying),
          dayTime: state.dayTime,
          tileSize: state.tileSize,
          player: {
            x: state.player.x,
            y: state.player.y,
            angle: state.player.angle
          },
          camera: {
            x: state.camera.x,
            y: state.camera.y,
            locked: state.cameraLocked
          },
          weather: {
            auto: Boolean(w.auto),
            precipIntensity: w.precipIntensity,
            wind: {
              x: w.wind.x,
              y: w.wind.y,
              strength: w.wind.strength,
              angle: w.wind.angle
            },
            stormBearing: w.stormBearing,
            lightning: {
              flash: w.lightning.flash,
              dirX: w.lightning.dirX,
              dirY: w.lightning.dirY,
              boltSeed: w.lightning.boltSeed
            },
            particles: w._renderState ? {
              drops: w._renderState.drops.length,
              splashes: w._renderState.splashes.length,
              canopy: w._renderState.canopy.length
            } : null
          }
        };
      },

      // Deterministic weather setup for manual testing and screenshots.
      // Any weather field switches the simulation to manual unless auto is set.
      setWeather(options = {}) {
        const w = app.state.weather;
        const touchesWeather = ['rain', 'windStrength', 'windAngle']
          .some((key) => typeof options[key] === 'number');
        if (typeof options.auto === 'boolean') w.auto = options.auto;
        else if (touchesWeather) w.auto = false;

        if (typeof options.rain === 'number') {
          w.precipIntensity = clamp01(options.rain);
        }
        if (typeof options.windStrength === 'number' || typeof options.windAngle === 'number') {
          const strength = typeof options.windStrength === 'number'
            ? clamp01(options.windStrength)
            : w.wind.strength;
          const angle = typeof options.windAngle === 'number'
            ? options.windAngle
            : w.wind.angle;
          w.wind.strength = strength;
          w.wind.angle = angle;
          w.wind.x = Math.cos(angle) * strength;
          w.wind.y = Math.sin(angle) * strength;
        }
        if (typeof options.time === 'number') {
          app.state.dayTime = ((options.time % 1) + 1) % 1;
        }
        if (options.lightning) {
          w.lightning.force = true;
        }
        return this.snapshot();
      },

      setDayTime(value) {
        app.state.dayTime = ((Number(value) % 1) + 1) % 1;
        return app.state.dayTime;
      },

      setCamera(x, y) {
        if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return null;
        app.state.camera.x = Number(x);
        app.state.camera.y = Number(y);
        app.state.cameraLocked = false;
        app.state.lastInputTime = performance.now();
        return { x: app.state.camera.x, y: app.state.camera.y };
      },

      strikeLightning() {
        if (app.state.weather.lightning) app.state.weather.lightning.force = true;
      }
    };
  });
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