import { convexHull } from '../hull.js';
import { lerpColorHex } from './color.js';

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
  getPerturbedVertex
}) {
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      if (tileGrid[y][x] !== game.CONSTANTS.TILE_WATER) continue;
      if (visitedWater[y][x]) continue;

      const band = depthBandGrid[y][x];
      if (band < 0) continue;

      const cells = floodFillBand(depthBandGrid, visitedWater, x, y, band, CHUNK_SIZE);
      if (!cells.length) continue;

      const corners = new Set();
      for (let { x: cxCell, y: cyCell } of cells) {
        corners.add(`${cxCell},${cyCell}`);
        corners.add(`${cxCell + 1},${cyCell}`);
        corners.add(`${cxCell},${cyCell + 1}`);
        corners.add(`${cxCell + 1},${cyCell + 1}`);
        // Also mark main visited grid so terrain phase skips water
        visited[cyCell][cxCell] = true;
      }

      const points = Array.from(corners, s => {
        const [px, py] = s.split(',').map(Number);
        return { x: px, y: py };
      });

      const hull = convexHull(points);
      if (hull.length < 3) continue;

      // Compute representative depth for this band for coloring
      const bandCenterT = (band + 0.5) / WATER_BAND_COUNT; // 0..1 shallowness
      const color = lerpColorHex(WATER_PALETTE.deep, WATER_PALETTE.shallow, bandCenterT);

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