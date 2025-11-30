export function createUI({ container, state, renderer, noise, game }) {
  
  // Cache DOM elements
  const startScreen = document.getElementById('start-screen');
  const gameHud = document.getElementById('game-hud');
  const btnStart = document.getElementById('btn-start');
  const fundsEl = document.getElementById('ui-funds');
  const popEl = document.getElementById('ui-pop');
  
  // Settings Modal Elements
  const btnSettingsToggle = document.getElementById('btn-settings-toggle');
  const settingsModal = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const settingsContainer = document.getElementById('settings-controls-container');

  function bind() {
    // Start Game Interaction
    btnStart.addEventListener('click', () => {
      // Transition UI
      startScreen.classList.remove('active-flex');
      startScreen.classList.add('fade-out');
      setTimeout(() => startScreen.style.display = 'none', 500);

      gameHud.style.display = 'flex'; // Prepare flex layout
      // Small delay to allow display:flex to apply before opacity transition if we added one
      
      // Update State
      state.isPlaying = true;
      state.camera.x = 0;
      state.camera.y = 0;
    });

    // Settings Toggle
    btnSettingsToggle.addEventListener('click', () => {
      settingsModal.classList.remove('hidden');
    });

    btnCloseSettings.addEventListener('click', () => {
      settingsModal.classList.add('hidden');
    });

    // Build Settings Controls
    buildSettings();
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

    // 1. Noise Type
    const typeSelect = document.createElement('select');
    ['perlin', 'simplex', 'fbm-perlin', 'fbm-simplex'].forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t.toUpperCase();
      if (state.noiseType === t) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener('change', () => noise.setType(typeSelect.value));
    createRow('Terrain Algorithm', typeSelect);

    // 2. Scale
    const scaleInput = document.createElement('input');
    scaleInput.type = 'range';
    scaleInput.min = '0.005';
    scaleInput.max = '0.1';
    scaleInput.step = '0.001';
    scaleInput.value = state.scale;
    scaleInput.addEventListener('input', () => state.scale = parseFloat(scaleInput.value));
    createRow('Terrain Scale', scaleInput);

    // 3. Time Speed
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

    // Simple formatted numbers
    fundsEl.textContent = Math.floor(state.funds).toLocaleString();
    popEl.textContent = state.population.toLocaleString();
  }

  return { bind, update };
}