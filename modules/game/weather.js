import { createNoiseEngine } from '../noise.js'; // Assuming we pass the instance, but if needed we can use utils

export function createWeatherSystem(state, noise) {
  
  function update(dt) {
    // We rely on a continuous time variable. 
    // If state.time is not updating in app.js, we should ensure it does, 
    // or use state.dayTime if it flows continuously (it does, but wraps).
    // Better to use state.time accumulator.
    const t = state.time || 0;

    // 1. Precipitation Logic
    // Use low-frequency noise to simulate gradual shifts in weather fronts.
    // noise.sample returns approx -1 to 1.
    // We want long periods of dry, transitioning into rain.
    const rawPrecip = noise.sample(t * 0.03, 1234); 
    
    // Ensure we always have a local precip variable to reference later.
    // Start with current state value as a safe baseline.
    let precip = state.weather && typeof state.weather.precipIntensity === 'number'
      ? state.weather.precipIntensity
      : 0;

    // If the dev-panel is controlling weather, we might want to override.
    // However, for this implementation, we'll let the noise drive it unless 
    // the user has recently adjusted the slider (which would be handled in ui.js).
    // Actually, let's make the auto-weather logic only run if intensity is low 
    // or provide a "manual" override flag.
    // For now, simple implementation: UI overrides the state directly.
    // To allow the auto-weather to work, we'll only update if not being overridden.
    if (!state.weather._manualOverride) {
      precip = 0;
      if (rawPrecip > 0.2) {
        precip = (rawPrecip - 0.2) / 0.8; 
      }
      if (precip > 0) {
        const variation = noise.sample(t * 0.2, 4321);
        precip = Math.max(0, Math.min(1, precip + variation * 0.2));
      }
      state.weather.precipIntensity = precip;
    }

    // 2. Wind Logic
    // "Naturally-seeming", tending to 0, sometimes strong.
    // Base wind trend
    const wBase = noise.sample(t * 0.02, 5678);
    // Gustiness
    const wGust = noise.sample(t * 0.4, 8765);

    // Combine: mostly base, plus some gust. 
    // Sign-preserving power curve to tend towards 0.
    let w = wBase * 0.7 + wGust * 0.3;
    
    // Apply "tending towards 0" bias: squash low values, keep peaks.
    // Squaring the magnitude preserves the sign but reduces values < 1.
    const wSign = Math.sign(w);
    const wMag = Math.abs(w);
    w = wSign * Math.pow(wMag, 1.5); 

    // Storm effect: if raining heavily, wind volatility increases
    if (precip > 0.5) {
      // Amplify wind during storms
      w *= 1.4;
    }

    // Clamp -1 to 1
    state.weather.wind = Math.max(-1, Math.min(1, w));
  }

  return { update };
}

