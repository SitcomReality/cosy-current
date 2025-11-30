// A simple seeded permutation table generator
const PERM = new Uint8Array(512);

export function seedPermutation(seed = 12345) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;

  let v = seed;
  for (let i = 255; i > 0; i--) {
    v = (v * 16807) % 2147483647;
    const r = (v % (i + 1));
    const t = p[i];
    p[i] = p[r];
    p[r] = t;
  }

  for (let i = 0; i < 512; i++) {
    PERM[i] = p[i & 255];
  }
}

// Initialize with default
seedPermutation();

export { PERM };