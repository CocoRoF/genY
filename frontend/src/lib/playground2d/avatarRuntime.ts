import type { AvatarRuntime, AvatarState, Location, Station, StationDestination, ChatQueueItem } from './types';
import { BASE_MOVE_INTERVAL_MS } from './types';
import { buildConversation } from './agentDialogues';
import { findPath, agentHashSeed } from './pathfinding';

// Chat tuning constants
const CHAT_PROXIMITY = 2;
const CHAT_TURN_MS = 3500;
const CHAT_TAIL_MS = 600;
const CHAT_COOLDOWN_MS = 6000;
const CHAT_PAIR_COOLDOWN_MS = 45000;
const CHAT_START_CHANCE = 0.3;

const MOVES: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 0], [-1, 0], [0, 1], [0, 0]
];

const DIRECTION_BY_MOVE: Record<string, AvatarRuntime['direction']> = {
  '1,0': 'right', '-1,0': 'left', '0,1': 'down', '0,-1': 'up'
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function nextMoveTime(timestamp: number, rng = Math.random): number {
  return timestamp + BASE_MOVE_INTERVAL_MS + Math.floor(rng() * BASE_MOVE_INTERVAL_MS);
}

function chooseMove(rng = Math.random): [number, number] {
  const index = Math.floor(rng() * MOVES.length);
  return MOVES[index] || MOVES[0];
}

function resolveDirection(
  deltaX: number, deltaY: number,
  fallback: AvatarRuntime['direction'] = 'down'
): AvatarRuntime['direction'] {
  if (deltaX > 0) return 'right';
  if (deltaX < 0) return 'left';
  if (deltaY > 0) return 'down';
  if (deltaY < 0) return 'up';
  return fallback;
}

function faceDirection(dx: number, dy: number): AvatarRuntime['direction'] {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  if (dy === 0 && dx === 0) return 'down';
  return dy > 0 ? 'down' : 'up';
}

function formatStationBubble(
  dest: StationDestination | null,
  state: string,
  phase: 'at' | 'heading to'
): string {
  if (!dest) return '';
  if (dest.stationActivity) {
    return phase === 'heading to'
      ? `heading out to ${dest.stationLabel || 'the spot'}`
      : dest.stationActivity;
  }
  const target = dest.stationLabel
    ? `${dest.stationLabel} @ ${dest.locationName}`
    : dest.locationName || '';
  if (phase === 'heading to') return `heading to ${target}`;
  return state === 'working' ? `working at ${target}` : `resting at ${target}`;
}

function pickClientDestination(
  runtime: AvatarRuntime,
  locations: Location[] | null,
  rng: () => number
): StationDestination | null {
  if (!locations || locations.length === 0) return null;
  const candidates = locations.filter(loc => {
    const cx = loc.x + Math.floor((loc.w || 5) / 2);
    const cy = loc.y + (loc.h || 4) - 1;
    return !(runtime.x === cx && runtime.y === cy);
  });
  const pool = candidates.length > 0 ? candidates : locations;
  const chosen = pool[Math.floor(rng() * pool.length)];
  return {
    locationId: chosen.id,
    locationName: chosen.name,
    x: chosen.x + Math.floor((chosen.w || 5) / 2),
    y: chosen.y + (chosen.h || 4) - 1,
  };
}

function pickStationForState(
  runtime: AvatarRuntime,
  stations: Station[],
  rng: () => number,
  claimedStationIds: Set<string>,
  lastStationId: string | null = null
): StationDestination | null {
  if (!stations || stations.length === 0) return null;
  const wantKind = runtime.state === 'working' ? 'work' : 'rest';
  const available = (s: Station) => !claimedStationIds.has(s.id) && s.id !== lastStationId;
  const preferred = stations.filter(s => s.kind === wantKind && available(s));
  const fallback = stations.filter(available);
  const finalPool = preferred.length > 0 ? preferred
    : fallback.length > 0 ? fallback
    : stations.filter(s => !claimedStationIds.has(s.id));
  if (finalPool.length === 0) return null;
  const chosen = finalPool[Math.floor(rng() * finalPool.length)];
  return {
    stationId: chosen.id,
    locationId: chosen.locationId,
    locationName: chosen.locationName,
    stationLabel: chosen.label,
    stationKind: chosen.kind,
    stationActivity: chosen.activity || null,
    x: chosen.x ?? 0,
    y: chosen.y ?? 0,
  };
}

function startConversation(
  a: AvatarRuntime, b: AvatarRuntime,
  timestamp: number, rng: () => number
): void {
  const lines = buildConversation(rng);
  const turns = lines.length;
  const endAt = timestamp + CHAT_TURN_MS * turns + CHAT_TAIL_MS;
  a.chatPauseUntil = endAt;
  b.chatPauseUntil = endAt;
  a.chatPartnerId = b.id || null;
  b.chatPartnerId = a.id || null;
  a.chatQueue = [];
  b.chatQueue = [];
  for (let i = 0; i < turns; i++) {
    const speaker = i % 2 === 0 ? a : b;
    speaker.chatQueue!.push({
      text: lines[i],
      showAt: timestamp + i * CHAT_TURN_MS,
      expireAt: timestamp + (i + 1) * CHAT_TURN_MS,
    });
  }
  const ddx = b.x - a.x;
  const ddy = b.y - a.y;
  a.direction = faceDirection(ddx, ddy);
  b.direction = faceDirection(-ddx, -ddy);
  a.path = null; a.pathIndex = 0;
  b.path = null; b.pathIndex = 0;
  const until = endAt + CHAT_PAIR_COOLDOWN_MS;
  if (!a.chatRecentPartners) a.chatRecentPartners = {};
  if (!b.chatRecentPartners) b.chatRecentPartners = {};
  if (b.id) a.chatRecentPartners[b.id] = until;
  if (a.id) b.chatRecentPartners[a.id] = until;
}

function updateAgentChats(
  avatarRuntime: Map<string, AvatarRuntime>,
  timestamp: number, rng: () => number
): void {
  avatarRuntime.forEach(runtime => {
    if (runtime.chatPauseUntil && runtime.chatPauseUntil <= timestamp) {
      runtime.chatPauseUntil = 0;
      runtime.chatPartnerId = null;
      runtime.chatQueue = null;
      runtime.chatCooldownUntil = timestamp + CHAT_COOLDOWN_MS;
      runtime.chat = null;
      runtime.path = null;
      runtime.pathIndex = 0;
    }
    if (runtime.chatQueue) {
      const active = runtime.chatQueue.find(
        item => item.showAt <= timestamp && item.expireAt > timestamp
      );
      runtime.chat = active ? { text: active.text, expiresAt: active.expireAt } : null;
    }
  });

  const agents = Array.from(avatarRuntime.values());
  if (agents.length < 2) return;
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    if (a.chatPauseUntil && timestamp < a.chatPauseUntil) continue;
    if (a.chatCooldownUntil && timestamp < a.chatCooldownUntil) continue;
    for (let j = i + 1; j < agents.length; j++) {
      const b = agents[j];
      if (b.chatPauseUntil && timestamp < b.chatPauseUntil) continue;
      if (b.chatCooldownUntil && timestamp < b.chatCooldownUntil) continue;
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      if (dx > CHAT_PROXIMITY || dy > CHAT_PROXIMITY) continue;
      if (dx === 0 && dy === 0) continue;
      if (rng() > CHAT_START_CHANCE) continue;
      const aRecent = a.chatRecentPartners && b.id ? a.chatRecentPartners[b.id] : 0;
      if (aRecent && timestamp < aRecent) continue;
      startConversation(a, b, timestamp, rng);
      break;
    }
  }
}

function createDefaultRuntime(avatar: AvatarState, now: number, rng: () => number): AvatarRuntime {
  return {
    ...avatar,
    direction: 'down',
    nextMoveAt: nextMoveTime(now, rng),
    path: null,
    pathIndex: 0,
    arrivalPauseUntil: 0,
    agentSeed: agentHashSeed(avatar.id),
    currentDestination: null,
    lastStationId: null,
    seated: false,
    talking: false,
    walkFrame: 0,
    walkFrameTime: 0,
    chatPauseUntil: 0,
    chatPartnerId: null,
    chatQueue: null,
    chatCooldownUntil: 0,
    chatRecentPartners: {},
    chat: null,
  };
}

export function syncAvatarRuntimeEntries(
  avatarRuntime: Map<string, AvatarRuntime>,
  avatars: Record<string, AvatarState>,
  now: number,
  rng = Math.random
): void {
  const aliveIds = new Set<string>();

  Object.entries(avatars).forEach(([avatarId, avatar]) => {
    aliveIds.add(avatarId);
    const runtime = avatarRuntime.get(avatarId);
    const authoritativePosition = !avatar.moving;

    if (!runtime) {
      avatarRuntime.set(avatarId, createDefaultRuntime(avatar, now, rng));
      return;
    }

    const prevMoving = runtime.moving;
    const prevX = runtime.x;
    const prevY = runtime.y;

    runtime.moving = avatar.moving;
    runtime.state = avatar.state;
    if (avatar.bubbleText) {
      runtime.bubbleText = avatar.bubbleText;
    } else if (runtime.bubbleText == null) {
      runtime.bubbleText = '';
    }
    runtime.authoritativePosition = authoritativePosition;
    runtime.displayName = avatar.displayName;

    if (authoritativePosition || !prevMoving) {
      runtime.x = avatar.x;
      runtime.y = avatar.y;
    }

    if (avatar.destination && avatar.destination.x !== undefined) {
      const destChanged = !runtime.currentDestination ||
        runtime.currentDestination.x !== avatar.destination.x ||
        runtime.currentDestination.y !== avatar.destination.y;
      if (destChanged) {
        runtime.currentDestination = avatar.destination as StationDestination;
        runtime.path = null;
        runtime.pathIndex = 0;
      }
    } else if (!runtime.moving) {
      runtime.currentDestination = null;
      runtime.path = null;
    }

    if (authoritativePosition && (prevX !== avatar.x || prevY !== avatar.y)) {
      runtime.direction = resolveDirection(avatar.x - prevX, avatar.y - prevY, runtime.direction);
    }

    if (!runtime.moving) {
      runtime.nextMoveAt = nextMoveTime(now, rng);
    }
  });

  Array.from(avatarRuntime.keys()).forEach(avatarId => {
    if (!aliveIds.has(avatarId)) avatarRuntime.delete(avatarId);
  });
}

export function advanceAvatarRuntimeEntries(
  avatarRuntime: Map<string, AvatarRuntime>,
  dimensions: { width: number; height: number },
  timestamp: number,
  rng = Math.random,
  blockedTiles: Set<string> | null = null,
  locations: Location[] | null = null,
  stations: Station[] | null = null
): void {
  const width = dimensions?.width || 30;
  const height = dimensions?.height || 30;

  updateAgentChats(avatarRuntime, timestamp, rng);

  avatarRuntime.forEach(runtime => {
    runtime.seated = Boolean(
      runtime.arrivalPauseUntil && timestamp < runtime.arrivalPauseUntil && runtime.currentDestination?.stationId
    );
    runtime.talking = Boolean(runtime.chatPauseUntil && timestamp < runtime.chatPauseUntil);
  });

  const claimedStationIds = new Set<string>();
  avatarRuntime.forEach(r => {
    const id = r.currentDestination?.stationId;
    if (id) claimedStationIds.add(id);
  });

  const occupiedTiles = new Set<string>();
  avatarRuntime.forEach(r => occupiedTiles.add(`${r.x},${r.y}`));

  function pickDestination(runtime: AvatarRuntime, lastStationId: string | null = null): StationDestination | null {
    if (stations && stations.length > 0) {
      const st = pickStationForState(runtime, stations, rng, claimedStationIds, lastStationId);
      if (st) {
        if (st.stationId) claimedStationIds.add(st.stationId);
        return st;
      }
    }
    return pickClientDestination(runtime, locations, rng);
  }

  avatarRuntime.forEach(runtime => {
    if (!runtime.moving || runtime.authoritativePosition) return;
    if (runtime.chatPauseUntil && timestamp < runtime.chatPauseUntil) return;
    if (timestamp < runtime.nextMoveAt) return;

    // Arrival pause handling
    if (runtime.arrivalPauseUntil && timestamp < runtime.arrivalPauseUntil) return;
    if (runtime.arrivalPauseUntil && timestamp >= runtime.arrivalPauseUntil) {
      runtime.arrivalPauseUntil = 0;
      const prevStationId = runtime.currentDestination?.stationId || null;
      const prevLocationId = runtime.currentDestination?.locationId || null;
      if (prevStationId) claimedStationIds.delete(prevStationId);

      // Working agents: 60% chance to pick another station in the same building
      let newDest: StationDestination | null = null;
      if (runtime.state === 'working' && prevLocationId && stations && rng() < 0.6) {
        const sameBuilding = stations.filter(s =>
          s.locationId === prevLocationId && s.id !== prevStationId && !claimedStationIds.has(s.id)
        );
        if (sameBuilding.length > 0) {
          const chosen = sameBuilding[Math.floor(rng() * sameBuilding.length)];
          newDest = {
            stationId: chosen.id,
            locationId: chosen.locationId,
            locationName: chosen.locationName,
            stationLabel: chosen.label,
            stationKind: chosen.kind,
            stationActivity: chosen.activity || null,
            x: chosen.x ?? 0,
            y: chosen.y ?? 0,
          };
          if (chosen.id) claimedStationIds.add(chosen.id);
        }
      }

      if (!newDest) {
        newDest = pickDestination(runtime, prevStationId);
      }
      if (newDest) {
        runtime.currentDestination = newDest;
        runtime.path = null;
        runtime.pathIndex = 0;
        runtime.bubbleText = formatStationBubble(newDest, runtime.state, 'heading to');
      }
    }

    // Goal-directed movement
    if (runtime.currentDestination) {
      const dest = runtime.currentDestination;

      if (runtime.x === dest.x && runtime.y === dest.y) {
        // Working agents stay much longer at their station (20-45s)
        // Idle agents rest briefly (6-14s)
        const restTime = runtime.state === 'working'
          ? 20000 + Math.floor(rng() * 25000)
          : 6000 + Math.floor(rng() * 8000);
        runtime.arrivalPauseUntil = timestamp + restTime;
        runtime.lastStationId = dest.stationId || null;
        runtime.path = null;
        runtime.pathIndex = 0;
        runtime.nextMoveAt = nextMoveTime(timestamp, rng);
        if (dest.stationId) {
          runtime.bubbleText = formatStationBubble(dest, runtime.state, 'at');
        }
        return;
      }

      if (!runtime.path) {
        const myKey = `${runtime.x},${runtime.y}`;
        const softBlocked = new Set<string>();
        for (const k of occupiedTiles) if (k !== myKey) softBlocked.add(k);
        runtime.path = findPath(
          runtime.x, runtime.y, dest.x, dest.y,
          width, height, blockedTiles,
          { agentSeed: runtime.agentSeed || 0, softBlocked }
        );
        runtime.pathIndex = 0;
        if (!runtime.path) {
          if (runtime.currentDestination?.stationId) {
            claimedStationIds.delete(runtime.currentDestination.stationId);
          }
          runtime.currentDestination = null;
        }
      }

      if (runtime.path && runtime.pathIndex < runtime.path.length) {
        const nextStep = runtime.path[runtime.pathIndex];
        const dx = nextStep.x - runtime.x;
        const dy = nextStep.y - runtime.y;
        if (dx !== 0 || dy !== 0) {
          runtime.direction = resolveDirection(dx, dy, runtime.direction);
        }
        runtime.x = nextStep.x;
        runtime.y = nextStep.y;
        runtime.pathIndex++;
        runtime.nextMoveAt = nextMoveTime(timestamp, rng);
        return;
      }

      runtime.currentDestination = null;
      runtime.path = null;
      runtime.pathIndex = 0;
    }

    // Fallback: pick new destination
    const fallbackDest = pickDestination(runtime);
    if (fallbackDest) {
      runtime.currentDestination = fallbackDest;
      runtime.path = null;
      runtime.pathIndex = 0;
      runtime.bubbleText = formatStationBubble(fallbackDest, runtime.state, 'heading to');
      runtime.nextMoveAt = nextMoveTime(timestamp, rng);
      return;
    }

    // Random walk as last resort
    const [dx, dy] = chooseMove(rng);
    const nextX = clamp(runtime.x + dx, 0, width - 1);
    const nextY = clamp(runtime.y + dy, 0, height - 1);
    if (blockedTiles && blockedTiles.has(`${nextX},${nextY}`)) {
      runtime.nextMoveAt = nextMoveTime(timestamp, rng);
      return;
    }
    if (nextX !== runtime.x || nextY !== runtime.y) {
      runtime.direction = DIRECTION_BY_MOVE[`${dx},${dy}`] || runtime.direction;
    }
    runtime.x = nextX;
    runtime.y = nextY;
    runtime.nextMoveAt = nextMoveTime(timestamp, rng);
  });
}
