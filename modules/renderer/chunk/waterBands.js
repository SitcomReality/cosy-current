import { convexHull } from '../hull.js';
import { lerpColorHex } from './color.js';
import { getRiverGradient } from '../../fauna/behaviors/riverUtils.js';

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
  cycle
}) {
  const sunDirX = cycle ? -cycle.shadowDirX : 0;
  const sunDirY = cycle ? -cycle.shadowDirY : 0;

  // Strength of band darkening based on time-of-day:
  // - strongest near dawn/dusk
  // - smoothly fades to zero around midday
  let shadowStrength = 0;
  if (cycle) {
    const base = Math.max(0, Math.min(1, cycle.shadowAlpha / 0.45));

    // shadeProgression is 0 at dawnStart, 1 at duskEnd; build a triangle curve
    // that is 1 at both ends (morning/evening) and 0 at midday (~0.5).
    const s = typeof cycle.shadeProgression === 'number' ? cycle.shadeProgression : 0;
    const tri = Math.max(0, 1 - 2 * Math.abs(s - 0.5)); // 1 at 0/1, 0 at 0.5

    shadowStrength = base * tri;
  }

  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      if (tileGrid[y][x] !== game.CONSTANTS.TILE_WATER) continue;
      if (visitedWater[y][x]) continue;

      const band = depthBandGrid[y][x];
      if (band < 0) continue;

      const cells = floodFillBand(depthBandGrid, visitedWater, x, y, band, CHUNK_SIZE);
      if (!cells.length) continue;

      const corners = new Set();
      let sumGx = 0;
      let sumGy = 0;
      let cellCount = 0;

      for (let { x: cxCell, y: cyCell } of cells) {
        corners.add(`${cxCell},${cyCell}`);
        corners.add(`${cxCell + 1},${cyCell}`);
        corners.add(`${cxCell},${cyCell + 1}`);
        corners.add(`${cxCell + 1},${cyCell + 1}`);
        // Also mark main visited grid so terrain phase skips water
        visited[cyCell][cxCell] = true;

        // Accumulate gradient for shading
        if (shadowStrength > 0.01) {
          const wx = startX + cxCell + 0.5;
          const wy = startY + cyCell + 0.5;
          const g = getRiverGradient(noise, wx, wy, 2.0);
          sumGx += g.gx;
          sumGy += g.gy;
          cellCount++;
        }
      }

      const points = Array.from(corners, s => {
        const [px, py] = s.split(',').map(Number);
        return { x: px, y: py };
      });

      const hull = convexHull(points);
      if (hull.length < 3) continue;

      // Compute representative depth for this band for coloring
      const bandCenterT = (band + 0.5) / WATER_BAND_COUNT; // 0..1 shallowness
      let color = lerpColorHex(WATER_PALETTE.deep, WATER_PALETTE.shallow, bandCenterT);

      // Apply directional darkening (baked)
      if (cellCount > 0 && shadowStrength > 0.01) {
        const avgGx = sumGx / cellCount;
        const avgGy = sumGy / cellCount;
        // Dot product with sun direction
        const dot = avgGx * sunDirX + avgGy * sunDirY;
        if (dot > 0) {
           const darkenFactor = dot * shadowStrength * 0.45; // Tuned factor
           color = darkenRgb(color, darkenFactor);
        }
      }

      cCtx.fillStyle = color;
      cCtx.strokeStyle = color;
      cCtx.lineWidth = 2;
      cCtx.lineJoin = 'miter';
      cCtx.lineCap = 'butt';

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
}