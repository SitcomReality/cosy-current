import { PERM } from './permutations.js';

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t, a, b) { return a + t * (b - a); }
function grad(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

export function perlin3(x, y, z) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;

  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);

  const u = fade(x);
  const v = fade(y);
  const w = fade(z);

  const A = PERM[X] + Y, AA = PERM[A] + Z, AB = PERM[A + 1] + Z;
  const B = PERM[X + 1] + Y, BA = PERM[B] + Z, BB = PERM[B + 1] + Z;

  return lerp(w, lerp(v, lerp(u, grad(PERM[AA], x, y, z),
                                 grad(PERM[BA], x - 1, y, z)),
                         lerp(u, grad(PERM[AB], x, y - 1, z),
                                 grad(PERM[BB], x - 1, y - 1, z))),
                 lerp(v, lerp(u, grad(PERM[AA + 1], x, y, z - 1),
                                 grad(PERM[BA + 1], x - 1, y, z - 1)),
                         lerp(u, grad(PERM[AB + 1], x, y - 1, z - 1),
                                 grad(PERM[BB + 1], x - 1, y - 1, z - 1))));
}

