import { PERM } from './permutations.js';

// Skew factors for 3D
const F3 = 1.0 / 3.0;
const G3 = 1.0 / 6.0;

// Gradient vectors for 3D (12 directions)
const grad3 = [
  [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
  [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
  [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
];

export function simplex3(x, y, z) {
  let n0, n1, n2, n3; 

  const s = (x + y + z) * F3;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const k = Math.floor(z + s);
  const t = (i + j + k) * G3;
  const X0 = i - t;
  const Y0 = j - t;
  const Z0 = k - t;
  const x0 = x - X0;
  const y0 = y - Y0;
  const z0 = z - Z0;

  // Determine which simplex we are in
  let i1, j1, k1; 
  let i2, j2, k2; 
  if (x0 >= y0) {
    if (y0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
    else if (x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
    else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
  } else { 
    if (y0 < z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
    else if (x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
    else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
  }

  const x1 = x0 - i1 + G3;
  const y1 = y0 - j1 + G3;
  const z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2.0 * G3;
  const y2 = y0 - j2 + 2.0 * G3;
  const z2 = z0 - k2 + 2.0 * G3;
  const x3 = x0 - 1.0 + 3.0 * G3;
  const y3 = y0 - 1.0 + 3.0 * G3;
  const z3 = z0 - 1.0 + 3.0 * G3;

  const ii = i & 255;
  const jj = j & 255;
  const kk = k & 255;

  // Calculate contributions
  let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
  if (t0 < 0) n0 = 0.0;
  else {
    const gi0 = PERM[ii+PERM[jj+PERM[kk]]] % 12;
    t0 *= t0;
    n0 = t0 * t0 * (grad3[gi0][0]*x0 + grad3[gi0][1]*y0 + grad3[gi0][2]*z0);
  }

  let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
  if (t1 < 0) n1 = 0.0;
  else {
    const gi1 = PERM[ii+i1+PERM[jj+j1+PERM[kk+k1]]] % 12;
    t1 *= t1;
    n1 = t1 * t1 * (grad3[gi1][0]*x1 + grad3[gi1][1]*y1 + grad3[gi1][2]*z1);
  }

  let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
  if (t2 < 0) n2 = 0.0;
  else {
    const gi2 = PERM[ii+i2+PERM[jj+j2+PERM[kk+k2]]] % 12;
    t2 *= t2;
    n2 = t2 * t2 * (grad3[gi2][0]*x2 + grad3[gi2][1]*y2 + grad3[gi2][2]*z2);
  }

  let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
  if (t3 < 0) n3 = 0.0;
  else {
    const gi3 = PERM[ii+1+PERM[jj+1+PERM[kk+1]]] % 12;
    t3 *= t3;
    n3 = t3 * t3 * (grad3[gi3][0]*x3 + grad3[gi3][1]*y3 + grad3[gi3][2]*z3);
  }

  return 32.0 * (n0 + n1 + n2 + n3);
}