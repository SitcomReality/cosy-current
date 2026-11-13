// Tile-edge boundary tracing for the experimental polygon terrain renderer.
//
// The stock renderer approximates each connected terrain component with its
// convex hull. That fills concavities and, because each chunk computes its own
// hull from a chunk-clipped subset of the region, leaves straight steps at
// chunk borders. This module instead traces the actual perimeter of the cells
// in a component, so adjacent chunks meet at the real tile boundary.
//
// Coordinates are chunk-local tile corners (0..CHUNK_SIZE). Closed loops are
// oriented with the component's cells on the right, which means holes wind the
// other way and a single nonzero fill handles both.

function pointKey(x, y) {
  return x + ',' + y;
}

// Choose the outgoing edge that keeps us tight against the filled cells.
// Screen space: +x right, +y down; a clockwise (right) turn of (x,y) is (-y,x).
function pickTurn(edges, inDx, inDy) {
  const preferences = [
    [-inDy, inDx],   // right
    [inDx, inDy],    // straight
    [inDy, -inDx],   // left
    [-inDx, -inDy]   // back
  ];
  for (const [dx, dy] of preferences) {
    for (let i = 0; i < edges.length; i++) {
      if (edges[i].dx === dx && edges[i].dy === dy) return i;
    }
  }
  return 0;
}

// Trace closed loops around a set of 4-connected cells.
// labelGrid[y][x] is compared against `label`; out-of-chunk neighbours count as
// a different label, which closes the loop along the chunk edge.
export function traceCellLoops(cells, labelGrid, label, CHUNK_SIZE) {
  const outgoing = new Map();

  function addEdge(ax, ay, bx, by) {
    const key = pointKey(ax, ay);
    let list = outgoing.get(key);
    if (!list) {
      list = [];
      outgoing.set(key, list);
    }
    list.push({ x: bx, y: by, dx: bx - ax, dy: by - ay });
  }

  for (let i = 0; i < cells.length; i++) {
    const x = cells[i].x;
    const y = cells[i].y;

    // Top (walk east), right (south), bottom (west), left (north).
    if (y === 0 || labelGrid[y - 1][x] !== label) addEdge(x, y, x + 1, y);
    if (x === CHUNK_SIZE - 1 || labelGrid[y][x + 1] !== label) addEdge(x + 1, y, x + 1, y + 1);
    if (y === CHUNK_SIZE - 1 || labelGrid[y + 1][x] !== label) addEdge(x + 1, y + 1, x, y + 1);
    if (x === 0 || labelGrid[y][x - 1] !== label) addEdge(x, y + 1, x, y);
  }

  const loops = [];

  while (outgoing.size > 0) {
    let startKey = null;
    for (const [key, list] of outgoing) {
      if (list.length > 0) {
        startKey = key;
        break;
      }
    }
    if (startKey === null) break;

    const [sx, sy] = startKey.split(',').map(Number);
    const loop = [{ x: sx, y: sy }];
    let cx = sx;
    let cy = sy;
    let prevX = sx;
    let prevY = sy;
    let guard = 0;

    while (guard++ < CHUNK_SIZE * CHUNK_SIZE * 8) {
      const list = outgoing.get(pointKey(cx, cy));
      if (!list || list.length === 0) break;

      let index = 0;
      if (list.length > 1) {
        index = pickTurn(list, cx - prevX, cy - prevY);
      }
      const edge = list.splice(index, 1)[0];
      if (list.length === 0) outgoing.delete(pointKey(cx, cy));

      prevX = cx;
      prevY = cy;
      cx = edge.x;
      cy = edge.y;

      if (cx === sx && cy === sy) break;
      loop.push({ x: cx, y: cy });
    }

    if (loop.length >= 3) loops.push(loop);
  }

  return loops;
}

function perpendicularDistanceSq(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) {
    const px = p.x - a.x;
    const py = p.y - a.y;
    return px * px + py * py;
  }
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  const x = a.x + dx * clamped;
  const y = a.y + dy * clamped;
  const px = p.x - x;
  const py = p.y - y;
  return px * px + py * py;
}

function simplifyOpenPolyline(points, toleranceSq) {
  if (points.length <= 2) return points;

  let maxDist = -1;
  let maxIndex = -1;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistanceSq(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIndex = i;
    }
  }

  if (maxDist > toleranceSq && maxIndex > 0) {
    const left = simplifyOpenPolyline(points.slice(0, maxIndex + 1), toleranceSq);
    const right = simplifyOpenPolyline(points.slice(maxIndex), toleranceSq);
    return left.concat(right.slice(1));
  }

  return [first, last];
}

// Closed-loop Ramer-Douglas-Peucker. Splits at the point farthest from the
// start so the algorithm never runs on a degenerate zero-length baseline.
export function simplifyClosedLoop(points, tolerance) {
  if (points.length <= 4) return points;

  const deduped = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = deduped[deduped.length - 1];
    if (!prev || prev.x !== p.x || prev.y !== p.y) deduped.push(p);
  }
  if (deduped.length > 1) {
    const first = deduped[0];
    const last = deduped[deduped.length - 1];
    if (first.x === last.x && first.y === last.y) deduped.pop();
  }
  if (deduped.length <= 3) return deduped;

  let farthest = 1;
  let farthestDist = -1;
  for (let i = 1; i < deduped.length; i++) {
    const dx = deduped[i].x - deduped[0].x;
    const dy = deduped[i].y - deduped[0].y;
    const d = dx * dx + dy * dy;
    if (d > farthestDist) {
      farthestDist = d;
      farthest = i;
    }
  }
  if (farthestDist <= 0) return deduped;

  const toleranceSq = tolerance * tolerance;
  const firstHalf = simplifyOpenPolyline(deduped.slice(0, farthest + 1), toleranceSq);
  const secondHalf = simplifyOpenPolyline(deduped.slice(farthest), toleranceSq);

  const result = firstHalf.concat(secondHalf.slice(1));

  // Drop collinear points left over from splitting the loop.
  const cleaned = [];
  for (let i = 0; i < result.length; i++) {
    const prev = result[(i - 1 + result.length) % result.length];
    const cur = result[i];
    const next = result[(i + 1) % result.length];
    const cross = (cur.x - prev.x) * (next.y - cur.y) - (cur.y - prev.y) * (next.x - cur.x);
    if (cross !== 0) cleaned.push(cur);
  }

  if (cleaned.length >= 3) return cleaned;
  return result.length >= 3 ? result : deduped;
}

// Add loops to the current 2D path. getVertex(localX, localY) maps a
// chunk-local tile corner to bitmap pixels.
export function traceLoopPath(cCtx, loops, getVertex) {
  for (let l = 0; l < loops.length; l++) {
    const loop = loops[l];
    for (let i = 0; i < loop.length; i++) {
      const v = getVertex(loop[i].x, loop[i].y);
      if (i === 0) cCtx.moveTo(v.x, v.y);
      else cCtx.lineTo(v.x, v.y);
    }
    cCtx.closePath();
  }
}
