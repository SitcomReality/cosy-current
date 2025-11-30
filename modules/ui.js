export function createUI({ container, state, renderer, noise }) {
  function bind() {
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'row';
    wrapper.style.gap = '0.5rem';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';

    // Noise type selector
    const select = document.createElement('select');
    ['perlin', 'simplex', 'fbm-perlin', 'fbm-simplex'].forEach((type) => {
      const opt = document.createElement('option');
      opt.value = type;
      opt.textContent = type;
      if (state.noiseType === type) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => {
      noise.setType(select.value);
    });

    // Scale control
    const scaleInput = document.createElement('input');
    scaleInput.type = 'range';
    scaleInput.min = '0.002';
    scaleInput.max = '0.05';
    scaleInput.step = '0.001';
    scaleInput.value = String(state.scale);
    scaleInput.addEventListener('input', () => {
      state.scale = parseFloat(scaleInput.value) || state.scale;
    });

    // Speed control
    const speedInput = document.createElement('input');
    speedInput.type = 'range';
    speedInput.min = '0.1';
    speedInput.max = '3';
    speedInput.step = '0.1';
    speedInput.value = String(state.speed);
    speedInput.addEventListener('input', () => {
      state.speed = parseFloat(speedInput.value) || state.speed;
    });

    wrapper.appendChild(select);
    wrapper.appendChild(scaleInput);
    wrapper.appendChild(speedInput);

    container.appendChild(wrapper);
  }

  return { bind };
}