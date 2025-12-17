import { hasSave, deleteSave } from './persistence.js';
import { createInventoryUI } from './ui/inventory.js';
import { createCollectionUI } from './ui/collection.js';
import { createCustomizationUI } from './ui/customization.js';
import { createNotificationSystem } from './ui/notifications.js';
import { ITEM_REGISTRY } from './data/items.js';

export function createUI({ container, state, renderer, noise, game }) {
  
  // Cache DOM elements
  const startScreen = document.getElementById('start-screen');
  const gameHud = document.getElementById('game-hud');
  const btnStart = document.getElementById('btn-start');
  const btnDeleteSave = document.getElementById('btn-delete-save');
  const uiScrap = document.getElementById('ui-scrap');
  const uiFuel = document.getElementById('ui-fuel');
  const uiBio = document.getElementById('ui-bio');
  const uiTime = document.getElementById('ui-time');
  
  // Settings Modal Elements
  const btnSettingsToggle = document.getElementById('btn-settings-toggle');
  const settingsModal = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const settingsContainer = document.getElementById('settings-controls-container');

  function bind() {
    // Check save state to configure menu
    const saveExists = hasSave();

    // Ensure loading placeholder exists so we can hide it when ready
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
      // Hide the small loading placeholder if present
      if (startLoading) startLoading.classList.add('hidden');
    }

    // Delete Save Interaction
    if (btnDeleteSave) {
      btnDeleteSave.addEventListener('click', () => {
        if (confirm("Are you sure you want to delete your saved journey? This cannot be undone.")) {
          deleteSave();
          // Reload to ensure clean state reset
          window.location.reload();
        }
      });
    }

    // Start Game Interaction
    btnStart.addEventListener('click', () => {
      // Transition UI
      startScreen.classList.remove('active-flex');
      startScreen.classList.add('fade-out');
      setTimeout(() => startScreen.style.display = 'none', 500);

      gameHud.style.display = 'flex'; // Prepare flex layout
      // Small delay to allow display:flex to apply before opacity transition if we added one
      
      // Update State
      // Ensure consistent start conditions: set time to 6:00 and snap camera to player to avoid pan.
      state.dayTime = 0.25;
      state.isPlaying = true;
      // Start the game zoomed out to the maximum zoom-out level
      // Minimum allowed tileSize is 32 (enforced elsewhere), so set it here.
      state.tileSize = 32;
      // Clear renderer caches so chunks redraw at new tileSize
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

    // Settings Toggle
    btnSettingsToggle.addEventListener('click', () => {
      settingsModal.classList.remove('hidden');
    });

    btnCloseSettings.addEventListener('click', () => {
      settingsModal.classList.add('hidden');
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
      // initialize helper flags on state if missing
      if (state._playerPaused === undefined) state._playerPaused = false;
      if (state._savedPlayerSpeed === undefined) state._savedPlayerSpeed = null;

      const updateStopLabel = () => {
        btnStopStart.querySelector('span').textContent = state._playerPaused ? 'GO' : 'STOP';
      };

      btnStopStart.addEventListener('click', () => {
        state._playerPaused = !state._playerPaused;
        if (state._playerPaused) {
          // save current speed and zero it
          state._savedPlayerSpeed = state.player ? state.player.speed : 0;
          if (state.player) state.player.speed = 0;
        } else {
          // restore saved speed if present, otherwise leave at targetSpeed
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
        btnDaySpeed.querySelector('span').textContent = state._daySpeedFast ? 'DAY×10' : 'DAY×1';
      };

      btnDaySpeed.addEventListener('click', () => {
        state._daySpeedFast = !state._daySpeedFast;
        if (state._daySpeedFast) {
          // increase daySpeed for faster cycles
          state._origDaySpeed = state.daySpeed || 0.01;
          state.daySpeed = state._origDaySpeed * 10;
        } else {
          // restore original daySpeed
          state.daySpeed = state._origDaySpeed || 0.01;
        }
        updateDayLabel();
      });
      updateDayLabel();
    }

    // Build Settings Controls
    buildSettings();

    // Create sub-UIs
    const inventoryUI = createInventoryUI({ state, container });
    const collectionUI = createCollectionUI({ state, container });
    const customizationUI = createCustomizationUI({ state, container });
    const notifications = createNotificationSystem();
    
    // Attach to state for easy access from game logic
    state.notifications = notifications;

    // Add inventory button to HUD
    const btnInventory = document.createElement('button');
    btnInventory.id = 'btn-inventory';
    btnInventory.className = 'btn-icon';
    btnInventory.innerHTML = '<span style="font-weight:700;">BAG</span>';
    btnInventory.addEventListener('click', () => inventoryUI.open());
    document.querySelector('.bottom-bar')?.appendChild(btnInventory);

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
  }

  function buildSettings() {
    settingsContainer.innerHTML = '';

    // Helper to create control rows
    const createRow = (label, element) => {
      const div = document.createElement('div');
      div.className = 'control-row';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      div.appendChild(lbl);
      div.appendChild(element);
      settingsContainer.appendChild(div);
    };

    // Removed Terrain Scale control (default now set in state)

    // Time / evolution speed
    const speedInput = document.createElement('input');
    speedInput.type = 'range';
    speedInput.min = '0';
    speedInput.max = '2.0';
    speedInput.step = '0.1';
    speedInput.value = state.speed;
    speedInput.addEventListener('input', () => state.speed = parseFloat(speedInput.value));
    createRow('Evolution Speed', speedInput);
  }

  function update(dt) {
    if (!state.isPlaying) return;

    // Resources
    uiScrap.textContent = Math.floor(state.resources.scrap);
    uiFuel.textContent = Math.floor(state.resources.fuel);
    uiBio.textContent = Math.floor(state.resources.bio);
    
    // Optional: Warn low fuel
    if (state.resources.fuel < 20) uiFuel.style.color = '#ef4444';
    else uiFuel.style.color = 'inherit';

    // Time of day display (24h clock mapped to dayTime 0..1)
    if (uiTime) {
      const totalMinutes = state.dayTime * 24 * 60;
      let hours = Math.floor(totalMinutes / 60) % 24;
      let minutes = Math.floor(totalMinutes % 60);
      const hh = hours.toString().padStart(2, '0');
      const mm = minutes.toString().padStart(2, '0');
      uiTime.textContent = `${hh}:${mm}`;
    }
  }

  return { bind, update };
}