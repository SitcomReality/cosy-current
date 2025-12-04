// Water depth-band painter: flood-fill depth bands and paint hulls for chunk water

import { convexHull, floodFill } from '../hull.js';
import { lerpColorHex, getPerturbedVertex } from './helpers.js';

// Render water quantized bands onto a chunk canvas context.
// This function assumes tileGrid and depthBandGrid have already been prepared.
export function renderWaterBands(cCtx, startX, startY, CHUNK_SIZE, tileSize, tileGrid, depthBandGrid, WATER_BAND_COUNT, WATER_PALETTE, getVertexOffset) {
  const visitedWater = Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(false));

  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      // Skip cells that are not part of water bands
      if (!depthBandGrid || depthBandGrid[y][x] === undefined || depthBandGrid[y][x] < 0) continue;
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
      }

      const points = Array.from(corners, s => {
        const [px, py] = s.split(',').map(Number);
        return { x: px, y: py };
      });

      const hull = convexHull(points);
      if (hull.length < 3) continue;

      const bandCenterT = (band + 0.5) / Math.max(1, WATER_BAND_COUNT);
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
        const v = getPerturbedVertex(wx, wy, p.x, p.y, CHUNK_SIZE, tileSize, getVertexOffset);
        if (i === 0) cCtx.moveTo(v.x, v.y);
        else cCtx.lineTo(v.x, v.y);
      }
      cCtx.closePath();
      cCtx.fill();
      cCtx.stroke();
    }
  }

  // Helper flood-fill for band grid (4-neighbour)
  function floodFillBand(grid, visitedGrid, sx, sy, bandValue, size) {
    const cells = [];
    const stack = [[sx, sy]];
    const dirs = [[0,1],[1,0],[0,-1],[-1,0]];

    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cx >= size || cy < 0 || cy >= size) continue;
      if (visitedGrid[cy][cx]) continue;
      if (grid[cy][cx] !== bandValue) continue;

      visitedGrid[cy][cx] = true;
      cells.push({ x: cx, y: cy });

      for (let [dx, dy] of dirs) {
        stack.push([cx + dx, cy + dy]);
      }
    }

    return cells;
  }
}