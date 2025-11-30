// These imports are placeholders assuming existing APIs in your noise files.
// Adjust calls in sample() to match the actual functions defined there.
import './perlin.js';
import './reality_noise.js';
import './old_noise.js';

export function createNoiseEngine(state) {
  function sample(x, y, t = 0) {
    // Replace with real calls into your existing noise implementations.
    // For now, this is a simple deterministic pseudo-noise as a placeholder.
    const v = Math.sin(x + t) * Math.cos(y - t);
    return v; // should be in [-1, 1]
  }

  function setType(type) {
    state.noiseType = type;
  }

  return {
    sample,
    setType
  };
}