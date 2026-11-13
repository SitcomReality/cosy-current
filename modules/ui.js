import { hasSave, deleteSave, saveGame } from './persistence.js';
import { createInventoryUI } from './ui/inventory.js';
import { createCollectionUI } from './ui/collection.js';
import { createCustomizationUI } from './ui/customization.js';
import { createNotificationSystem } from './ui/notifications.js';
import { ITEM_REGISTRY } from './data/items.js';

export function createUI({ container, state, renderer, noise, game }) {
  
  // Cache DOM elements
  let inventoryUI;
  const titleScreen = document.getElementById('title-screen');
  const startScreen = document.getElementById('start-screen');
  const gameHud = document.getElementById('game-hud');
  const btnStart = document.getElementById('btn-start');
  const btnDeleteSave = document.getElementById('btn-delete-save');
  const uiTime = document.getElementById('ui-time');
  
  // Title screen buttons
  const btnNewJourney = document.getElementById('btn-new-journey');
  const btnContinueJourney = document.getElementById('btn-continue-journey');
  const btnSettingsTitle = document.getElementById('btn-settings-title');
  const btnCreditsTitle = document.getElementById('btn-credits-title');
  
  // Relic counter element
  let relicCounterEl = null;
  let relicCounterNudged = false;
  
  // Settings Modal Elements
  const btnSettingsToggle = document.getElementById('btn-settings-toggle');
  const settingsModal = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const settingsContainer = document.getElementById('settings-controls-container');
  
  // Pause Menu Elements
  const btnPause = document.getElementById('btn-pause');
  const pauseMenu = document.getElementById('pause-menu');
  const btnClosePause = document.getElementById('btn-close-pause');
  const btnResume = document.getElementById('btn-resume');
  const btnPauseSettings = document.getElementById('btn-pause-settings');
  const btnAbandonJourney = document.getElementById('btn-abandon-journey');
  const btnReturnTitle = document.getElementById('btn-return-title');
  
  // Credits Modal Elements
  const btnCloseCredits = document.getElementById('btn-close-credits');
  const creditsModal = document.getElementById('credits-modal');
  
  // Ending Modal Elements
  const btnKeepDrifting = document.getElementById('btn-keep-drifting');
  const endingModal = document.getElementById('ending-modal');
  
  // Check if dev mode is enabled via URL parameter
  const isDevMode = new URLSearchParams(window.location.search).has('dev');

  function bind() {
    // Check save state to configure title screen
    const saveExists = hasSave();
    
    if (saveExists) {
      btnContinueJourney.classList.remove('hidden');
      btnNewJourney.textContent = 'New Journey';
    } else {
      btnContinueJourney.classList.add('hidden');
      btnNewJourney.textContent = 'New Journey';
    }

    // Title Screen Interactions
    if (btnNewJourney) {
      btnNewJourney.addEventListener('click', () => startNewJourney());
    }
    
    if (btnContinueJourney) {
      btnContinueJourney.addEventListener('click', () => continueJourney());
    }
    
    if (btnSettingsTitle) {
      btnSettingsTitle.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
      });
    }
    
    if (btnCreditsTitle) {
      btnCreditsTitle.addEventListener('click', () => {
        creditsModal.classList.remove('hidden');
      });
    }

    // Start Screen (legacy Continue flow)
    const startLoading = document.getElementById('start-loading');

    if (saveExists) {
      btnStart.textContent = "Continue Journey";
      btnDeleteSave.classList.remove('hidden');
    } else {
      btnStart.textContent = "New Journey";
      btnDeleteSave.classList.add('hidden');
    }

    // Reveal the start button only after we've set the correct label
    if (btnStart) {
      btnStart.classList.remove('hidden');
      if (startLoading) startLoading.classList.add('hidden');
    }

    // Delete Save Interaction
    if (btnDeleteSave) {
      btnDeleteSave.addEventListener('click', () => {
        if (confirm("Are you sure you want to delete your saved journey? This cannot be undone.")) {
          deleteSave();
          window.location.reload();
        }
      });
    }

    // Start Game Interaction (from start-screen)
    btnStart.addEventListener('click', () => {
      startScreen.classList.remove('active-flex');
      startScreen.classList.add('fade-out');
      setTimeout(() => startScreen.style.display = 'none', 500);

      gameHud.style.display = 'flex';
      
      // Ensure consistent start conditions
      state.dayTime = 0.25;
      state.isPlaying = true;
      state.tileSize = 32;
      if (renderer && typeof renderer.clearCache === 'function') renderer.clearCache();

      if (state.player) {
        state.camera.x = state.player.x;
        state.camera.y = state.player.y;
        state.cameraLocked = true;
      } else {
        state.camera.x = 0;
        state.camera.y = 0;
      }
    });

    // Settings Toggle (in-game)
    btnSettingsToggle.addEventListener('click', () => {
      settingsModal.classList.remove('hidden');
    });

    btnCloseSettings.addEventListener('click', () => {
      settingsModal.classList.add('hidden');
    });

    // Pause Menu
    btnPause.addEventListener('click', () => {
      pauseMenu.classList.remove('hidden');
      state.isPlaying = false; // Pause simulation
    });

    btnClosePause.addEventListener('click', () => {
      pauseMenu.classList.add('hidden');
      if (!state.freePlayMode || state.endingTriggered) {
        state.isPlaying = true; // Resume simulation
      }
    });

    btnResume.addEventListener('click', () => {
      pauseMenu.classList.add('hidden');
      if (!state.freePlayMode || state.endingTriggered) {
        state.isPlaying = true;
      }
    });

    btnPauseSettings.addEventListener('click', () => {
      pauseMenu.classList.add('hidden');
      settingsModal.classList.remove('hidden');
    });

    btnAbandonJourney.addEventListener('click', () => {
      if (confirm("Abandon this journey? Your progress will be saved, but you'll return to the title screen.")) {
        pauseMenu.classList.add('hidden');
        saveGame(state);
        returnToTitle();
      }
    });

    btnReturnTitle.addEventListener('click', () => {
      pauseMenu.classList.add('hidden');
      saveGame(state);
      returnToTitle();
    });

    // Credits Modal
    btnCloseCredits.addEventListener('click', () => {
      creditsModal.classList.add('hidden');
    });

    // Ending Modal
    btnKeepDrifting.addEventListener('click', () => {
      endingModal.classList.add('hidden');
      state.isPlaying = true; // Resume in free play mode
      state.freePlayMode = true;
      state.endingTriggered = false;
      // Re-enable auto-drift
      if (state.player) {
        state.player.speed = state.player.targetSpeed;
      }
    });

    // Speed button behavior: press/hold to enable multiplier
    const btnSpeed = document.getElementById('btn-speed');
    if (btnSpeed) {
      btnSpeed.addEventListener('mousedown', () => { state.speedMultiplier = 10; });
      window.addEventListener('mouseup', () => { state.speedMultiplier = 1; });
      btnSpeed.addEventListener('touchstart', (e) => { e.preventDefault(); state.speedMultiplier = 10; }, { passive: false });
      btnSpeed.addEventListener('touchend', () => { state.speedMultiplier = 1; });
    }

    // Stop/Start button: pause/resume the raft movement (does not stop rendering)
    const btnStopStart = document.getElementById('btn-stopstart');
    if (btnStopStart) {
      if (state._playerPaused === undefined) state._playerPaused = false;
      if (state._savedPlayerSpeed === undefined) state._savedPlayerSpeed = null;

      const updateStopLabel = () => {
        btnStopStart.textContent = state._playerPaused ? 'GO' : 'STOP';
      };

      btnStopStart.addEventListener('click', () => {
        state._playerPaused = !state._playerPaused;
        if (state._playerPaused) {
          state._savedPlayerSpeed = state.player ? state.player.speed : 0;
          if (state.player) state.player.speed = 0;
        } else {
          if (state.player) state.player.speed = (state._savedPlayerSpeed != null) ? state._savedPlayerSpeed : state.player.targetSpeed;
          state._savedPlayerSpeed = null;
        }
        updateStopLabel();
      });
      updateStopLabel();
    }

    // Day speed toggle: quickly speed up or restore day/night progression
    const btnDaySpeed = document.getElementById('btn-dayspeed');
    if (btnDaySpeed) {
      if (state._daySpeedFast === undefined) state._daySpeedFast = false;
      if (state._origDaySpeed === undefined) state._origDaySpeed = state.daySpeed;

      const updateDayLabel = () => {
        btnDaySpeed.textContent = state._daySpeedFast ? 'DAY×10' : 'DAY×1';
      };

      btnDaySpeed.addEventListener('click', () => {
        state._daySpeedFast = !state._daySpeedFast;
        if (state._daySpeedFast) {
          state._origDaySpeed = state.daySpeed || 0.01;
          state.daySpeed = state._origDaySpeed * 10;
        } else {
          state.daySpeed = state._origDaySpeed || 0.01;
        }
        updateDayLabel();
      });
      updateDayLabel();
    }

    // Build Settings Controls
    buildSettings();

    // Create sub-UIs
    inventoryUI = createInventoryUI({ state, container: document.getElementById('inventory-main-display') });
    const collectionUI = createCollectionUI({ state, container });
    const customizationUI = createCustomizationUI({ state, container });
    const notifications = createNotificationSystem();
    
    // Attach to state for easy access from game logic
    state.notifications = notifications;

    // Dev Panel Toggle - only show if dev mode enabled
    const btnDevToggle = document.getElementById('btn-dev-toggle');
    const devPanel = document.getElementById('dev-panel');
    if (btnDevToggle && devPanel) {
      if (isDevMode) {
        btnDevToggle.classList.remove('hidden');
        btnDevToggle.addEventListener('click', () => {
          devPanel.classList.toggle('hidden');
        });
      } else {
        btnDevToggle.classList.add('hidden');
        devPanel.classList.add('hidden');
      }
    }

    // Weather Control Binding
    const weatherSlider = document.getElementById('dev-weather-slider');
    if (weatherSlider) {
      weatherSlider.addEventListener('input', (e) => {
        state.weather._manualOverride = true;
        state.weather.precipIntensity = parseFloat(e.target.value);
      });
    }

    // Add collection button to HUD
    const btnCollection = document.createElement('button');
    btnCollection.id = 'btn-collection';
    btnCollection.className = 'btn-icon';
    btnCollection.innerHTML = '<span style="font-weight:700;">📖</span>';
    btnCollection.addEventListener('click', () => collectionUI.open());
    document.querySelector('.bottom-bar')?.appendChild(btnCollection);

    // Add dock button to HUD
    const btnDock = document.createElement('button');
    btnDock.id = 'btn-dock';
    btnDock.className = 'btn-icon';
    btnDock.innerHTML = '<span style="font-weight:700;">⚓</span>';
    btnDock.addEventListener('click', () => customizationUI.open());
    document.querySelector('.bottom-bar')?.appendChild(btnDock);

    // Create relic counter in top bar (visible from start, shows 0/4)
    createRelicCounter();
    
    // Apply saved settings
    applySettings();
    
    // Show ending modal if ending was just triggered
    if (state.endingTriggered && !endingModal.classList.contains('hidden')) {
      // Will be shown by game loop
    }
  }

  function startNewJourney() {
    // Delete any existing save and start fresh
    deleteSave();
    titleScreen.classList.remove('active-flex');
    titleScreen.classList.add('fade-out');
    setTimeout(() => titleScreen.style.display = 'none', 500);
    
    startScreen.classList.remove('active-flex');
    startScreen.classList.add('fade-out');
    setTimeout(() => startScreen.style.display = 'none', 500);
    
    gameHud.style.display = 'flex';
    
    // Reset state for new journey
    state.dayTime = 0.25;
    state.isPlaying = true;
    state.tileSize = 32;
    state.hasInitialized = false;
    state.endingSeen = false;
    state.endingTriggered = false;
    state.freePlayMode = false;
    state.discoveryMeter = { progress: 0, max: 100, pendingRelic: null };
    state.inventory = {};
    state.collection = {};
    state.raft = { ...state.raft }; // Keep raft customization
    
    if (renderer && typeof renderer.clearCache === 'function') renderer.clearCache();
    
    if (state.player) {
      state.camera.x = state.player.x;
      state.camera.y = state.player.y;
      state.cameraLocked = true;
    } else {
      state.camera.x = 0;
      state.camera.y = 0;
    }
  }

  function continueJourney() {
    titleScreen.classList.remove('active-flex');
    titleScreen.classList.add('fade-out');
    setTimeout(() => titleScreen.style.display = 'none', 500);
    
    startScreen.classList.remove('active-flex');
    startScreen.classList.add('fade-out');
    setTimeout(() => startScreen.style.display = 'none', 500);
    
    gameHud.style.display = 'flex';
    
    // Restore saved state (already loaded in createAppState)
    state.isPlaying = true;
    // Don't reset dayTime - keep saved time
    state.tileSize = state.tileSize || 32;
    
    if (renderer && typeof renderer.clearCache === 'function') renderer.clearCache();
    
    if (state.player) {
      state.camera.x = state.player.x;
      state.camera.y = state.player.y;
      state.cameraLocked = true;
    }
  }

  function returnToTitle() {
    gameHud.style.display = 'none';
    gameHud.classList.remove('fade-out');
    
    startScreen.style.display = 'none';
    startScreen.classList.remove('fade-out');
    
    titleScreen.style.display = 'flex';
    titleScreen.classList.remove('fade-out');
    titleScreen.classList.add('active-flex');
    
    state.isPlaying = false;
    
    // Update continue button visibility
    const saveExists = hasSave();
    if (saveExists) {
      btnContinueJourney.classList.remove('hidden');
    } else {
      btnContinueJourney.classList.add('hidden');
    }
  }

  function createRelicCounter() {
    const topBar = document.querySelector('.top-bar');
    if (!topBar) return;
    
    relicCounterEl = document.createElement('div');
    relicCounterEl.id = 'relic-counter';
    relicCounterEl.className = 'relic-counter';
    relicCounterEl.innerHTML = `
      <span class="relic-counter-icon">✦</span>
      <span class="relic-counter-text">0 / 4</span>
    `;
    topBar.appendChild(relicCounterEl);
    updateRelicCounter();
  }

  function updateRelicCounter() {
    if (!relicCounterEl || !game) return;
    
    const count = game.getRelicCount ? game.getRelicCount() : 0;
    const total = game.getTotalRelics ? game.getTotalRelics() : 4;
    
    const textEl = relicCounterEl.querySelector('.relic-counter-text');
    if (textEl) {
      textEl.textContent = `${count} / ${total}`;
    }
    
    // Nudge animation when only one relic remains
    if (count === total - 1 && !relicCounterNudged && count > 0) {
      relicCounterEl.classList.add('nudge');
      relicCounterNudged = true;
      setTimeout(() => relicCounterEl.classList.remove('nudge'), 500);
    }
  }

  function buildSettings() {
    settingsContainer.innerHTML = '';
    
    const controls = [
      {
        id: 'setting-volume',
        label: 'Master Volume',
        type: 'range',
        min: 0,
        max: 1,
        step: 0.05,
        value: state.settings.masterVolume,
        onChange: (e) => {
          state.settings.masterVolume = parseFloat(e.target.value);
          // Apply to audio when implemented
        }
      },
      {
        id: 'setting-muted',
        label: 'Mute',
        type: 'checkbox',
        checked: state.settings.muted,
        onChange: (e) => {
          state.settings.muted = e.target.checked;
          // Apply to audio when implemented
        }
      },
      {
        id: 'setting-reduced-motion',
        label: 'Reduced Motion',
        type: 'checkbox',
        checked: state.settings.reducedMotion,
        onChange: (e) => {
          state.settings.reducedMotion = e.target.checked;
          document.body.classList.toggle('reduced-motion', e.target.checked);
        }
      },
      {
        id: 'setting-text-size',
        label: 'Text Size',
        type: 'range',
        min: 0.8,
        max: 1.5,
        step: 0.1,
        value: state.settings.textSize,
        onChange: (e) => {
          state.settings.textSize = parseFloat(e.target.value);
          document.documentElement.style.setProperty('--text-scale', state.settings.textSize);
        }
      }
    ];
    
    controls.forEach(control => {
      const row = document.createElement('div');
      row.className = 'control-row';
      
      const label = document.createElement('label');
      label.htmlFor = control.id;
      label.textContent = control.label;
      row.appendChild(label);
      
      const input = document.createElement('input');
      input.id = control.id;
      input.type = control.type;
      if (control.type === 'range') {
        input.min = control.min;
        input.max = control.max;
        input.step = control.step;
        input.value = control.value;
      } else if (control.type === 'checkbox') {
        input.checked = control.checked;
      }
      input.addEventListener('input', control.onChange);
      row.appendChild(input);
      
      settingsContainer.appendChild(row);
    });
  }

  function applySettings() {
    // Apply reduced motion
    if (state.settings.reducedMotion) {
      document.body.classList.add('reduced-motion');
    }
    // Apply text size
    document.documentElement.style.setProperty('--text-scale', state.settings.textSize);
    // Apply volume/mute when audio is implemented
  }

  function update(dt) {
    if (!state.isPlaying && !state.freePlayMode) return;

    if (inventoryUI) inventoryUI.render();
    updateRelicCounter();

    // Time of day display (24h clock mapped to dayTime 0..1)
    if (uiTime) {
      const totalMinutes = state.dayTime * 24 * 60;
      let hours = Math.floor(totalMinutes / 60) % 24;
      let minutes = Math.floor(totalMinutes % 60);
      const hh = hours.toString().padStart(2, '0');
      const mm = minutes.toString().padStart(2, '0');
      uiTime.textContent = `${hh}:${mm}`;
    }
    
    // Check if ending was triggered and show modal
    if (state.endingTriggered && endingModal) {
      endingModal.classList.remove('hidden');
    }
  }

  return { bind, update };
}