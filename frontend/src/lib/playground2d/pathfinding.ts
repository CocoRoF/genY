// A* pathfinding with per-agent jitter and soft-blocking

const NEIGHBOR_ROTATIONS = [
  [[0, 1], [1, 0], [0, -1], [-1, 0]],
  [[1, 0], [0, -1], [-1, 0], [0, 1]],
  [[0, -1], [-1, 0], [0, 1], [1, 0]],
  [[-1, 0], [0, 1], [1, 0], [0, -1]],
];

export function agentHashSeed(agentId: string): number {
  if (!agentId) return 0;
  let h = 2166136261;
  for (let i = 0; i < agentId.length; i++) {
    h ^= agentId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface FindPathOptions {
  agentSeed?: number;
  softBlocked?: Set<string> | null;
}

export function findPath(
  startX: number, startY: number,
  goalX: number, goalY: number,
  width: number, height: number,
  blockedTiles: Set<string> | null,
  opts: FindPathOptions = {}
): { x: number; y: number }[] | null {
  if (startX === goalX && startY === goalY) return [];

  const { agentSeed = 0, softBlocked = null } = opts;
  const key = (x: number, y: number) => `${x},${y}`;
  const openSet = new Map<string, { x: number; y: number }>();
  const closedSet = new Set<string>();
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  const startKey = key(startX, startY);
  gScore.set(startKey, 0);
  fScore.set(startKey, Math.abs(goalX - startX) + Math.abs(goalY - startY));
  openSet.set(startKey, { x: startX, y: startY });

  const neighbors = NEIGHBOR_ROTATIONS[agentSeed % NEIGHBOR_ROTATIONS.length];
  let iterations = 0;
  const maxIterations = width * height * 2;

  while (openSet.size > 0 && iterations < maxIterations) {
    iterations++;

    let currentKey: string | null = null;
    let currentNode: { x: number; y: number } | null = null;
    let bestF = Infinity;
    for (const [k, node] of openSet) {
      const f = fScore.get(k) || Infinity;
      if (f < bestF) { bestF = f; currentKey = k; currentNode = node; }
    }
    if (!currentKey || !currentNode) break;

    if (currentNode.x === goalX && currentNode.y === goalY) {
      const path: { x: number; y: number }[] = [];
      let ck: string | undefined = currentKey;
      while (ck && cameFrom.has(ck)) {
        const [px, py] = ck.split(',').map(Number);
        path.unshift({ x: px, y: py });
        ck = cameFrom.get(ck);
      }
      return path;
    }

    openSet.delete(currentKey);
    closedSet.add(currentKey);

    for (const [dx, dy] of neighbors) {
      const nx = currentNode.x + dx;
      const ny = currentNode.y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const nKey = key(nx, ny);
      if (closedSet.has(nKey)) continue;
      if (blockedTiles && blockedTiles.has(nKey)) continue;

      const softCost = softBlocked && softBlocked.has(nKey) ? 3 : 0;
      const jitter = ((agentSeed ^ (nx * 73856093) ^ (ny * 19349663)) >>> 0) % 3 === 0 ? 1 : 0;
      const tentativeG = (gScore.get(currentKey) || 0) + 1 + softCost + jitter;

      if (tentativeG < (gScore.get(nKey) || Infinity)) {
        cameFrom.set(nKey, currentKey);
        gScore.set(nKey, tentativeG);
        fScore.set(nKey, tentativeG + Math.abs(goalX - nx) + Math.abs(goalY - ny));
        if (!openSet.has(nKey)) openSet.set(nKey, { x: nx, y: ny });
      }
    }
  }

  return null;
}
