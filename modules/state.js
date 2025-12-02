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
    tileSize: 64, // Increased from 12 to 64 for zoom/performance
    
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
      targetSpeed: 2.5, // Reduced from 8.0 for slower pacing with larger tiles
      roadState: 'cruising', // cruising, intersection
      targetAngle: 0, // Smoothed steering target

      // Flow-lock for improved river navigation (anticipatory turn locking)
      flowLockActive: false,
      flowLockAngle: 0,
      flowLockTimer: 0
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
    time: 0,

    // Gameplay modifiers
    speedMultiplier: 1 // Multiplies movement & acceleration when active (e.g. 10 when holding speed-up)
  };
}