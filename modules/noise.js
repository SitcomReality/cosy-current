import { perlin3 } from './noise_algorithms/perlin.js';
import { simplex3 } from './noise_algorithms/simplex.js';
import { fbm3 } from './noise_algorithms/fbm.js';
import { seedPermutation } from './noise_algorithms/permutations.js';

export function createNoiseEngine(state) {
  // Configurable options could be exposed here or in state
  const config = {
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0
  };

  // Reseed on load with a random seed or fixed one
  seedPermutation(Date.now());

  function sample(x, y, t = 0) {
    let val = 0;
    
    // Choose algorithm based on state
    switch (state.noiseType) {
      case 'simplex':
        val = simplex3(x, y, t);
        break;
      case 'perlin':
        val = perlin3(x, y, t);
        break;
      case 'fbm-simplex':
        val = fbm3(x, y, t, simplex3, config);
        break;
      case 'fbm-perlin':
      default:
        val = fbm3(x, y, t, perlin3, config);
        break;
    }
    
    return val; // Returns approx -1 to 1 range
  }

  function setType(type) {
    state.noiseType = type;
  }

  return {
    sample,
    setType
  };
}