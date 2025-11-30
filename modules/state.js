export function createAppState() {
  return {
    width: 0,
    height: 0,
    pixelRatio: window.devicePixelRatio || 1,
    animationId: null,

    // Example noise-related state
    noiseType: 'fbm-perlin', // Default to a nicer looking noise
    scale: 0.01,
    speed: 0.5,
    time: 0
  };
}