import type { WorldState, WorldEvent, Agent, AvatarState, Run, Task, EventType, Location, Station, StationDestination, GenySessionRole } from './types';
import { VALID_EVENT_TYPES, WORLD_WIDTH, WORLD_HEIGHT, ROLE_BUILDING_MAP } from './types';
import { createWorldModel } from './worldModel';
import { LOCATION_DEFS, OUTDOOR_STATIONS, ACTIVITY_TEMPLATES } from './locationDefs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addUnique(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr : [...arr, val];
}

/** Simple string hash for deterministic seeding. */
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ---------------------------------------------------------------------------
// State initializers
// ---------------------------------------------------------------------------

export function ensureWorldState(existing?: WorldState | null): WorldState {
  if (existing) return existing;
  return {
    world: createWorldModel(),
    agents: {},
    avatars: {},
    runs: {},
    meta: { lastEventAt: 0 },
  };
}

export function ensureAgent(state: WorldState, agentId: string, agentName?: string): Agent {
  if (state.agents[agentId]) {
    if (agentName && agentName !== state.agents[agentId].name) {
      state.agents[agentId].name = agentName;
    }
    return state.agents[agentId];
  }
  const agent: Agent = {
    id: agentId,
    name: agentName || agentId,
    zone: 'idle',
    activity: 'idle',
    tasks: [],
    currentRunId: null,
    lastTool: null,
    lastEventAt: 0,
  };
  state.agents[agentId] = agent;
  return agent;
}

export function ensureRun(state: WorldState, runId: string, agentId: string, now: number): Run {
  if (state.runs[runId]) {
    const run = state.runs[runId];
    run.agentIds = addUnique(run.agentIds, agentId);
    return run;
  }
  const run: Run = {
    id: runId,
    status: 'running',
    agentIds: [agentId],
    taskIds: [],
    startedAt: now,
    completedAt: null,
  };
  state.runs[runId] = run;
  return run;
}

export function upsertTask(agent: Agent, taskId: string, label: string, status: Task['status'], now: number): Task {
  let task = agent.tasks.find(t => t.id === taskId);
  if (task) {
    task.status = status;
    task.label = label || task.label;
    task.updatedAt = now;
  } else {
    task = { id: taskId, status, label: label || taskId, updatedAt: now };
    agent.tasks.push(task);
  }
  return task;
}

// ---------------------------------------------------------------------------
// Spawn / position logic
// ---------------------------------------------------------------------------

export function collectSpawnCandidates(world: WorldState['world']): { x: number; y: number }[] {
  const candidates: { x: number; y: number }[] = [];
  const tiles = world.tiles;
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      const t = tiles[y][x].type;
      if (t === 'path' || t === 'stone') {
        candidates.push({ x, y });
      }
    }
  }
  return candidates;
}

export function deriveInitialAvatarPosition(
  agentId: string,
  world: WorldState['world']
): { x: number; y: number } {
  const candidates = collectSpawnCandidates(world);
  if (candidates.length === 0) {
    return { x: Math.floor(WORLD_WIDTH / 2), y: Math.floor(WORLD_HEIGHT / 2) };
  }
  const seed = hashString(agentId);
  return candidates[seed % candidates.length];
}

export function ensureAvatar(state: WorldState, agentId: string, agentName?: string): AvatarState {
  if (state.avatars[agentId]) return state.avatars[agentId];

  const pos = deriveInitialAvatarPosition(agentId, state.world);
  const avatar: AvatarState = {
    id: `avatar_${agentId}`,
    agentId,
    x: pos.x,
    y: pos.y,
    displayName: agentName || agentId,
    state: 'idle',
    moving: true,
    currentTaskId: null,
    bubbleText: '',
    lastUpdatedAt: 0,
    destination: null,
  };
  state.avatars[agentId] = avatar;
  return avatar;
}

// ---------------------------------------------------------------------------
// Activity text
// ---------------------------------------------------------------------------

export function getActiveTask(agent: Agent): Task | null {
  const active = agent.tasks.filter(t => t.status === 'assigned' || t.status === 'in_progress');
  if (active.length === 0) return null;
  active.sort((a, b) => b.updatedAt - a.updatedAt);
  return active[0];
}

export function pickActivityText(agent: Agent): string {
  const category = agent.activity === 'working' ? 'working' : 'idle';
  const templates = ACTIVITY_TEMPLATES[category] || ACTIVITY_TEMPLATES.idle;
  const seed = hashString(agent.id + String(agent.lastEventAt));
  return templates[seed % templates.length];
}

// ---------------------------------------------------------------------------
// Avatar sync
// ---------------------------------------------------------------------------

export function syncAvatarFromAgent(state: WorldState, agentId: string): void {
  const agent = state.agents[agentId];
  if (!agent) return;
  const avatar = ensureAvatar(state, agentId, agent.name);

  avatar.state = agent.activity === 'working' ? 'working' : 'idle';
  avatar.displayName = agent.name;
  avatar.bubbleText = pickActivityText(agent);
  avatar.lastUpdatedAt = agent.lastEventAt;

  const task = getActiveTask(agent);
  avatar.currentTaskId = task ? task.id : null;

  // All avatars should move (client-side pathfinding handles movement).
  // The avatar runtime will seat them at stations once they arrive.
  avatar.moving = true;

  // Derive destination from zone
  const dest = deriveDestinationForZone(agent, state.world);
  if (dest) {
    avatar.destination = dest;
  }
}

function deriveDestinationForZone(
  agent: Agent,
  world: WorldState['world']
): StationDestination | null {
  const seed = hashString(agent.id + agent.zone + String(agent.lastEventAt));
  const role = agent.role || 'worker';
  const preferredBuildingId = ROLE_BUILDING_MAP[role] || null;

  if (agent.zone === 'idle') {
    // Idle agents: prefer outdoor stations near their role building, then any outdoor
    const outdoor = world.outdoorStations;
    if (outdoor.length === 0) return null;

    // Try to find outdoor stations near preferred building first
    if (preferredBuildingId) {
      const building = world.locations.find(l => l.id === preferredBuildingId);
      if (building) {
        const nearStations = outdoor.filter(s => {
          const sx = s.x ?? 0;
          const sy = s.y ?? 0;
          const dx = Math.abs(sx - (building.x + Math.floor(building.w / 2)));
          const dy = Math.abs(sy - (building.y + Math.floor(building.h / 2)));
          return dx <= 8 && dy <= 8;
        });
        if (nearStations.length > 0) {
          const s = nearStations[seed % nearStations.length];
          return {
            stationId: s.id,
            stationLabel: s.label,
            stationKind: s.kind,
            stationActivity: s.activity || null,
            x: s.x ?? 14,
            y: s.y ?? 14,
          };
        }
      }
    }

    // Fallback: any outdoor station
    const s = outdoor[seed % outdoor.length];
    return {
      stationId: s.id,
      stationLabel: s.label,
      stationKind: s.kind,
      stationActivity: s.activity || null,
      x: s.x ?? 14,
      y: s.y ?? 14,
    };
  }

  // Working zones: prefer stations in the role's building
  const workKind = agent.zone === 'blocked' ? 'rest' : 'work';

  // First try: stations in the preferred building
  if (preferredBuildingId) {
    const building = world.locations.find(l => l.id === preferredBuildingId);
    if (building) {
      const buildingStations = building.stations.filter(st => st.kind === workKind);
      if (buildingStations.length > 0) {
        const pick = buildingStations[seed % buildingStations.length];
        return {
          stationId: pick.id,
          locationId: building.id,
          locationName: building.name,
          stationLabel: pick.label,
          stationKind: pick.kind,
          stationActivity: null,
          x: building.x + pick.dx,
          y: building.y + pick.dy,
        };
      }
      // No matching kind — try any station in the building
      if (building.stations.length > 0) {
        const pick = building.stations[seed % building.stations.length];
        return {
          stationId: pick.id,
          locationId: building.id,
          locationName: building.name,
          stationLabel: pick.label,
          stationKind: pick.kind,
          stationActivity: null,
          x: building.x + pick.dx,
          y: building.y + pick.dy,
        };
      }
    }
  }

  // Fallback: any building's matching station
  const allStations: { station: Station; loc: Location }[] = [];
  for (const loc of world.locations) {
    for (const st of loc.stations) {
      if (st.kind === workKind) {
        allStations.push({ station: st, loc });
      }
    }
  }

  if (allStations.length > 0) {
    const pick = allStations[seed % allStations.length];
    return {
      stationId: pick.station.id,
      locationId: pick.loc.id,
      locationName: pick.loc.name,
      stationLabel: pick.station.label,
      stationKind: pick.station.kind,
      stationActivity: null,
      x: pick.loc.x + pick.station.dx,
      y: pick.loc.y + pick.station.dy,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Event normalization / validation
// ---------------------------------------------------------------------------

export function normalizeWorldEvent(raw: Record<string, any>): WorldEvent {
  const eventType = (raw.event_type || raw.eventType || '') as string;
  const agentId = (raw.agent_id || raw.agentId || '') as string;
  const agentName = (raw.agent_name || raw.agentName || undefined) as string | undefined;
  const taskId = (raw.task_id || raw.taskId || undefined) as string | undefined;
  const taskLabel = (raw.task_label || raw.taskLabel || undefined) as string | undefined;
  const taskStatus = (raw.task_status || raw.taskStatus || undefined) as string | undefined;
  const runId = (raw.run_id || raw.runId || undefined) as string | undefined;
  const toolName = (raw.tool_name || raw.toolName || undefined) as string | undefined;
  const timestamp = (raw.timestamp || undefined) as number | undefined;

  return {
    event_type: eventType as EventType,
    agent_id: agentId,
    agent_name: agentName,
    task_id: taskId,
    task_label: taskLabel,
    task_status: taskStatus,
    run_id: runId,
    tool_name: toolName,
    timestamp,
  };
}

export function validateWorldEvent(event: WorldEvent): string | null {
  if (!event.event_type) return 'missing event_type';
  if (!(VALID_EVENT_TYPES as readonly string[]).includes(event.event_type)) {
    return `invalid event_type: ${event.event_type}`;
  }
  if (!event.agent_id) return 'missing agent_id';
  return null;
}

// ---------------------------------------------------------------------------
// Core event application
// ---------------------------------------------------------------------------

export function applyWorldEvent(state: WorldState, event: WorldEvent): void {
  const now = event.timestamp || Date.now();
  const agent = ensureAgent(state, event.agent_id, event.agent_name);
  agent.lastEventAt = now;
  state.meta.lastEventAt = Math.max(state.meta.lastEventAt, now);

  switch (event.event_type) {
    case 'task_created': {
      const taskId = event.task_id || `task_${now}`;
      upsertTask(agent, taskId, event.task_label || '', 'created', now);
      agent.zone = 'intake';
      agent.activity = 'working';
      if (event.run_id) {
        const run = ensureRun(state, event.run_id, agent.id, now);
        run.taskIds = addUnique(run.taskIds, taskId);
        agent.currentRunId = event.run_id;
      }
      break;
    }

    case 'task_assigned': {
      const taskId = event.task_id || `task_${now}`;
      upsertTask(agent, taskId, event.task_label || '', 'assigned', now);
      agent.zone = 'planning';
      agent.activity = 'working';
      if (event.run_id) {
        const run = ensureRun(state, event.run_id, agent.id, now);
        run.taskIds = addUnique(run.taskIds, taskId);
        agent.currentRunId = event.run_id;
      }
      break;
    }

    case 'task_paused': {
      const taskId = event.task_id || `task_${now}`;
      upsertTask(agent, taskId, event.task_label || '', 'paused', now);
      // If all tasks are paused, go idle; otherwise blocked
      const hasActive = agent.tasks.some(t => t.status === 'assigned' || t.status === 'in_progress');
      agent.zone = hasActive ? 'blocked' : 'idle';
      agent.activity = 'idle';
      break;
    }

    case 'tool_called': {
      agent.zone = 'tools';
      agent.activity = 'working';
      agent.lastTool = event.tool_name || null;
      // Mark relevant task as in_progress
      if (event.task_id) {
        upsertTask(agent, event.task_id, event.task_label || '', 'in_progress', now);
      }
      if (event.run_id) {
        ensureRun(state, event.run_id, agent.id, now);
        agent.currentRunId = event.run_id;
      }
      break;
    }

    case 'task_completed': {
      const taskId = event.task_id || `task_${now}`;
      upsertTask(agent, taskId, event.task_label || '', 'completed', now);
      agent.zone = 'done';
      agent.activity = 'working';
      if (event.run_id) {
        ensureRun(state, event.run_id, agent.id, now);
      }
      // If no more active tasks, go idle
      const remaining = agent.tasks.filter(t => t.status !== 'completed');
      if (remaining.length === 0) {
        agent.activity = 'idle';
        agent.zone = 'idle';
      }
      break;
    }

    case 'run_started': {
      if (event.run_id) {
        ensureRun(state, event.run_id, agent.id, now);
        agent.currentRunId = event.run_id;
      }
      agent.zone = 'planning';
      agent.activity = 'working';
      break;
    }

    case 'run_completed': {
      if (event.run_id && state.runs[event.run_id]) {
        const run = state.runs[event.run_id];
        run.status = 'completed';
        run.completedAt = now;
      }
      agent.zone = 'idle';
      agent.activity = 'idle';
      agent.currentRunId = null;
      break;
    }
  }

  // Sync avatar state after every event
  ensureAvatar(state, agent.id, agent.name);
  syncAvatarFromAgent(state, agent.id);
}

// ---------------------------------------------------------------------------
// Batch processing
// ---------------------------------------------------------------------------

export function processWorldEvents(
  state: WorldState | null | undefined,
  events: Array<Record<string, any>>
): WorldState {
  const ws = ensureWorldState(state);

  if (!Array.isArray(events)) return ws;

  for (const raw of events) {
    const event = normalizeWorldEvent(raw);
    const error = validateWorldEvent(event);
    if (error) {
      console.warn(`[eventsPipeline] skipping invalid event: ${error}`, raw);
      continue;
    }
    applyWorldEvent(ws, event);
  }

  return ws;
}
