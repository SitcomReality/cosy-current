// Persistence module for saving/loading game state to localStorage

const SAVE_KEY = 'cosy_current_save_v1';

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
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load save", e);
    return null;
  }
}

export function saveGame(state) {
  if (!state || !state.player) return;

  const data = {
    version: 1,
    timestamp: Date.now(),
    seed: state.seed,
    dayTime: state.dayTime,
    // Only save essential player data (position/angle), derived physics props reset on load
    player: {
      x: state.player.x,
      y: state.player.y,
      angle: state.player.angle
    },
    resources: { ...state.resources },
    // Future-proofing fields
    inventory: state.inventory || {},
    collection: state.collection || {},
    raft: state.raft || {},
    // Flag to indicate this is an initialized world
    hasInitialized: true
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

