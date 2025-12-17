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
    
    // Bias the noise so that > 0.3 becomes rain, allowing for ~65% dry time.
    // Remap: range [-1, 1] -> shifted [-1.3, 0.7] -> clamped [0, 1] scaling
    // Actually, let's map: values > 0.2 start raining.
    let precip = 0;
    if (rawPrecip > 0.2) {
      precip = (rawPrecip - 0.2) / 0.8; // Normalize 0.2..1.0 to 0..1
    }
    
    // Add a secondary layer for intensity variation within a storm
    if (precip > 0) {
      const variation = noise.sample(t * 0.2, 4321); // Faster variation
      precip = Math.max(0, Math.min(1, precip + variation * 0.2));
    }

    // Smooth transition in state
    // We just set it directly as the noise is continuous, but we can lerp if needed.
    state.weather.precipIntensity = precip;

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

