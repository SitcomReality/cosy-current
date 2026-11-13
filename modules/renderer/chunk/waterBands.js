import { convexHull } from '../hull.js';
import { lerpColorHex } from './color.js';
import { getRiverGradient } from '../../fauna/behaviors/riverUtils.js';
import { traceCellLoops, simplifyClosedLoop, traceLoopPath } from './boundary.js';

const WATER_SIMPLIFY_TOLERANCE = 0.3;

// Helper: flood-fill within a numeric band grid (e.g., depthBandGrid)
function floodFillBand(grid, visitedGrid, sx, sy, bandValue, CHUNK_SIZE) {
  const cells = [];
  const stack = [[sx, sy]];
  const dirs = [[0,1],[1,0],[0,-1],[-1,0]];

  while (stack.length) {
    const [cxCell, cyCell] = stack.pop();
    if (cxCell < 0 || cxCell >= CHUNK_SIZE || cyCell < 0 || cyCell >= CHUNK_SIZE) continue;
    if (visitedGrid[cyCell][cxCell]) continue;
    if (grid[cyCell][cxCell] !== bandValue) continue;

    visitedGrid[cyCell][cxCell] = true;
    cells.push({ x: cxCell, y: cyCell });

    for (let [dx, dy] of dirs) {
      stack.push([cxCell + dx, cyCell + dy]);
    }
  }

  return cells;
}

function darkenRgb(rgbStr, amount) {
  const parts = rgbStr.match(/\d+/g);
  if (!parts) return rgbStr;
  const r = parseInt(parts[0]);
  const g = parseInt(parts[1]);
  const b = parseInt(parts[2]);
  const f = 1.0 - Math.max(0, Math.min(1, amount));
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
}

// Renders quantized water depth bands into the chunk canvas
export function renderWaterBands({
  cCtx,
  CHUNK_SIZE,
  startX,
  startY,
  tileGrid,
  depthBandGrid,
  visitedWater,
  visited,
  WATER_BAND_COUNT,
  game,
  WATER_PALETTE,
  getPerturbedVertex,
  noise,
  cycle,
  usePolygons = false,
  shadingMode = 'baked',
  ringMask = null
}) {
  const ringEntries = [];
  const sunDirX = cycle ? -cycle.shadowDirX : 0;
  const sunDirY = cycle ? -cycle.shadowDirY : 0;

  // Strength of band darkening based on time-of-day.
  // We model an asymmetrical curve: fade quickly in morning (peak at s=0.2), slowly fade to noon (s=0.5),
  // slowly fade back in afternoon (peak at s=0.8), quickly fade out at dusk (s=1.0).
  let shadowStrength = 0;
  if (cycle) {
    // Base strength modulation (controlled by overall shadow visibility, ensuring fade out at night)
    const base = Math.max(0, Math.min(1, cycle.shadowAlpha / 0.45));
    const s = typeof cycle.shadeProgression === 'number' ? cycle.shadeProgression : 0;
    
    let strengthMod = 0;

    if (s <= 0.2) {
      // 0 -> 0.2 (Fast Fade In, peaking slightly after dawn)
      const u = s / 0.2;
      strengthMod = Math.sqrt(u); // Quicker rise
    } else if (s <= 0.5) {
      // 0.2 -> 0.5 (Slow Fade Out towards noon)
      const u = (s - 0.2) / 0.3;
      strengthMod = 1.0 - Math.pow(u, 2); // Slow falloff
    } else if (s <= 0.8) {
      // 0.5 -> 0.8 (Slow Fade In from noon towards twilight peak)
      const u = (s - 0.5) / 0.3;
      strengthMod = Math.pow(u, 2); // Slow rise
    } else { // s <= 1.0
      // 0.8 -> 1.0 (Fast Fade Out as full darkness approaches)
      const u = (s - 0.8) / 0.2;
      strengthMod = 1.0 - Math.sqrt(u); // Quicker fall
    }
    
    strengthMod = Math.max(0, Math.min(1, strengthMod));

    shadowStrength = base * strengthMod;
  }

  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      if (tileGrid[y][x] !== game.CONSTANTS.TILE_WATER) continue;
      if (visitedWater[y][x]) continue;

      const band = depthBandGrid[y][x];
      if (band < 0) continue;

      const cells = floodFillBand(depthBandGrid, visitedWater, x, y, band, CHUNK_SIZE);
      if (!cells.length) continue;

      const corners = usePolygons ? null : new Set();
      let sumGx = 0;
      let sumGy = 0;
      let cellCount = 0;
      let sumWorldX = 0;
      let sumWorldY = 0;

      for (let { x: cxCell, y: cyCell } of cells) {
        if (corners) {
          corners.add(`${cxCell},${cyCell}`);
          corners.add(`${cxCell + 1},${cyCell}`);
          corners.add(`${cxCell},${cyCell + 1}`);
          corners.add(`${cxCell + 1},${cyCell + 1}`);
        }
        // Also mark main visited grid so terrain phase skips water
        visited[cyCell][cxCell] = true;

        sumWorldX += startX + cxCell + 0.5;
        sumWorldY += startY + cyCell + 0.5;

        // Legacy baked shading: average the gradient over the component's
        // chunk-clipped cells.
        if (shadingMode === 'baked' && shadowStrength > 0.01) {
          const wx = startX + cxCell + 0.5;
          const wy = startY + cyCell + 0.5;
          const g = getRiverGradient(noise, wx, wy, 2.0);
          sumGx += g.gx;
          sumGy += g.gy;
          cellCount++;
        }
      }

      // Compute representative depth for this band for coloring
      const bandCenterT = (band + 0.5) / WATER_BAND_COUNT; // 0..1 shallowness
      let color = lerpColorHex(WATER_PALETTE.deep, WATER_PALETTE.shallow, bandCenterT);

      // Apply directional darkening (baked).
      // baked: legacy per-cell average, clipped by this chunk.
      // world: same idea, but sampled from a small window around the component's
      //        world centroid; paired with manager-level rebuild syncing.
      // flat:  no baked directional darkening at all, so adjacent chunks cannot
      //        differ in water tint.
      if (shadowStrength > 0.01 && shadingMode !== 'flat') {
        let avgGx = 0;
        let avgGy = 0;

        if (shadingMode === 'world') {
          const centerX = sumWorldX / cells.length;
          const centerY = sumWorldY / cells.length;
          let gx = 0;
          let gy = 0;
          let samples = 0;
          for (let oy = -2; oy <= 2; oy += 2) {
            for (let ox = -2; ox <= 2; ox += 2) {
              const g = getRiverGradient(noise, centerX + ox, centerY + oy, 2.0);
              gx += g.gx;
              gy += g.gy;
              samples++;
            }
          }
          if (samples > 0) {
            avgGx = gx / samples;
            avgGy = gy / samples;
          }
        } else if (cellCount > 0) {
          avgGx = sumGx / cellCount;
          avgGy = sumGy / cellCount;
        }

        // Dot product with sun direction
        const dot = avgGx * sunDirX + avgGy * sunDirY;
        if (dot > 0) {
          const darkenFactor = dot * shadowStrength * 0.45; // Tuned factor
          color = darkenRgb(color, darkenFactor);
        }
      }

      // The hybrid terrain mode redraws a thin exact ring of cells over the
      // hulls after the terrain pass; collect this band's ring cells here.
      if (ringMask) {
        const ringCells = [];
        for (let i = 0; i < cells.length; i++) {
          const c = cells[i];
          if (ringMask[c.y][c.x]) ringCells.push(c);
        }
        if (ringCells.length) {
          const loops = traceCellLoops(ringCells, depthBandGrid, band, CHUNK_SIZE);
          if (loops.length) ringEntries.push({ loops, color });
        }
      }

      cCtx.fillStyle = color;
      cCtx.strokeStyle = color;
      cCtx.lineWidth = 2;
      cCtx.lineJoin = 'miter';
      cCtx.lineCap = 'butt';

      if (usePolygons) {
        let loops = traceCellLoops(cells, depthBandGrid, band, CHUNK_SIZE);
        loops = loops
          .map(loop => simplifyClosedLoop(loop, WATER_SIMPLIFY_TOLERANCE))
          .filter(loop => loop.length >= 3);
        if (!loops.length) continue;

        cCtx.beginPath();
        traceLoopPath(cCtx, loops, (localX, localY) => {
          const wx = startX + localX;
          const wy = startY + localY;
          return getPerturbedVertex(wx, wy, localX, localY);
        });
        cCtx.fill();
        cCtx.stroke();
        continue;
      }

      const points = Array.from(corners, s => {
        const [px, py] = s.split(',').map(Number);
        return { x: px, y: py };
      });

      const hull = convexHull(points);
      if (hull.length < 3) continue;

      cCtx.beginPath();
      for (let i = 0; i < hull.length; i++) {
        const p = hull[i];
        const wx = startX + p.x;
        const wy = startY + p.y;
        const v = getPerturbedVertex(wx, wy, p.x, p.y);
        if (i === 0) cCtx.moveTo(v.x, v.y);
        else cCtx.lineTo(v.x, v.y);
      }
      cCtx.closePath();
      cCtx.fill();
      cCtx.stroke();
    }
  }

  return ringEntries;
}