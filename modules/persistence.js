// Persistence module for saving/loading game state to localStorage

const SAVE_KEY = 'cosy_current_save_v1';
const SAVE_VERSION = 2;

export function hasSave() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);

    // Migration from v1 to v2
    if (!data.version || data.version < 2) {
      // v2 additions: endingSeen, freePlayMode, discoveryMeter, settings, onboardingSeen, tileSize
      data.endingSeen = data.endingSeen || false;
      data.freePlayMode = data.freePlayMode || false;
      data.discoveryMeter = data.discoveryMeter || { progress: 0, max: 100, pendingRelic: null };
      data.settings = data.settings || { masterVolume: 0.35, muted: false, reducedMotion: false, textSize: 1.0 };
      data.onboardingSeen = data.onboardingSeen || false;
      data.tileSize = data.tileSize || 64;
      data.version = SAVE_VERSION;
    }

    // Backfill new containers for older save files
    if (!data.inventory) data.inventory = {};
    if (!data.collection) data.collection = {};
    if (!data.raft) data.raft = {};

    return data;
  } catch (e) {
    console.error("Failed to load save", e);
    return null;
  }
}

export function saveGame(state) {
  if (!state || !state.player) return;

  const data = {
    version: SAVE_VERSION,
    timestamp: Date.now(),
    seed: state.seed,
    dayTime: state.dayTime,
    // Only save essential player data (position/angle), derived physics props reset on load
    player: {
      x: state.player.x,
      y: state.player.y,
      angle: state.player.angle
    },
    // Future-proofing fields
    inventory: state.inventory || {},
    collection: state.collection || {},
    raft: state.raft || {},
    // Flag to indicate this is an initialized world
    hasInitialized: true,
    // Ending & progression
    endingSeen: state.endingSeen || false,
    freePlayMode: state.freePlayMode || false,
    discoveryMeter: state.discoveryMeter || { progress: 0, max: 100, pendingRelic: null },
    // Settings
    settings: state.settings || { masterVolume: 0.35, muted: false, reducedMotion: false, textSize: 1.0 },
    // Onboarding
    onboardingSeen: state.onboardingSeen || false,
    // UI state
    tileSize: state.tileSize || 64
  };

  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save game", e);
  }
}

export function deleteSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    console.error("Failed to delete save", e);
  }
}