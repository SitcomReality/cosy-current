export function getVertexOffset(wx, wy, comp) {
  const seed = (wx * 73856093 ^ wy * 19349663) ^ comp;
  const hash = Math.sin(seed * 12.9898) * 43758.5453;
  return ((hash % 1) - 0.5) * 0.4; // -0.2 to 0.2 grid units
}

