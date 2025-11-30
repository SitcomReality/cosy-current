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
    tileSize: 12, 
    
    // World State
    camera: { x: 0, y: 0 },
    cameraLocked: true,
    lastInputTime: 0,

    seed: Date.now(),
    
    // Game Data
    player: {
      x: 0,
      y: 0,
      angle: 0, // Radians
      speed: 0, // Tiles per second
      targetSpeed: 8.0, // Faster for larger world
      roadState: 'cruising' // cruising, intersection
    },
    
    resources: {
      scrap: 0,
      fuel: 100,
      bio: 0
    },

    entities: [],
    
    // Noise Settings
    // We keep scale/speed configurable but use a single terrain technique internally
    noiseType: 'fbm-perlin',
    scale: 0.05, // Increased default scale for larger, smoother features
    speed: 0.2, // Slower time evolution
    time: 0
  };
}