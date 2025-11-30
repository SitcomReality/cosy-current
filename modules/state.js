export function createAppState() {
  return {
    // Rendering state
    width: 0,
    height: 0,
    pixelRatio: window.devicePixelRatio || 1,
    animationId: null,

    // Game Settings
    tileSize: 32, // Pixels per tile
    
    // World State
    camera: { x: 0, y: 0 },
    seed: Date.now(),
    
    // Game Data
    entities: [],
    funds: 0,
    population: 0,
    
    // Noise Settings
    noiseType: 'fbm-perlin',
    scale: 0.05,
    speed: 1.0,
    time: 0
  };
}