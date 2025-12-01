// Monotone chain convex hull and flood fill utilities used by chunk generation

export function convexHull(pts) {
  if (pts.length < 3) return [];
  const sorted = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const build = (points) => {
    const hull = [];
    for (let p of points) {
      while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) {
        hull.pop();
      }
      hull.push(p);
    }
    return hull;
  };

  const lower = build(sorted);
  const upper = build(sorted.slice().reverse());

  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  return hull.length >= 3 ? hull : [];
}

export function floodFill(tileGrid, heightGrid, visited, sx, sy, tileType, CHUNK_SIZE) {
  const cells = [];
  let sumH = 0;
  const stack = [[sx, sy]];
  const dirs = [[0,1],[1,0],[0,-1],[-1,0]];

  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cx >= CHUNK_SIZE || cy < 0 || cy >= CHUNK_SIZE ||
        visited[cy][cx] || tileGrid[cy][cx] !== tileType) continue;

    visited[cy][cx] = true;
    cells.push({ x: cx, y: cy });
    sumH += heightGrid[cy][cx];

    for (let [dx, dy] of dirs) {
      stack.push([cx + dx, cy + dy]);
    }
  }

  return {
    cells,
    avgH: cells.length > 0 ? sumH / cells.length : 0
  };
}