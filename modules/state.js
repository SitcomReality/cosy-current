export function createAppState() {
  return {
    // Rendering state
    width: 0,
    height: 0,
    pixelRatio: window.devicePixelRatio || 1,
    animationId: null,

    // App Flow
    isPlaying: false,

    // Game Settings
    tileSize: 48, // Larger tiles for better visibility
    
    // World State
    camera: { x: 0, y: 0 },
    seed: Date.now(),
    
    // Game Data
    entities: [],
    funds: 0,
    population: 0,
    
    // Noise Settings
    noiseType: 'fbm-perlin',
    scale: 0.03, // Smoother default
    speed: 0.5, // Slower default
    time: 0
  };
}