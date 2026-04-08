// World dimensions
export const WORLD_WIDTH = 60;
export const WORLD_HEIGHT = 60;
export const DEFAULT_TILE_TYPE = 'grass';

// Valid event types
export const VALID_EVENT_TYPES = ['task_created','task_assigned','task_paused','tool_called','task_completed','run_started','run_completed'] as const;
export type EventType = typeof VALID_EVENT_TYPES[number];

// Tile types
export type TileType = 'grass' | 'dirt' | 'path' | 'sand' | 'stone' | 'water';

export interface Tile {
  x: number;
  y: number;
  type: TileType;
}

export interface Zone {
  x1: number; y1: number; x2: number; y2: number;
  floor: string; // hex color
}

export interface InteriorWall {
  x1: number; y1: number; x2: number; y2: number;
}

export interface Station {
  id: string;
  kind: 'work' | 'rest';
  type: string; // furniture sprite key
  dx: number;
  dy: number;
  label: string;
  flipX?: boolean;
  flipY?: boolean;
  // For outdoor stations (absolute coords)
  x?: number;
  y?: number;
  activity?: string;
  locationId?: string;
  locationName?: string;
}

export interface Location {
  id: string;
  name: string;
  type: string; // sprite key
  x: number;
  y: number;
  w: number;
  h: number;
  subLocations: string[];
  stations: Station[];
  zones: Zone[];
  interiorWalls: InteriorWall[];
}

export interface TreeDef {
  x: number;
  y: number;
  type: string; // sprite key like 'prop.tree', 'prop.tree.alt', etc.
  flipX?: boolean;
  flipY?: boolean;
}

export interface WorldLayout {
  version: number;
  indoorStations: (Station & { locationId: string })[];
  outdoorStations: Station[];
  trees: TreeDef[];
  buildings?: LocationLayoutDef[];
}

export interface LocationLayoutDef {
  id: string;
  name: string;
  type: string;
  x: number; y: number;
  w: number; h: number;
  flipX?: boolean;
  flipY?: boolean;
}

export interface World {
  width: number;
  height: number;
  defaultTile: string;
  tiles: Tile[][];
  locations: Location[];
  outdoorStations: Station[];
  trees: TreeDef[];
}

export interface Task {
  id: string;
  status: 'created' | 'assigned' | 'in_progress' | 'paused' | 'completed';
  label: string;
  updatedAt: number;
}

export interface Agent {
  id: string;
  name: string;
  zone: 'idle' | 'intake' | 'planning' | 'blocked' | 'tools' | 'done';
  activity: 'idle' | 'working';
  tasks: Task[];
  currentRunId: string | null;
  lastTool: string | null;
  lastEventAt: number;
  role?: GenySessionRole;
}

export interface AvatarState {
  id: string;
  agentId: string;
  x: number;
  y: number;
  displayName: string;
  state: 'idle' | 'working';
  moving: boolean;
  currentTaskId: string | null;
  bubbleText: string;
  lastUpdatedAt: number;
  destination: { x: number; y: number; locationId?: string; stationId?: string } | null;
  authoritativePosition?: boolean;
}

export interface AvatarRuntime extends AvatarState {
  direction: 'up' | 'down' | 'left' | 'right';
  nextMoveAt: number;
  path: { x: number; y: number }[] | null;
  pathIndex: number;
  arrivalPauseUntil: number;
  agentSeed: number;
  currentDestination: StationDestination | null;
  lastStationId: string | null;
  seated: boolean;
  talking: boolean;
  walkFrame: number;
  walkFrameTime: number;
  // Chat state
  chatPauseUntil: number;
  chatPartnerId: string | null;
  chatQueue: ChatQueueItem[] | null;
  chatCooldownUntil: number;
  chatRecentPartners: Record<string, number>;
  chat: { text: string; expiresAt: number } | null;
}

export interface ChatQueueItem {
  text: string;
  showAt: number;
  expireAt: number;
}

export interface StationDestination {
  stationId?: string;
  locationId?: string;
  locationName?: string;
  stationLabel?: string;
  stationKind?: string;
  stationActivity?: string | null;
  x: number;
  y: number;
}

export interface Run {
  id: string;
  status: 'running' | 'completed';
  agentIds: string[];
  taskIds: string[];
  startedAt: number;
  completedAt: number | null;
}

export interface WorldState {
  world: World;
  agents: Record<string, Agent>;
  avatars: Record<string, AvatarState>;
  runs: Record<string, Run>;
  meta: {
    lastEventAt: number;
  };
}

export interface WorldEvent {
  event_type: EventType;
  agent_id: string;
  agent_name?: string;
  task_id?: string;
  task_label?: string;
  task_status?: string;
  run_id?: string;
  tool_name?: string;
  timestamp?: number;
}

// Sprite system types
export interface SpriteFrame {
  sx: number; sy: number;
  sw: number; sh: number;
}

export interface SpriteGridFrame {
  mode: 'grid';
  columns: number; rows: number;
  column: number; row: number;
}

export interface SpriteCandidate {
  url: string;
  frame: SpriteFrame | SpriteGridFrame;
}

export interface SpriteDefinition {
  key: string;
  candidates: SpriteCandidate[];
}

export interface FurnitureSprite {
  key: string;
  url: string;
  frame: SpriteFrame;
}

export interface FurnitureRenderSize {
  w: number;
  h: number;
}

// Editor types
export interface EditorState {
  active: boolean;
  selectedItem: EditorItem | null;
  undoStack: WorldLayout[];
  redoStack: WorldLayout[];
  dirty: boolean;
  activeToolTab: 'buildings' | 'stations' | 'trees';
}

export interface EditorItem {
  type: 'indoor' | 'outdoor' | 'tree';
  id: string;
  data: Station | TreeDef;
}

// Color palette
export const COLORS = {
  background: '#10200f',
  border: '#375934',
  grassA: '#5aad5e',
  grassB: '#62b866',
  dirt: '#c4a46c',
  path: '#d4c4a0',
  sand: '#e0d3a8',
  water: '#5a9ec4',
  stone: '#b0b0a8',
  idleAvatar: '#f2f7ff',
  workingAvatar: '#ffc857',
  avatarOutline: '#1a1f2b',
  label: '#f5ffef',
  propShadow: 'rgba(0, 0, 0, 0.18)',
  bubbleBg: '#fff8e4',
  bubbleBgWorking: '#ffe8b0',
  bubbleBorder: '#6b4a25',
  bubbleText: '#3e2a15',
  bubbleShadow: 'rgba(30, 20, 10, 0.3)',
  signPlank: '#9a6a3a',
  signPlankDark: '#6b4425',
  signPlankBorder: '#3e2814',
  signText: '#fff3d6',
  signTextShadow: 'rgba(0, 0, 0, 0.5)',
  signRivet: '#d4b080',
  nameText: '#ffffff',
  nameTextWorking: '#ffe180',
  nameOutline: '#1a1208',
} as const;

// Floor colors for building zones
export const FLOOR_COLORS = {
  WOOD: '#d4b88c',
  TILE: '#b8c4d0',
  CARPET: '#b89976',
  SOFT: '#e0d0a8',
  CONCRETE: '#a8a8a0',
  RED: '#b07060',
  GREEN: '#8fa878',
  DARK: '#6b5a42',
} as const;

// Rendering constants
export const MIN_TILE_SIZE = 10;
export const MAX_TILE_SIZE = 36;
export const BASE_MOVE_INTERVAL_MS = 380;
export const WALK_FRAME_INTERVAL_MS = 180;
export const DEFAULT_ASSET_ROOT = '/assets/pixymoon';

// Session to agent mapping types (for Geny integration)
export type GenySessionRole = 'worker' | 'developer' | 'researcher' | 'planner' | 'vtuber';
export type GenySessionStatus = 'running' | 'stopped' | 'error' | 'idle';

export interface SessionToAgentMapping {
  role: GenySessionRole;
  buildingId: string;
  buildingName: string;
}

export const ROLE_BUILDING_MAP: Record<GenySessionRole, string> = {
  developer: 'home_nw',
  researcher: 'library',
  worker: 'store',
  planner: 'office',
  vtuber: 'cafe',
};
