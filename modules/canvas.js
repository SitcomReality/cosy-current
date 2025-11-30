export function createRenderer({ canvas, state, noise }) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = state.pixelRatio;
    const rect = canvas.getBoundingClientRect();
    state.width = rect.width || window.innerWidth;
    state.height = rect.height || window.innerHeight;

    canvas.width = state.width * dpr;
    canvas.height = state.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function renderFrame(timestamp) {
    state.time = timestamp * 0.001 * state.speed;

    ctx.clearRect(0, 0, state.width, state.height);

    // Simple sample visualization using noise value to set gray value.
    const step = 8;
    for (let y = 0; y < state.height; y += step) {
      for (let x = 0; x < state.width; x += step) {
        const n = noise.sample(x * state.scale, y * state.scale, state.time);
        const g = Math.floor(((n + 1) / 2) * 255);
        ctx.fillStyle = `rgb(${g},${g},${g})`;
        ctx.fillRect(x, y, step, step);
      }
    }

    state.animationId = requestAnimationFrame(renderFrame);
  }

  function start() {
    resize();
    window.addEventListener('resize', resize);
    state.animationId = requestAnimationFrame(renderFrame);
  }

  function stop() {
    if (state.animationId != null) {
      cancelAnimationFrame(state.animationId);
      state.animationId = null;
    }
    window.removeEventListener('resize', resize);
  }

  return { start, stop, resize };
}