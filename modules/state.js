import { DEFAULT_RAFT } from './game/constants.js';

export function createAppState(savedData = null) {
  const state = {
    // Rendering state
    width: 0,
    height: 0,
    pixelRatio: window.devicePixelRatio || 1,
    animationId: null,

    // App Flow
    isPlaying: false,
    hasInitialized: false, // Tracks if initial spawn/generation has happened

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
    

    // Future-proof storage containers
    inventory: {},
    collection: {},
    raft: Object.assign({}, DEFAULT_RAFT),

    entities: [],
    collectables: [],
    
    // Noise Settings
    // We keep scale/speed configurable but use a single terrain technique internally
    noiseType: 'fbm-perlin',
    scale: 0.05, // Increased default scale for larger, smoother features
    speed: 0.2, // Slower time evolution
    time: 0,
    
    // Day/Night Cycle
    dayTime: 0.25, // Start at 6:00 (0.25) for consistent morning start
    daySpeed: 0.00333, // ~300 second day (5 minutes)

    // Gameplay modifiers
    speedMultiplier: 1, // Multiplies movement & acceleration when active (e.g. 10 when holding speed-up)

    // Dynamic Weather State
    weather: {
      precipIntensity: 0, // 0.0 to 1.0
      // Global wind vector. x/y are the unit-ish screen/world direction times
      // strength; angle is radians (0 = east, PI/2 = south).
      wind: { x: 0, y: 0, strength: 0, angle: 0 },
      stormBearing: 0,    // radians: where the storm/lightning is coming from
      lightning: {
        flash: 0,         // 0..1 current flash brightness
        dirX: 0,          // unit vector toward the strike
        dirY: 1,
        // True from the strike until the last after-pulse has faded. This is a
        // binary light-source state, deliberately not a continuous blend, so
        // shadows and the headlamp never tween between two light sources.
        sunActive: false,
        timer: 3,         // seconds until the next possible strike
        pulses: [],       // queued secondary flashes { delay, strength }
        boltSeed: 0,
        lastStrike: 0,
        force: false      // dev/scenario one-shot trigger
      },
      auto: true,         // automatic fronts; false = dev sliders control it
      _weatherTime: 0,    // internal clock for fronts (not persisted)
      _renderState: null  // Runtime cache for particles
    },

    // Ending & Progression
    endingSeen: false,
    endingTriggered: false,
    freePlayMode: false,
    
    // Discovery meter (for relic guarantees)
    discoveryMeter: {
      progress: 0,
      max: 100,
      pendingRelic: null
    },
    
    // Settings (persisted)
    settings: {
      masterVolume: 0.35,
      muted: false,
      reducedMotion: false,
      textSize: 1.0
    },

    // Developer-only renderer experiments. Not persisted; toggled from the
    // dev panel or seeded from the URL (?dev&terrain=polygon&shading=world).
    devOptions: {
      terrainMode: 'hull', // hull | polygon | hybrid
      hybridRing: 1,       // tiles of exact terrain at chunk borders in hybrid mode
      shadingMode: 'baked' // baked | world | flat
    },
    
    // Onboarding
    onboardingSeen: false
  };

  // Merge saved data if provided
  if (savedData) {
    state.seed = savedData.seed;
    state.hasInitialized = !!savedData.hasInitialized;
    if (typeof savedData.dayTime === 'number') state.dayTime = savedData.dayTime;
    
    if (savedData.player) {
      state.player.x = savedData.player.x;
      state.player.y = savedData.player.y;
      state.player.angle = savedData.player.angle;
    }


    if (savedData.inventory) state.inventory = savedData.inventory;
    if (savedData.collection) state.collection = savedData.collection;
    
    // Merge saved raft config with defaults to ensure new fields (like lightType) exist
    if (savedData.raft) {
      Object.assign(state.raft, savedData.raft);
    }
    
    // Restore ending/progression state
    if (typeof savedData.endingSeen === 'boolean') state.endingSeen = savedData.endingSeen;
    if (typeof savedData.freePlayMode === 'boolean') state.freePlayMode = savedData.freePlayMode;
    if (savedData.discoveryMeter) {
      Object.assign(state.discoveryMeter, savedData.discoveryMeter);
    }
    if (savedData.settings) {
      Object.assign(state.settings, savedData.settings);
    }
    if (typeof savedData.onboardingSeen === 'boolean') state.onboardingSeen = savedData.onboardingSeen;
    if (typeof savedData.tileSize === 'number') state.tileSize = savedData.tileSize;
  }

  return state;
}