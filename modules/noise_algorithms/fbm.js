export function fbm3(x, y, z, noiseFunc, { octaves = 4, persistence = 0.5, lacunarity = 2 } = {}) {
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0;

  for(let i = 0; i < octaves; i++) {
    total += noiseFunc(x * frequency, y * frequency, z * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  
  return total / maxValue;
}

