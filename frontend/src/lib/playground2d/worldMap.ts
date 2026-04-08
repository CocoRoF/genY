/**
 * WorldMap — Canvas-based 2D world renderer.
 * Ported from agent-world/frontend/components/WorldMap.js
 *
 * Renders: terrain, decorations, building interiors, furniture, trees/props,
 * avatars (direction sprites + walk animation), speech bubbles, location signs,
 * agent roster panel, agent profile panel, time display, day/night overlay.
 */

import type {
  AvatarRuntime, AvatarState, WorldState, Location, Station, Tile, TileType,
} from './types';
import { COLORS, MIN_TILE_SIZE, MAX_TILE_SIZE, WALK_FRAME_INTERVAL_MS, DEFAULT_ASSET_ROOT } from './types';
import { SpriteStore, LoadedSprite, inferBuildingSpriteKey, inferPropSpriteKey, inferDecoSpriteKey, chooseTerrainSpriteKey, CHARACTERS_PER_SHEET } from './spriteManager';
import { resolveFurnitureKey, resolveFurnitureType, FURNITURE_RENDER_SIZE } from './furnitureCatalog';
import { syncAvatarRuntimeEntries, advanceAvatarRuntimeEntries } from './avatarRuntime';

// ─── Helpers ───

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function hashCoord(seed: number, x: number, y: number): number {
  return (seed ^ (x * 73856093) ^ (y * 19349663)) >>> 0;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const sr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + sr, y);
  ctx.lineTo(x + w - sr, y);
  ctx.arcTo(x + w, y, x + w, y + sr, sr);
  ctx.lineTo(x + w, y + h - sr);
  ctx.arcTo(x + w, y + h, x + w - sr, y + h, sr);
  ctx.lineTo(x + sr, y + h);
  ctx.arcTo(x, y + h, x, y + h - sr, sr);
  ctx.lineTo(x, y + sr);
  ctx.arcTo(x, y, x + sr, y, sr);
}

// ─── Scene Layout Builder ───

interface SceneBuilding {
  x: number; y: number;
  widthTiles: number; heightTiles: number;
  type: string; spriteKey: string;
  locationId?: string; locationName?: string;
  stations?: Station[];
  zones?: { x1: number; y1: number; x2: number; y2: number; floor: string }[];
  interiorWalls?: { x1: number; y1: number; x2: number; y2: number }[];
  flipX?: boolean; flipY?: boolean;
}

interface SceneProp {
  x: number; y: number; type: string; spriteKey: string;
  widthTiles: number; heightTiles: number;
  flipX?: boolean; flipY?: boolean;
}

interface SceneDecoration {
  x: number; y: number; type: string; spriteKey: string;
}

interface SceneLayout {
  width: number;
  height: number;
  tiles: string[][];
  buildings: SceneBuilding[];
  props: SceneProp[];
  decorations: SceneDecoration[];
  blockedTiles: Set<string>;
  interiorTiles: Set<string>;
  locations: Location[];
  stations: Station[];
}

function worldDimensions(state: WorldState | null): { width: number; height: number } {
  const world = state?.world;
  if (!world) return { width: 60, height: 60 };
  return {
    width: world.width > 0 ? world.width : 60,
    height: world.height > 0 ? world.height : 60,
  };
}

function normalizeTiles(state: WorldState | null, width: number, height: number): string[][] {
  const world = state?.world;
  const defaultTile = world?.defaultTile || 'grass';
  const rows = world?.tiles || [];
  return Array.from({ length: height }, (_, y) => {
    const row = rows[y] || [];
    return Array.from({ length: width }, (_, x) => {
      const cell = row[x];
      if (!cell) return defaultTile;
      if (typeof cell === 'string') return cell;
      return (cell as Tile).type || defaultTile;
    });
  });
}

function normalizeAvatars(state: WorldState | null): Record<string, AvatarState> {
  if (!state) return {};
  const { width, height } = worldDimensions(state);
  const sourceAvatars = state.avatars || {};
  const agents = state.agents || {};
  const normalized: Record<string, AvatarState> = {};

  Object.entries(sourceAvatars).forEach(([avatarId, avatar]) => {
    if (!avatar) return;
    const agentId = avatar.agentId || avatarId;
    const matchedAgent = agents[agentId];
    normalized[agentId] = {
      id: agentId,
      agentId,
      displayName: matchedAgent?.name || agentId.slice(0, 8),
      x: Number.isFinite(avatar.x) ? clamp(avatar.x, 0, width - 1) : 0,
      y: Number.isFinite(avatar.y) ? clamp(avatar.y, 0, height - 1) : 0,
      authoritativePosition: avatar.moving === false,
      moving: avatar.moving !== false,
      state: avatar.state === 'working' ? 'working' : 'idle',
      bubbleText: typeof avatar.bubbleText === 'string' ? avatar.bubbleText.trim() : '',
      destination: avatar.destination || null,
      currentTaskId: avatar.currentTaskId || null,
      lastUpdatedAt: avatar.lastUpdatedAt || 0,
    };
  });

  // Create avatars for agents without one
  Object.entries(agents).forEach(([agentId, agent]) => {
    if (normalized[agentId]) return;
    const hash = hashString(agentId);
    const task = agent.tasks?.find(t => t.status !== 'completed');
    normalized[agentId] = {
      id: agentId,
      agentId,
      displayName: agent.name || agentId.slice(0, 8),
      x: hash % width,
      y: Math.floor(hash / width) % height,
      moving: true,
      state: task ? 'working' : 'idle',
      bubbleText: task?.label || '',
      destination: null,
      currentTaskId: task?.id || null,
      lastUpdatedAt: 0,
      authoritativePosition: false,
    };
  });

  return normalized;
}

function overlapsBuilding(x: number, y: number, buildings: SceneBuilding[]): boolean {
  return buildings.some(b => {
    const x2 = b.x + b.widthTiles - 1;
    const y2 = b.y + b.heightTiles - 1;
    return x >= b.x && x <= x2 && y >= b.y && y <= y2;
  });
}

export function buildSceneLayout(state: WorldState): SceneLayout {
  const { width, height } = worldDimensions(state);
  const tiles = normalizeTiles(state, width, height);
  const world = state.world;
  const worldLocations = world?.locations || [];

  // Buildings from locations
  const buildings: SceneBuilding[] = worldLocations.map(loc => ({
    x: loc.x, y: loc.y,
    widthTiles: loc.w || 5, heightTiles: loc.h || 4,
    type: loc.type || 'house',
    spriteKey: inferBuildingSpriteKey(loc.type || 'house'),
    locationId: loc.id, locationName: loc.name,
    stations: loc.stations || [],
    zones: loc.zones || [],
    interiorWalls: loc.interiorWalls || [],
    flipX: (loc as any).flipX,
    flipY: (loc as any).flipY,
  }));

  // Props (trees)
  const props: SceneProp[] = [];
  const worldTrees = world?.trees || [];
  for (const t of worldTrees) {
    if (overlapsBuilding(t.x, t.y, buildings)) continue;
    props.push({
      x: t.x, y: t.y,
      type: t.type || 'tree.alt',
      spriteKey: inferPropSpriteKey(t.type || 'tree.alt'),
      widthTiles: 1, heightTiles: 1,
      flipX: t.flipX,
      flipY: t.flipY,
    });
  }

  // Procedural trees if none provided
  if (worldTrees.length === 0) {
    const seed = hashString(`${width}:${height}`);
    const SMALL_TREES = ['tree.alt', 'tree.alt2', 'tree.alt3'];
    const BIG_TREES = ['tree.big', 'tree.big.alt'];
    const midX = Math.floor(width / 2);
    const midY = Math.floor(height / 2);
    const pickTree = (h: number, bigFreq: number): string => {
      const isBig = h % bigFreq === 0;
      if (isBig) return BIG_TREES[(h >>> 3) % BIG_TREES.length];
      return SMALL_TREES[(h >>> 3) % SMALL_TREES.length];
    };
    // Top edge - big tree 1 in 5
    for (let x = 0; x < width; x++) {
      if (overlapsBuilding(x, 1, buildings)) continue;
      const h = hashCoord(seed, x, 1);
      if (h % 3 !== 2) {
        const tt = pickTree(h, 5);
        props.push({ x, y: 1, type: tt, spriteKey: inferPropSpriteKey(tt), widthTiles: 1, heightTiles: 1 });
      }
    }
    // Bottom edge - big tree 1 in 4
    for (let x = 0; x < width; x++) {
      if (overlapsBuilding(x, height - 2, buildings)) continue;
      const h = hashCoord(seed, x, height - 2);
      if (h % 3 !== 2) {
        const tt = pickTree(h, 4);
        props.push({ x, y: height - 2, type: tt, spriteKey: inferPropSpriteKey(tt), widthTiles: 1, heightTiles: 1 });
      }
    }
    // Left & right edges - big tree 1 in 6
    for (let y = 2; y < height - 2; y++) {
      if (!overlapsBuilding(0, y, buildings)) {
        const h = hashCoord(seed, 0, y);
        if (h % 3 !== 2) {
          const tt = pickTree(h, 6);
          props.push({ x: 0, y, type: tt, spriteKey: inferPropSpriteKey(tt), widthTiles: 1, heightTiles: 1 });
        }
      }
      if (!overlapsBuilding(width - 1, y, buildings)) {
        const h = hashCoord(seed, width - 1, y);
        if (h % 3 !== 2) {
          const tt = pickTree(h, 6);
          props.push({ x: width - 1, y, type: tt, spriteKey: inferPropSpriteKey(tt), widthTiles: 1, heightTiles: 1 });
        }
      }
    }
    // Second border ring - sparse, big tree 1 in 8
    for (let y = 2; y < height - 2; y++) {
      if (!overlapsBuilding(1, y, buildings)) {
        const h = hashCoord(seed + 1, 1, y);
        if (h % 4 === 0) {
          const tt = pickTree(h, 8);
          props.push({ x: 1, y, type: tt, spriteKey: inferPropSpriteKey(tt), widthTiles: 1, heightTiles: 1 });
        }
      }
      if (!overlapsBuilding(width - 2, y, buildings)) {
        const h = hashCoord(seed + 1, width - 2, y);
        if (h % 4 === 0) {
          const tt = pickTree(h, 8);
          props.push({ x: width - 2, y, type: tt, spriteKey: inferPropSpriteKey(tt), widthTiles: 1, heightTiles: 1 });
        }
      }
    }
    // Interior trees - big tree 1 in 3
    const interiorTreePositions: [number, number][] = [
      [midX - 5, midY - 3], [midX + 5, midY - 3],
      [midX - 5, midY + 3], [midX + 5, midY + 3],
      [7, midY], [width - 8, midY],
      [midX - 3, midY + 6], [midX + 3, midY - 6],
      [4, midY - 2], [width - 5, midY + 2],
    ];
    for (const [tx, ty] of interiorTreePositions) {
      if (tx < 2 || tx >= width - 2 || ty < 2 || ty >= height - 2) continue;
      if (overlapsBuilding(tx, ty, buildings)) continue;
      const tileType = tiles[ty]?.[tx];
      if (tileType === 'path' || tileType === 'water' || tileType === 'sand') continue;
      const h = hashCoord(seed + 7, tx, ty);
      const treeType = pickTree(h, 3);
      props.push({ x: tx, y: ty, type: treeType, spriteKey: inferPropSpriteKey(treeType), widthTiles: 1, heightTiles: 1 });
    }
  }

  // Scatter rocks
  const seed = hashString(`${width}:${height}`);
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      if (overlapsBuilding(x, y, buildings)) continue;
      const tt = tiles[y]?.[x];
      if (tt === 'path' || tt === 'water' || tt === 'sand') continue;
      const value = hashCoord(seed, x, y) % 400;
      if (value === 0) props.push({ x, y, type: 'rock', spriteKey: 'prop.rock', widthTiles: 1, heightTiles: 1 });
      else if (value === 1) props.push({ x, y, type: 'rock.small', spriteKey: 'prop.rock.small', widthTiles: 1, heightTiles: 1 });
    }
  }

  // Mining quarry clusters - visible rock piles around mining spots
  const rockPiles = [
    { cx: 17, cy: 3 },
    { cx: 18, cy: 27 },
  ];
  const pileOffsets: [number, number][] = [[1, 0], [-1, 0], [0, -1], [1, -1], [-1, 1], [2, 0]];
  for (const pile of rockPiles) {
    pileOffsets.forEach(([pdx, pdy], idx) => {
      const rx = pile.cx + pdx;
      const ry = pile.cy + pdy;
      if (rx < 1 || rx >= width - 1 || ry < 1 || ry >= height - 1) return;
      if (overlapsBuilding(rx, ry, buildings)) return;
      const rtt = tiles[ry]?.[rx];
      if (rtt === 'path' || rtt === 'water' || rtt === 'sand') return;
      const rtype = idx % 2 === 0 ? 'rock' : 'rock.small';
      props.push({ x: rx, y: ry, type: rtype, spriteKey: idx % 2 === 0 ? 'prop.rock' : 'prop.rock.small', widthTiles: 1, heightTiles: 1 });
    });
  }

  // Decorations (flowers)
  const decorations: SceneDecoration[] = [];
  const gardenClusters = [
    { cx: 10, cy: 10, r: 2.2, theme: 'pink' },
    { cx: 21, cy: 7, r: 1.8, theme: 'purple' },
    { cx: 10, cy: 22, r: 2.2, theme: 'red' },
    { cx: 20, cy: 22, r: 2.2, theme: 'mixed' },
    { cx: 13, cy: 11, r: 1.5, theme: 'mixed' },
    { cx: 13, cy: 17, r: 1.5, theme: 'pink' },
  ];
  const clusterThemes: Record<string, string[]> = {
    pink: ['flower.pink', 'flower.mixed'],
    purple: ['flower.purple', 'flower.mixed'],
    red: ['flower.red', 'flower.mixed'],
    mixed: ['flower.pink', 'flower.purple', 'flower.red', 'flower.mixed'],
  };

  for (const cl of gardenClusters) {
    for (let y = Math.max(2, Math.floor(cl.cy - cl.r)); y <= Math.min(height - 3, Math.ceil(cl.cy + cl.r)); y++) {
      for (let x = Math.max(2, Math.floor(cl.cx - cl.r)); x <= Math.min(width - 3, Math.ceil(cl.cx + cl.r)); x++) {
        const dx = x - cl.cx, dy = y - cl.cy;
        if (dx * dx + dy * dy > cl.r * cl.r) continue;
        if (tiles[y]?.[x] !== 'grass') continue;
        if (overlapsBuilding(x, y, buildings)) continue;
        if (hashCoord(seed + 11, x, y) % 3 === 0) continue;
        const pool = clusterThemes[cl.theme] || clusterThemes.mixed;
        const idx = hashCoord(seed + 13, x, y) % pool.length;
        decorations.push({ x, y, type: pool[idx], spriteKey: inferDecoSpriteKey(pool[idx]) });
      }
    }
  }

  // Sparse background flowers on open grass (outside clusters)
  for (let sy = 2; sy < height - 2; sy++) {
    for (let sx = 2; sx < width - 2; sx++) {
      const stt = tiles[sy]?.[sx];
      if (stt !== 'grass') continue;
      if (overlapsBuilding(sx, sy, buildings)) continue;
      if (decorations.some(d => d.x === sx && d.y === sy)) continue;
      const sval = hashCoord(seed + 7, sx, sy) % 80;
      if (sval < 2) {
        const flowerTypes = ['flower.pink', 'flower.purple', 'flower.mixed', 'flower.red'];
        const ft = flowerTypes[sval % 4];
        decorations.push({ x: sx, y: sy, type: ft, spriteKey: inferDecoSpriteKey(ft) });
      }
    }
  }

  // Blocked tiles computation
  const blockedTiles = new Set<string>();
  const interiorTiles = new Set<string>();
  buildings.forEach(b => {
    for (let by = b.y; by < b.y + b.heightTiles; by++) {
      for (let bx = b.x; bx < b.x + b.widthTiles; bx++) {
        const isEdge = bx === b.x || bx === b.x + b.widthTiles - 1 || by === b.y || by === b.y + b.heightTiles - 1;
        if (isEdge) {
          const isDoor = by === b.y + b.heightTiles - 1 && bx > b.x && bx < b.x + b.widthTiles - 1;
          if (!isDoor) blockedTiles.add(`${bx},${by}`);
        }
        if (!isEdge || (by === b.y + b.heightTiles - 1 && bx > b.x && bx < b.x + b.widthTiles - 1)) {
          interiorTiles.add(`${bx},${by}`);
        }
      }
    }
  });
  props.forEach(p => blockedTiles.add(`${p.x},${p.y}`));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y]?.[x] === 'water') blockedTiles.add(`${x},${y}`);
    }
  }

  // Flat station list for avatar routing
  const stations: Station[] = [];
  buildings.forEach(b => {
    const list = b.stations || [];
    for (const st of list) {
      stations.push({
        id: st.id, kind: st.kind, type: st.type,
        label: st.label || st.id,
        dx: st.dx, dy: st.dy,
        locationId: b.locationId, locationName: b.locationName,
        x: b.x + (st.dx || 0), y: b.y + (st.dy || 0),
      });
    }
  });
  const outdoorSource = world?.outdoorStations || [];
  for (const os of outdoorSource) {
    stations.push({
      id: os.id, kind: os.kind, type: os.type,
      label: os.label || os.id, dx: 0, dy: 0,
      activity: os.activity,
      locationId: undefined, locationName: os.label || 'outdoors',
      x: os.x, y: os.y,
    });
  }

  return { width, height, tiles, buildings, props, decorations, blockedTiles, interiorTiles, locations: worldLocations, stations };
}

// ─── WorldMap Class ───

type SkyMode = 'day' | 'night' | 'clock';

interface EditorLike {
  onCanvasMouseDown: (tileX: number, tileY: number, state: WorldState | null, event: MouseEvent | TouchEvent) => void;
}

interface EditorLayout {
  trees: { x: number; y: number; type?: string; flipX?: boolean; flipY?: boolean }[];
  outdoorStations: { id: string; x: number; y: number; kind?: string; type?: string; label?: string; activity?: string; flipX?: boolean; flipY?: boolean }[];
  indoorStations: { id: string; locationId: string; dx: number; dy: number; kind?: string; type?: string; label?: string; flipX?: boolean; flipY?: boolean }[];
  buildings?: { id: string; name: string; type: string; x: number; y: number; w: number; h: number; flipX?: boolean; flipY?: boolean }[];
}

interface EditorState {
  layout: EditorLayout;
  selection?: { kind: string; id: string } | null;
  pendingAdd?: { type: string } | null;
  dragging?: boolean;
}

export interface WorldMapOptions {
  assetRoot?: string;
  onAgentClick?: (agentId: string) => void;
  getCustomAvatarVariant?: (agentId: string) => number | null;
  onAvatarVariantChanged?: (agentId: string, variantIndex: number) => void;
}

export default class WorldMap {
  private root: HTMLElement;
  public canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public spriteStore: SpriteStore;
  public state: WorldState | null = null;
  private sceneLayout: SceneLayout | null = null;
  public avatarRuntime = new Map<string, AvatarRuntime>();
  private frameId: number | null = null;
  public tileSize = 24;
  public offsetX = 0;
  public offsetY = 0;
  private selectedAgent: AvatarRuntime | null = null;
  private onAgentClick?: (agentId: string) => void;
  private getCustomAvatarVariant?: (agentId: string) => number | null;
  private onAvatarVariantChanged?: (agentId: string, variantIndex: number) => void;
  // Mouse tracking for hover effects
  private lastMouseX = -1;
  private lastMouseY = -1;
  // Agent roster click regions
  private rosterHitRegions: { x: number; y: number; w: number; h: number; agentId: string }[] = [];
  // Character picker state for profile panel
  private avatarPickerScroll = 0;
  private avatarPickerHitRegions: { x: number; y: number; w: number; h: number; variantIndex: number }[] = [];
  private avatarPickerArrows: { left: { x: number; y: number; w: number; h: number } | null; right: { x: number; y: number; w: number; h: number } | null } = { left: null, right: null };
  public assetSummary: { loadedCount: number; missingKeys: string[] } | null = null;
  private skyMode: SkyMode;
  private skyBtn: HTMLButtonElement | null = null;
  private editor: EditorLike | null = null;
  private editorState: EditorState | null = null;
  private zoomLevel = 1.0;
  private baseTileSize = 24;
  private isPanning = false;
  private panX = 0;
  private panY = 0;
  private panStartX = 0;
  private panStartY = 0;
  private panStartPanX = 0;
  private panStartPanY = 0;
  private lastClickX = 0;
  private lastClickY = 0;

  constructor(root: HTMLElement, options: WorldMapOptions = {}) {
    this.root = root;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.onAgentClick = options.onAgentClick;
    this.getCustomAvatarVariant = options.getCustomAvatarVariant;
    this.onAvatarVariantChanged = options.onAvatarVariantChanged;

    this.spriteStore = new SpriteStore(options.assetRoot || DEFAULT_ASSET_ROOT);

    // Sky overlay mode
    const savedMode = typeof localStorage !== 'undefined'
      ? localStorage.getItem('playground2d-sky-mode') : null;
    this.skyMode = (savedMode === 'night' || savedMode === 'clock') ? savedMode : 'day';

    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.cursor = 'pointer';
    this.root.appendChild(this.canvas);

    // Sky mode cycler button
    const skyBtn = document.createElement('button');
    skyBtn.id = 'sky-mode-toggle';
    skyBtn.title = 'Cycle sky mode (Day / Night / Live clock)';
    const skyLabels: Record<SkyMode, string> = { day: '\u2600\uFE0F Day', night: '\uD83C\uDF19 Night', clock: '\uD83D\uDD50 Live' };
    const cycle: Record<SkyMode, SkyMode> = { day: 'night', night: 'clock', clock: 'day' };
    const refreshSkyBtn = () => { skyBtn.textContent = skyLabels[this.skyMode]; };
    Object.assign(skyBtn.style, {
      position: 'absolute', bottom: '12px', left: '12px', zIndex: '10',
      padding: '6px 10px', borderRadius: '6px',
      background: 'rgba(15,23,42,0.85)', border: '1px solid #94a3b8',
      color: '#e2e8f0', fontSize: '12px', cursor: 'pointer',
      fontFamily: 'inherit',
    });
    skyBtn.addEventListener('click', () => {
      this.setSkyMode(cycle[this.skyMode]);
      refreshSkyBtn();
    });
    refreshSkyBtn();
    this.root.appendChild(skyBtn);
    this.skyBtn = skyBtn;

    this.handleResize = this.handleResize.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);

    window.addEventListener('resize', this.handleResize);
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // suppress right-click menu for pan
    this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.handleWheel = this.handleWheel.bind(this);
    this.handlePanMove = this.handlePanMove.bind(this);
    this.handlePanEnd = this.handlePanEnd.bind(this);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    document.addEventListener('mousemove', this.handlePanMove);
    document.addEventListener('mouseup', this.handlePanEnd);
    this.handleResize();
  }

  async loadSprites(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    try {
      this.assetSummary = await this.spriteStore.load(onProgress);
      this.render(performance.now());
    } catch {
      this.assetSummary = { loadedCount: 0, missingKeys: [] };
    }
  }

  destroy(): void {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    document.removeEventListener('mousemove', this.handlePanMove);
    document.removeEventListener('mouseup', this.handlePanEnd);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    if (this.skyBtn && this.skyBtn.parentNode) this.skyBtn.parentNode.removeChild(this.skyBtn);
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }

  setWorldState(nextState: WorldState | null): void {
    this.state = nextState;
    this._refreshSceneLayout();
    this.syncRuntime();
    this.handleResize();
    this.render(performance.now());
  }

  getSelectedAgentId(): string | null {
    return this.selectedAgent?.id || null;
  }

  /** Pan the camera so that the given agent is centered on screen. */
  private panToAgent(agent: AvatarRuntime): void {
    const canvasW = parseInt(this.canvas.style.width || '0', 10) || this.canvas.width;
    const canvasH = parseInt(this.canvas.style.height || '0', 10) || this.canvas.height;
    const { width, height } = worldDimensions(this.state);
    const worldPx = width * this.tileSize;
    const worldPy = height * this.tileSize;

    // Agent position in world pixels
    const agentPx = agent.x * this.tileSize + this.tileSize / 2;
    const agentPy = agent.y * this.tileSize + this.tileSize / 2;

    // We want agent centered: offsetX + agentPx = canvasW/2
    // offsetX = floor((canvasW - worldPx)/2) + panX
    // So: panX = canvasW/2 - agentPx - floor((canvasW - worldPx)/2)
    const basePanX = Math.floor((canvasW - worldPx) / 2);
    const basePanY = Math.floor((canvasH - worldPy) / 2);
    this.panX = canvasW / 2 - agentPx - basePanX;
    this.panY = canvasH / 2 - agentPy - basePanY;
    this.handleResize();
  }

  // ─── Lifecycle ───

  start(): void {
    if (this.frameId) return;
    const loop = (timestamp: number) => {
      this.update(timestamp);
      this.render(timestamp);
      this.frameId = window.requestAnimationFrame(loop);
    };
    this.frameId = window.requestAnimationFrame(loop);
  }

  stop(): void {
    if (!this.frameId) return;
    window.cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  // ─── Resize ───

  handleResize(): void {
    const vw = this.root.clientWidth || 300;
    const vh = this.root.clientHeight || 300;
    const dpr = window.devicePixelRatio || 1;
    const width = this.state?.world?.width || 60;
    const height = this.state?.world?.height || 60;
    this.baseTileSize = clamp(Math.floor(Math.min(vw / width, vh / height)), MIN_TILE_SIZE, MAX_TILE_SIZE);
    this.tileSize = Math.max(4, Math.round(this.baseTileSize * this.zoomLevel));
    const wpx = width * this.tileSize;
    const hpx = height * this.tileSize;
    this.offsetX = Math.floor((vw - wpx) / 2) + this.panX;
    this.offsetY = Math.floor((vh - hpx) / 2) + this.panY;
    this.canvas.width = Math.floor(vw * dpr);
    this.canvas.height = Math.floor(vh * dpr);
    this.canvas.style.width = `${vw}px`;
    this.canvas.style.height = `${vh}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ─── Input ───

  private handleClick(event: MouseEvent): void {
    if (this.isPanning) return;
    // In editor mode, mousedown already handled selection/placement;
    // suppress the subsequent click handler (which would select an agent).
    if (this.editor) return;

    const rect = this.canvas.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;

    // Check avatar picker hits first (when profile panel is open)
    if (this.selectedAgent && this.avatarPickerHitRegions.length > 0) {
      for (const hr of this.avatarPickerHitRegions) {
        if (cx >= hr.x && cx <= hr.x + hr.w && cy >= hr.y && cy <= hr.y + hr.h) {
          const agentId = this.selectedAgent.agentId || this.selectedAgent.id;
          if (this.onAvatarVariantChanged) {
            this.onAvatarVariantChanged(agentId, hr.variantIndex);
          }
          return;
        }
      }
      // Check arrow hits
      const sheets = this.spriteStore.characterSheetImages;
      const totalVariants = sheets ? sheets.length * CHARACTERS_PER_SHEET : 0;
      const thumbsPerRow = Math.max(1, this.avatarPickerHitRegions.length);
      if (this.avatarPickerArrows.left) {
        const a = this.avatarPickerArrows.left;
        if (cx >= a.x && cx <= a.x + a.w && cy >= a.y && cy <= a.y + a.h) {
          this.avatarPickerScroll = Math.max(0, this.avatarPickerScroll - thumbsPerRow);
          return;
        }
      }
      if (this.avatarPickerArrows.right) {
        const a = this.avatarPickerArrows.right;
        if (cx >= a.x && cx <= a.x + a.w && cy >= a.y && cy <= a.y + a.h) {
          this.avatarPickerScroll = Math.min(totalVariants - 1, this.avatarPickerScroll + thumbsPerRow);
          return;
        }
      }
    }

    // Check roster panel clicks
    for (const hr of this.rosterHitRegions) {
      if (cx >= hr.x && cx <= hr.x + hr.w && cy >= hr.y && cy <= hr.y + hr.h) {
        const agent = this.avatarRuntime.get(hr.agentId);
        if (agent) {
          this.avatarPickerScroll = 0;
          this.selectedAgent = agent;
          this.panToAgent(agent);
          if (this.onAgentClick) this.onAgentClick(hr.agentId);
        }
        return;
      }
    }

    let closest: AvatarRuntime | null = null;
    let closestDist = Infinity;
    const hitRadius = this.tileSize * 0.8;

    this.avatarRuntime.forEach(avatar => {
      const ax = this.offsetX + avatar.x * this.tileSize + this.tileSize / 2;
      const ay = this.offsetY + avatar.y * this.tileSize + this.tileSize / 2;
      const dist = Math.sqrt((cx - ax) ** 2 + (cy - ay) ** 2);
      if (dist < hitRadius && dist < closestDist) {
        closestDist = dist;
        closest = avatar;
      }
    });

    if (closest !== this.selectedAgent) {
      this.avatarPickerScroll = 0; // Reset picker scroll when selecting a different agent
    }
    this.selectedAgent = closest;
    if (closest && this.onAgentClick) {
      this.onAgentClick((closest as AvatarRuntime).id);
    }
  }

  private handleTouchStart(event: TouchEvent): void {
    if (!event.touches || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const cx = touch.clientX - rect.left;
    const cy = touch.clientY - rect.top;

    // In editor mode, forward touch to editor as a mouse-down equivalent
    if (this.editor && typeof this.editor.onCanvasMouseDown === 'function' && this.state) {
      event.preventDefault();
      const tileX = Math.floor((cx - this.offsetX) / this.tileSize);
      const tileY = Math.floor((cy - this.offsetY) / this.tileSize);
      this.editor.onCanvasMouseDown(tileX, tileY, this.state, event);
      return;
    }

    let closest: AvatarRuntime | null = null;
    let closestDist = Infinity;
    const hitRadius = this.tileSize * 1.2;

    this.avatarRuntime.forEach(avatar => {
      const ax = this.offsetX + avatar.x * this.tileSize + this.tileSize / 2;
      const ay = this.offsetY + avatar.y * this.tileSize + this.tileSize / 2;
      const dist = Math.sqrt((cx - ax) ** 2 + (cy - ay) ** 2);
      if (dist < hitRadius && dist < closestDist) {
        closestDist = dist;
        closest = avatar;
      }
    });

    if (closest) {
      event.preventDefault();
      this.selectedAgent = closest;
      if (this.onAgentClick) this.onAgentClick((closest as AvatarRuntime).id);
    }
  }

  private handleMouseDown(event: MouseEvent): void {
    // Right-click (button 2): always start panning, even in editor mode
    if (event.button === 2) {
      event.preventDefault();
      this.isPanning = true;
      this.panStartX = event.clientX;
      this.panStartY = event.clientY;
      this.panStartPanX = this.panX;
      this.panStartPanY = this.panY;
      this.lastClickX = event.clientX;
      this.lastClickY = event.clientY;
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    if (event.button !== 0) return;

    // Left-click in editor: delegate to editor for placement/selection
    if (this.editor && typeof this.editor.onCanvasMouseDown === 'function' && this.state) {
      const rect = this.canvas.getBoundingClientRect();
      const cx = event.clientX - rect.left;
      const cy = event.clientY - rect.top;
      const tileX = Math.floor((cx - this.offsetX) / this.tileSize);
      const tileY = Math.floor((cy - this.offsetY) / this.tileSize);
      this.editor.onCanvasMouseDown(tileX, tileY, this.state, event);
      return;
    }
    // Left-click outside editor: start panning
    if (!this.editor) {
      this.isPanning = true;
      this.panStartX = event.clientX;
      this.panStartY = event.clientY;
      this.panStartPanX = this.panX;
      this.panStartPanY = this.panY;
      this.lastClickX = event.clientX;
      this.lastClickY = event.clientY;
      this.canvas.style.cursor = 'grabbing';
    }
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    // World coord under cursor before zoom
    const wxBefore = (mx - this.offsetX) / this.tileSize;
    const wyBefore = (my - this.offsetY) / this.tileSize;
    // Apply zoom
    const oldZoom = this.zoomLevel;
    this.zoomLevel *= event.deltaY < 0 ? 1.12 : 0.89;
    this.zoomLevel = clamp(this.zoomLevel, 0.3, 4.0);
    // Recompute tileSize
    this.tileSize = Math.max(4, Math.round(this.baseTileSize * this.zoomLevel));
    // Adjust pan so cursor stays on same world tile
    const width = this.state?.world?.width || 60;
    const height = this.state?.world?.height || 60;
    const vw = this.root.clientWidth || 300;
    const vh = this.root.clientHeight || 300;
    const wpx = width * this.tileSize;
    const hpx = height * this.tileSize;
    const centeredOffX = Math.floor((vw - wpx) / 2);
    const centeredOffY = Math.floor((vh - hpx) / 2);
    this.panX = Math.round(mx - centeredOffX - wxBefore * this.tileSize);
    this.panY = Math.round(my - centeredOffY - wyBefore * this.tileSize);
    this.handleResize();
    this.render(performance.now());
  }

  private handlePanMove(event: MouseEvent): void {
    // Track mouse for hover effects (always, not just during pan)
    const rect = this.canvas.getBoundingClientRect();
    this.lastMouseX = event.clientX - rect.left;
    this.lastMouseY = event.clientY - rect.top;

    if (!this.isPanning) return;
    this.panX = this.panStartPanX + (event.clientX - this.panStartX);
    this.panY = this.panStartPanY + (event.clientY - this.panStartY);
    this.handleResize();
    this.render(performance.now());
  }

  private handlePanEnd(event: MouseEvent): void {
    if (!this.isPanning) return;
    this.isPanning = false;
    this.canvas.style.cursor = this.editor ? 'crosshair' : 'pointer';
    // If mouse barely moved, treat as click for avatar selection
    const dx = Math.abs(event.clientX - this.lastClickX);
    const dy = Math.abs(event.clientY - this.lastClickY);
    if (dx < 5 && dy < 5) {
      this.handleClick(event);
    }
  }

  // ─── Editor Methods ───

  setEditorMode(on: boolean, editor?: EditorLike): void {
    this.editor = on && editor ? editor : null;
    if (!on) this.editorState = null;
    this.canvas.style.cursor = on ? 'crosshair' : 'pointer';
    this._refreshSceneLayout();
    this.render(performance.now());
  }

  setEditorState(state: EditorState | null): void {
    this.editorState = state || null;
    this._refreshSceneLayout();
    this.render(performance.now());
  }

  private _refreshSceneLayout(): void {
    if (!this.state) { this.sceneLayout = null; return; }
    const effective = this.editorState && this.editorState.layout
      ? this._patchStateWithEditorLayout(this.state, this.editorState.layout)
      : this.state;
    this.sceneLayout = buildSceneLayout(effective);
  }

  private _patchStateWithEditorLayout(state: WorldState, layout: EditorLayout): WorldState {
    const patched = { ...state, world: { ...state.world } } as WorldState;
    (patched.world as any).trees = layout.trees.slice();
    (patched.world as any).outdoorStations = layout.outdoorStations.slice();
    // Group indoor stations back into per-location lists.
    const byLoc: Record<string, any[]> = {};
    for (const s of layout.indoorStations) {
      if (!byLoc[s.locationId]) byLoc[s.locationId] = [];
      byLoc[s.locationId].push({
        id: s.id, kind: s.kind, type: s.type,
        dx: s.dx, dy: s.dy, label: s.label,
        flipX: s.flipX, flipY: s.flipY,
      });
    }
    if (Array.isArray(layout.buildings)) {
      const origById: Record<string, any> = {};
      for (const l of ((patched.world as any).locations || [])) origById[l.id] = l;
      (patched.world as any).locations = layout.buildings.map(b => {
        const orig = origById[b.id] || {};
        return {
          ...orig,
          id: b.id, name: b.name, type: b.type,
          x: b.x, y: b.y, w: b.w, h: b.h,
          flipX: b.flipX, flipY: b.flipY,
          stations: byLoc[b.id] || [],
        };
      });
    } else if (Array.isArray((patched.world as any).locations)) {
      (patched.world as any).locations = ((patched.world as any).locations as any[]).map((loc: any) => ({
        ...loc, stations: byLoc[loc.id] || [],
      }));
    }
    return patched;
  }

  // ─── Sky Overlay ───

  setSkyMode(mode: SkyMode): void {
    if (mode !== 'day' && mode !== 'night' && mode !== 'clock') return;
    this.skyMode = mode;
    try { localStorage.setItem('playground2d-sky-mode', mode); } catch (_) { /* noop */ }
    this.render(performance.now());
  }

  // ─── Sync & Update ───

  private syncRuntime(): void {
    const avatars = normalizeAvatars(this.state);
    syncAvatarRuntimeEntries(this.avatarRuntime, avatars, performance.now());
  }

  private update(timestamp: number): void {
    if (!this.state) return;
    const blocked = this.sceneLayout?.blockedTiles || null;
    const locations = this.state.world?.locations || null;
    const stations = this.sceneLayout?.stations || null;
    advanceAvatarRuntimeEntries(
      this.avatarRuntime, worldDimensions(this.state),
      timestamp, Math.random, blocked, locations, stations
    );
  }

  // ─── Drawing Helpers ───

  private drawSprite(
    key: string, dx: number, dy: number, dw: number, dh: number,
    options?: { flipX?: boolean; flipY?: boolean } | null
  ): boolean {
    const sprite = this.spriteStore.getSprite(key);
    if (!sprite) return false;
    this.ctx.imageSmoothingEnabled = false;
    if (options?.flipX || options?.flipY) {
      const cx = dx + dw / 2;
      const cy = dy + dh / 2;
      this.ctx.save();
      this.ctx.translate(cx, cy);
      this.ctx.scale(options.flipX ? -1 : 1, options.flipY ? -1 : 1);
      this.ctx.translate(-cx, -cy);
      this.ctx.drawImage(sprite.image, sprite.sx, sprite.sy, sprite.sw, sprite.sh, Math.floor(dx), Math.floor(dy), Math.ceil(dw), Math.ceil(dh));
      this.ctx.restore();
    } else {
      this.ctx.drawImage(sprite.image, sprite.sx, sprite.sy, sprite.sw, sprite.sh, Math.floor(dx), Math.floor(dy), Math.ceil(dw), Math.ceil(dh));
    }
    return true;
  }

  private drawTerrainTile(tileType: string, x: number, y: number, timestamp: number): void {
    const key = chooseTerrainSpriteKey(tileType, x, y);
    const px = this.offsetX + x * this.tileSize;
    const py = this.offsetY + y * this.tileSize;
    if (this.drawSprite(key, px, py, this.tileSize, this.tileSize)) return;
    if (tileType === 'water') {
      this.drawWaterTile(px, py, x, y, timestamp);
      return;
    }
    const colors: Record<string, string> = { dirt: COLORS.dirt, path: COLORS.path, sand: COLORS.sand, stone: '#8d97a0' };
    this.ctx.fillStyle = colors[tileType] || ((x + y) % 2 === 0 ? COLORS.grassA : COLORS.grassB);
    this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
  }

  private drawWaterTile(px: number, py: number, tileX: number, tileY: number, timestamp: number): void {
    const t = this.tileSize;
    const phase = (timestamp / 1200) + tileX * 0.7 + tileY * 0.5;
    const brightness = Math.sin(phase) * 8;
    this.ctx.fillStyle = `rgb(${Math.round(70 + brightness)},${Math.round(148 + brightness * 1.5)},${Math.round(196 + brightness)})`;
    this.ctx.fillRect(px, py, t, t);
    // Ripples
    this.ctx.strokeStyle = 'rgba(180, 220, 255, 0.35)';
    this.ctx.lineWidth = 1;
    const ro = Math.sin(phase * 1.3) * t * 0.15;
    this.ctx.beginPath();
    this.ctx.moveTo(px + t * 0.15, py + t * 0.35 + ro);
    this.ctx.quadraticCurveTo(px + t * 0.5, py + t * 0.25 + ro, px + t * 0.85, py + t * 0.35 + ro);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(px + t * 0.1, py + t * 0.65 - ro * 0.7);
    this.ctx.quadraticCurveTo(px + t * 0.5, py + t * 0.75 - ro * 0.7, px + t * 0.9, py + t * 0.65 - ro * 0.7);
    this.ctx.stroke();

    // Sparkle particles
    for (let si = 0; si < 3; si++) {
      const sparklePhase = phase * 2.1 + si * 2.1;
      const sparkleAlpha = Math.max(0, Math.sin(sparklePhase)) * 0.7;
      if (sparkleAlpha > 0.05) {
        const sh = hashCoord(tileX * 31 + si, tileX, tileY);
        const spx = px + t * (0.15 + ((sh & 0xff) / 255) * 0.7);
        const spy = py + t * (0.15 + (((sh >>> 8) & 0xff) / 255) * 0.7);
        const sr = 0.5 + ((sh >>> 16) & 1);
        this.ctx.fillStyle = `rgba(255, 255, 255, ${sparkleAlpha.toFixed(2)})`;
        this.ctx.beginPath();
        this.ctx.arc(spx, spy, sr, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  private drawProp(prop: SceneProp): void {
    const px = this.offsetX + prop.x * this.tileSize;
    const py = this.offsetY + prop.y * this.tileSize;
    const isTree = prop.spriteKey.startsWith('prop.tree');
    const isBigTree = prop.spriteKey === 'prop.tree.big' || prop.spriteKey === 'prop.tree.big.alt';

    // Shadow
    this.ctx.fillStyle = COLORS.propShadow;
    this.ctx.beginPath();
    this.ctx.ellipse(px + this.tileSize * 0.5, py + this.tileSize * 0.86,
      this.tileSize * (isBigTree ? 0.42 : isTree ? 0.28 : 0.3),
      this.tileSize * (isBigTree ? 0.16 : isTree ? 0.12 : 0.12), 0, 0, Math.PI * 2);
    this.ctx.fill();

    const flipOpt = (prop.flipX || prop.flipY) ? { flipX: !!prop.flipX, flipY: !!prop.flipY } : null;
    if (isTree) {
      const th = this.tileSize * 1.6;
      const tw = isBigTree ? this.tileSize * 1.6 : this.tileSize * 0.9;
      if (this.drawSprite(prop.spriteKey, px + this.tileSize * 0.5 - tw / 2, py - th + this.tileSize * 0.9, tw, th, flipOpt)) return;
    } else if (this.drawSprite(prop.spriteKey, px, py - this.tileSize * 0.2, this.tileSize, this.tileSize * 1.2, flipOpt)) {
      return;
    }

    // Rock fallback
    if (prop.spriteKey === 'prop.rock' || prop.spriteKey === 'prop.rock.small') {
      const small = prop.spriteKey === 'prop.rock.small';
      const r = this.tileSize * (small ? 0.16 : 0.24);
      const cx = px + this.tileSize * 0.5;
      const cy = py + this.tileSize * 0.62;
      // Outline stroke (slightly larger, darker)
      this.ctx.strokeStyle = '#6b7280';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, Math.PI * 2);
      this.ctx.stroke();
      // Main body
      this.ctx.fillStyle = '#9a9fa5';
      this.ctx.beginPath();
      this.ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, Math.PI * 2);
      this.ctx.fill();
      // Highlight (smaller, lighter, offset up-left)
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      this.ctx.beginPath();
      this.ctx.ellipse(cx - r * 0.2, cy - r * 0.2, r * 0.5, r * 0.35, -0.3, 0, Math.PI * 2);
      this.ctx.fill();
      return;
    }

    // Tree fallback
    this.ctx.fillStyle = '#2a6b2f';
    this.ctx.beginPath();
    this.ctx.arc(px + this.tileSize * 0.5, py + this.tileSize * 0.4, this.tileSize * 0.3, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#7c4a20';
    this.ctx.fillRect(px + this.tileSize * 0.44, py + this.tileSize * 0.5, this.tileSize * 0.12, this.tileSize * 0.4);
  }

  private drawBuildingInterior(building: SceneBuilding): void {
    const w = building.widthTiles;
    const h = building.heightTiles;
    const px = this.offsetX + building.x * this.tileSize;
    const py = this.offsetY + building.y * this.tileSize;
    const dw = this.tileSize * w;
    const dh = this.tileSize * h;
    const ts = this.tileSize;

    // Apply building flip transform for entire interior
    const needsFlip = building.flipX || building.flipY;
    if (needsFlip) {
      this.ctx.save();
      const cx = px + dw / 2;
      const cy = py + dh / 2;
      this.ctx.translate(cx, cy);
      this.ctx.scale(building.flipX ? -1 : 1, building.flipY ? -1 : 1);
      this.ctx.translate(-cx, -cy);
    }

    // Default floor
    this.ctx.fillStyle = '#d4b88c';
    this.ctx.fillRect(px + 2, py + 2, dw - 4, dh - 4);

    // Zones
    for (const z of building.zones || []) {
      this.ctx.fillStyle = z.floor || '#d4b88c';
      this.ctx.fillRect(px + z.x1 * ts, py + z.y1 * ts, (z.x2 - z.x1) * ts, (z.y2 - z.y1) * ts);
    }

    // Plank texture
    this.ctx.strokeStyle = 'rgba(92, 74, 50, 0.18)';
    this.ctx.lineWidth = 1;
    const plankH = ts * 0.5;
    for (let ly = py + plankH; ly < py + dh - 2; ly += plankH) {
      this.ctx.beginPath();
      this.ctx.moveTo(px + 3, ly);
      this.ctx.lineTo(px + dw - 3, ly);
      this.ctx.stroke();
    }

    // Wall border
    this.ctx.strokeStyle = '#5c4a32';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(px + 1, py + 1, dw - 2, dh - 2);

    // Interior walls
    for (const wall of building.interiorWalls || []) {
      this.ctx.strokeStyle = '#7a6040';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(px + wall.x1 * ts, py + wall.y1 * ts);
      this.ctx.lineTo(px + wall.x2 * ts, py + wall.y2 * ts);
      this.ctx.stroke();
    }

    // Door
    const doorDx = Math.floor(w / 2);
    const doorX = px + doorDx * ts;
    const doorY = py + dh - 4;
    this.ctx.fillStyle = '#d4b88c';
    this.ctx.fillRect(doorX + 3, doorY, ts - 6, 6);
    this.ctx.fillStyle = '#8c6a42';
    this.ctx.fillRect(doorX + 4, py + dh - 2, ts - 8, 3);
    this.ctx.fillStyle = '#4a3a22';
    this.ctx.fillRect(doorX + 2, doorY - 2, 2, 6);
    this.ctx.fillRect(doorX + ts - 4, doorY - 2, 2, 6);

    // Furniture
    const inset = 2;
    for (const st of building.stations || []) {
      const key = resolveFurnitureKey(st.type);
      const resolvedType = resolveFurnitureType(st.type);
      const size = FURNITURE_RENDER_SIZE[resolvedType] || { w: 1, h: 1 };
      const fw = ts * size.w - inset * 2;
      const fh = ts * size.h - inset * 2;
      const fx = px + st.dx * ts + inset;
      const fy = py + st.dy * ts + inset;
      const flipOpt = (st.flipX || st.flipY) ? { flipX: !!st.flipX, flipY: !!st.flipY } : null;
      this.drawSprite(key, fx, fy, fw, fh, flipOpt);
    }

    if (needsFlip) {
      this.ctx.restore();
    }
  }

  private drawBuilding(building: SceneBuilding, transparent: boolean): void {
    const w = building.widthTiles;
    const h = building.heightTiles;
    const px = this.offsetX + building.x * this.tileSize;
    const py = this.offsetY + building.y * this.tileSize;
    const dw = this.tileSize * w;
    const dh = this.tileSize * h;

    const prevAlpha = this.ctx.globalAlpha;
    if (transparent) this.ctx.globalAlpha = 0.3;

    const spriteH = dh * 1.4;
    const roofOverhang = spriteH - dh;
    const flipOpt = (building.flipX || building.flipY) ? { flipX: !!building.flipX, flipY: !!building.flipY } : null;
    if (this.drawSprite(building.spriteKey, px, py - roofOverhang, dw, spriteH, flipOpt)) {
      this.ctx.globalAlpha = prevAlpha;
      return;
    }

    // Fallback with per-type roof colors
    const ROOF_COLORS: Record<string, string> = {
      'building.house': '#c44', 'building.house2': '#48a',
      'building.house.green': '#4a4', 'building.house.green2': '#3a7',
      'building.house.gray': '#888', 'building.tower': '#66a',
      'building.shop': '#a84', 'building.large': '#864',
    };
    const roofColor = ROOF_COLORS[building.spriteKey] || '#c46030';
    this.ctx.fillStyle = '#c5a67a';
    this.ctx.fillRect(px, py + dh * 0.3, dw, dh * 0.7);
    this.ctx.fillStyle = roofColor;
    this.ctx.fillRect(px - dw * 0.05, py, dw * 1.1, dh * 0.4);
    this.ctx.fillStyle = '#2f2a26';
    this.ctx.fillRect(px + dw * 0.4, py + dh * 0.55, dw * 0.2, dh * 0.45);
    this.ctx.globalAlpha = prevAlpha;
  }

  private drawCharacterVariant(avatar: AvatarRuntime, timestamp: number): boolean {
    const sheets = this.spriteStore.characterSheetImages;
    if (!sheets || sheets.length === 0) return false;

    const totalVariants = sheets.length * CHARACTERS_PER_SHEET;
    const customVariant = this.getCustomAvatarVariant?.(avatar.agentId || avatar.id);
    const variantIndex = (customVariant != null && customVariant >= 0 && customVariant < totalVariants)
      ? customVariant
      : hashString(avatar.id || '') % totalVariants;
    const sheetIndex = Math.floor(variantIndex / CHARACTERS_PER_SHEET);
    const charInSheet = variantIndex % CHARACTERS_PER_SHEET;
    const sheet = sheets[sheetIndex];
    if (!sheet) return false;

    const direction = avatar.direction || 'down';
    const isStill = avatar.seated || avatar.talking || !avatar.moving;
    const walkPhase = isStill ? null : Math.floor(timestamp / WALK_FRAME_INTERVAL_MS) % 2;
    const dirRow: Record<string, number> = { down: 0, left: 1, right: 2, up: 3 };
    const row = dirRow[direction] || 0;
    const frameCol = isStill ? 1 : (walkPhase === 0 ? 0 : 2);

    const baseCol = (charInSheet % 4) * 3;
    const baseRow = Math.floor(charInSheet / 4) * 4;
    const cellW = Math.floor(sheet.width / 12);
    const cellH = Math.floor(sheet.height / 8);
    const sx = (baseCol + frameCol) * cellW;
    const sy = (baseRow + row) * cellH;

    const cx = this.offsetX + avatar.x * this.tileSize + this.tileSize / 2;
    const cy = this.offsetY + avatar.y * this.tileSize + this.tileSize / 2;

    const seatScale = avatar.seated ? 0.88 : 1;
    const baseSeatShift = avatar.seated ? this.tileSize * 0.18 : 0;
    let breathShift = 0;
    if (avatar.seated) {
      const phase = (hashString(avatar.id || '') & 0xffff) / 0xffff * Math.PI * 2;
      breathShift = Math.sin(timestamp / 1100 + phase) * 1.1;
    }
    let talkShift = 0;
    if (avatar.talking && !avatar.seated) {
      const phase = (hashString((avatar.id || '') + 't') & 0xffff) / 0xffff * Math.PI * 2;
      talkShift = Math.sin(timestamp / 600 + phase) * 0.6;
    }
    const shiftY = baseSeatShift + breathShift + talkShift;

    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(sheet, sx, sy, cellW, cellH,
      Math.floor(cx - this.tileSize * 0.48 * seatScale),
      Math.floor(cy - this.tileSize * 0.62 * seatScale + shiftY),
      Math.ceil(this.tileSize * 0.96 * seatScale),
      Math.ceil(this.tileSize * 1.24 * seatScale));
    return true;
  }

  private drawAvatar(avatar: AvatarRuntime, timestamp: number): void {
    const cx = this.offsetX + avatar.x * this.tileSize + this.tileSize / 2;
    const cy = this.offsetY + avatar.y * this.tileSize + this.tileSize / 2;

    // Shadow
    const prevAlpha = this.ctx.globalAlpha;
    this.ctx.globalAlpha = 0.25;
    this.ctx.fillStyle = '#000';
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy + this.tileSize * 0.52, this.tileSize * 0.3, this.tileSize * 0.1, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.globalAlpha = prevAlpha;

    // Character sprite
    if (!this.drawCharacterVariant(avatar, timestamp)) {
      this.drawFallbackAvatar(avatar, cx, cy, timestamp, this.tileSize);
    }

    // Speech bubbles
    const rawBubble = (avatar.bubbleText || '').trim();
    const chatText = avatar.chat && avatar.chat.expiresAt > timestamp ? avatar.chat.text : '';
    const activityText = rawBubble || (avatar.state === 'working' ? 'working...' : '');
    const chatBubbleY = cy - this.tileSize * 0.7 - 6;

    if (activityText) {
      if (chatText) {
        const chatHeight = Math.max(9, Math.floor(this.tileSize * 0.34)) + 14;
        this.drawActivityLabel(cx, chatBubbleY - chatHeight - 6, activityText, avatar.state === 'working', true);
      } else {
        this.drawActivityLabel(cx, chatBubbleY, activityText, avatar.state === 'working', false);
      }
    }
    if (chatText) {
      this.drawChatLabel(cx, chatBubbleY, chatText);
    }

    // Name label
    const nameFontSize = Math.max(9, Math.floor(this.tileSize * 0.36));
    const isWorking = avatar.state === 'working';
    this.ctx.font = `600 ${nameFontSize}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'alphabetic';
    const nameY = cy + this.tileSize * 0.62 + 12;
    this.ctx.strokeStyle = COLORS.nameOutline;
    this.ctx.lineWidth = 3;
    this.ctx.lineJoin = 'round';
    this.ctx.strokeText(avatar.displayName, cx, nameY);
    this.ctx.fillStyle = isWorking ? COLORS.nameTextWorking : COLORS.nameText;
    this.ctx.fillText(avatar.displayName, cx, nameY);
  }

  private drawFallbackAvatar(avatar: AvatarRuntime, centerX: number, centerY: number, timestamp: number, ts: number): void {
    const r = Math.max(4, Math.floor(ts * 0.3));
    const isWorking = avatar.state === 'working';

    // Body circle
    this.ctx.beginPath();
    this.ctx.fillStyle = isWorking ? COLORS.workingAvatar : COLORS.idleAvatar;
    this.ctx.strokeStyle = COLORS.avatarOutline;
    this.ctx.lineWidth = 2;
    this.ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // Walking legs
    if (avatar.moving) {
      const walkPhase = Math.floor(timestamp / WALK_FRAME_INTERVAL_MS) % 2;
      const stride = walkPhase === 0 ? -1 : 1;
      this.ctx.strokeStyle = COLORS.avatarOutline;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(centerX - 4, centerY + r - 1);
      this.ctx.lineTo(centerX - 4 + stride, centerY + r + 4);
      this.ctx.moveTo(centerX + 4, centerY + r - 1);
      this.ctx.lineTo(centerX + 4 - stride, centerY + r + 4);
      this.ctx.stroke();
    }
  }

  private drawActivityLabel(centerX: number, bottomY: number, text: string, isWorking: boolean, muted: boolean): void {
    const safeText = text.trim();
    if (!safeText) return;
    const fontSize = Math.max(9, Math.floor(this.tileSize * 0.34));
    this.ctx.font = `${isWorking ? '600 ' : ''}${fontSize}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'alphabetic';

    const displayText = safeText.length > 32 ? safeText.slice(0, 30) + '…' : safeText;
    const tw = this.ctx.measureText(displayText).width;
    const padX = 8, padY = 5;
    const bw = tw + padX * 2, bh = fontSize + padY * 2;
    const tailH = 4;
    const top = bottomY - bh - tailH;
    const left = centerX - bw / 2;
    const radius = Math.min(6, bh / 2);
    const bodyFill = isWorking ? COLORS.bubbleBgWorking : COLORS.bubbleBg;

    if (muted) this.ctx.globalAlpha = 0.55;

    // Shadow
    this.ctx.fillStyle = COLORS.bubbleShadow;
    this.ctx.beginPath();
    drawRoundedRect(this.ctx, left + 1, top + 2, bw, bh, radius);
    this.ctx.fill();

    // Tail
    this.ctx.fillStyle = bodyFill;
    this.ctx.beginPath();
    this.ctx.arc(centerX - 1, top + bh + 1, tailH - 0.5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = COLORS.bubbleBorder;
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // Body
    this.ctx.fillStyle = bodyFill;
    this.ctx.beginPath();
    drawRoundedRect(this.ctx, left, top, bw, bh, radius);
    this.ctx.fill();
    this.ctx.strokeStyle = COLORS.bubbleBorder;
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    this.ctx.fillStyle = bodyFill;
    this.ctx.fillRect(centerX - tailH, top + bh - 0.5, tailH * 2, 2);

    this.ctx.fillStyle = COLORS.bubbleText;
    this.ctx.fillText(displayText, centerX, top + bh - padY - 1);

    if (muted) this.ctx.globalAlpha = 1;
  }

  private drawChatLabel(centerX: number, bottomY: number, text: string): void {
    const safeText = text.trim();
    if (!safeText) return;
    const fontSize = Math.max(10, Math.floor(this.tileSize * 0.38));
    this.ctx.font = `600 ${fontSize}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'alphabetic';

    const displayText = safeText.length > 32 ? safeText.slice(0, 30) + '…' : safeText;
    const tw = this.ctx.measureText(displayText).width;
    const padX = 10, padY = 6;
    const bw = tw + padX * 2, bh = fontSize + padY * 2;
    const tailH = 6;
    const top = bottomY - bh - tailH;
    const left = centerX - bw / 2;
    const radius = Math.min(9, bh / 2);

    // Shadow
    this.ctx.fillStyle = 'rgba(20, 25, 40, 0.32)';
    this.ctx.beginPath();
    drawRoundedRect(this.ctx, left + 2, top + 3, bw, bh, radius);
    this.ctx.fill();

    // Tail
    this.ctx.fillStyle = '#fafdff';
    this.ctx.beginPath();
    this.ctx.moveTo(centerX - 6, top + bh - 1);
    this.ctx.lineTo(centerX - 1, top + bh + tailH);
    this.ctx.lineTo(centerX + 6, top + bh - 1);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.strokeStyle = '#1e40af';
    this.ctx.lineWidth = 1.8;
    this.ctx.stroke();

    // Body
    this.ctx.fillStyle = '#fafdff';
    this.ctx.beginPath();
    drawRoundedRect(this.ctx, left, top, bw, bh, radius);
    this.ctx.fill();
    this.ctx.strokeStyle = '#1e40af';
    this.ctx.lineWidth = 1.8;
    this.ctx.stroke();

    this.ctx.fillStyle = '#fafdff';
    this.ctx.fillRect(centerX - 5, top + bh - 1.5, 11, 2);

    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillText(displayText, centerX, top + bh - padY - 1);
  }

  private drawLocationSigns(layout: SceneLayout): void {
    if (!layout.locations || layout.locations.length === 0) return;
    for (const loc of layout.locations) {
      const bw = loc.w || 5;
      const px = this.offsetX + (loc.x + bw / 2) * this.tileSize;
      const py = this.offsetY + (loc.y - 0.6) * this.tileSize;

      const fontSize = Math.max(9, Math.floor(this.tileSize * 0.36));
      this.ctx.font = `700 ${fontSize}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'alphabetic';

      const nw = this.ctx.measureText(loc.name).width;
      const padX = 9, padY = 5;
      const signW = nw + padX * 2, signH = fontSize + padY * 2;
      const signX = px - signW / 2, signY = py - signH / 2;
      const r = 3;

      // Shadow
      this.ctx.fillStyle = 'rgba(20, 10, 5, 0.35)';
      this.ctx.beginPath();
      drawRoundedRect(this.ctx, signX + 1, signY + 2, signW, signH, r);
      this.ctx.fill();

      // Plank
      this.ctx.fillStyle = COLORS.signPlank;
      this.ctx.beginPath();
      drawRoundedRect(this.ctx, signX, signY, signW, signH, r);
      this.ctx.fill();

      this.ctx.fillStyle = COLORS.signPlankDark;
      this.ctx.fillRect(signX + 2, signY + signH - 3, signW - 4, 2);

      this.ctx.strokeStyle = COLORS.signPlankBorder;
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      drawRoundedRect(this.ctx, signX, signY, signW, signH, r);
      this.ctx.stroke();

      // Rivets
      this.ctx.fillStyle = COLORS.signRivet;
      this.ctx.beginPath();
      this.ctx.arc(signX + 4, signY + 4, 1.4, 0, Math.PI * 2);
      this.ctx.arc(signX + signW - 4, signY + 4, 1.4, 0, Math.PI * 2);
      this.ctx.fill();

      // Text
      const textY = py + fontSize * 0.34;
      this.ctx.fillStyle = COLORS.signTextShadow;
      this.ctx.fillText(loc.name, px + 1, textY + 1);
      this.ctx.fillStyle = COLORS.signText;
      this.ctx.fillText(loc.name, px, textY);
    }
  }

  private drawTimeDisplay(): void {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    const timeStr = `${displayHour}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${ampm}`;

    this.ctx.font = 'bold 13px Menlo, monospace';
    this.ctx.textAlign = 'left';
    const tw = this.ctx.measureText(timeStr).width;
    const bw = tw + 20, bh = 24;

    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    this.ctx.beginPath();
    drawRoundedRect(this.ctx, 12, 12, bw, bh, 6);
    this.ctx.fill();

    this.ctx.fillStyle = '#fef3c7';
    this.ctx.fillText(timeStr, 22, 30);
  }

  private drawAgentRoster(): void {
    const agents = Array.from(this.avatarRuntime.values())
      .sort((a, b) => {
        // Working agents first, then idle. Within same state, sort by name.
        if (a.state !== b.state) return a.state === 'working' ? -1 : 1;
        return (a.displayName || '').localeCompare(b.displayName || '');
      });
    this.rosterHitRegions = [];
    if (agents.length === 0) return;

    const canvasW = parseInt(this.canvas.style.width || '0', 10) || 0;
    const panelW = Math.min(240, canvasW * 0.28);
    const lineH = 28;
    const headerH = 30;
    const panelH = headerH + agents.length * lineH + 8;
    const panelX = canvasW - panelW - 8;
    const panelY = 44;

    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    this.ctx.beginPath();
    drawRoundedRect(this.ctx, panelX, panelY, panelW, panelH, 6);
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    this.ctx.fillStyle = '#7dd3fc';
    this.ctx.font = 'bold 12px Menlo, monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Agents (${agents.length})`, panelX + 10, panelY + 20);

    this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    this.ctx.beginPath();
    this.ctx.moveTo(panelX + 8, panelY + headerH);
    this.ctx.lineTo(panelX + panelW - 8, panelY + headerH);
    this.ctx.stroke();

    agents.forEach((agent, i) => {
      const y = panelY + headerH + 4 + i * lineH;
      const isSelected = this.selectedAgent?.id === agent.id;
      const isHovered = !isSelected &&
        this.lastMouseX >= panelX && this.lastMouseX <= panelX + panelW &&
        this.lastMouseY >= y - 2 && this.lastMouseY <= y - 2 + lineH;

      // Hover/selected highlight
      if (isSelected) {
        this.ctx.fillStyle = 'rgba(125, 211, 252, 0.15)';
        this.ctx.fillRect(panelX + 2, y - 2, panelW - 4, lineH);
      } else if (isHovered) {
        this.ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
        this.ctx.fillRect(panelX + 2, y - 2, panelW - 4, lineH);
      }

      const dotColor = agent.state === 'working' ? '#fbbf24' : '#34d399';
      this.ctx.fillStyle = dotColor;
      this.ctx.beginPath();
      this.ctx.arc(panelX + 14, y + 9, 4, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.font = 'bold 10px Menlo, monospace';
      this.ctx.fillStyle = isSelected ? '#7dd3fc' : '#e2e8f0';
      this.ctx.fillText((agent.displayName || agent.id || '').slice(0, 16), panelX + 24, y + 12);

      this.ctx.font = '9px Menlo, monospace';
      const activity = (agent.bubbleText || (agent.state === 'working' ? 'working...' : '')).slice(0, 24);
      if (activity) {
        this.ctx.fillStyle = agent.state === 'working' ? 'rgba(251, 191, 36, 0.8)' : 'rgba(148, 163, 184, 0.7)';
        this.ctx.fillText(activity, panelX + 24, y + 24);
      }

      // Record hit region for click detection
      this.rosterHitRegions.push({
        x: panelX, y: y - 2, w: panelW, h: lineH,
        agentId: agent.agentId || agent.id,
      });
    });
  }

  // ─── Sky Overlay ───

  private drawSkyOverlay(now: Date = new Date()): void {
    if (this.skyMode === 'day') return;
    const h = this.skyMode === 'night'
      ? 0  // pin to the midnight keyframe
      : now.getHours() + now.getMinutes() / 60;
    // RGBA keyframes at specific hours. Alpha=0 means "no tint".
    const KEYFRAMES: [number, [number, number, number, number]][] = [
      [0,  [10, 15, 50, 0.45]],
      [5,  [40, 25, 70, 0.38]],
      [6,  [255, 140, 80, 0.22]],
      [7,  [255, 200, 150, 0.08]],
      [9,  [0, 0, 0, 0]],
      [16, [0, 0, 0, 0]],
      [17, [255, 180, 100, 0.10]],
      [18, [255, 100, 50, 0.22]],
      [19, [150, 40, 90, 0.34]],
      [20, [40, 25, 80, 0.40]],
      [22, [10, 15, 55, 0.45]],
      [24, [10, 15, 50, 0.45]],
    ];
    // Find the segment containing the current hour
    let prev = KEYFRAMES[0], next = KEYFRAMES[KEYFRAMES.length - 1];
    for (let i = 0; i < KEYFRAMES.length - 1; i++) {
      if (h >= KEYFRAMES[i][0] && h <= KEYFRAMES[i + 1][0]) {
        prev = KEYFRAMES[i];
        next = KEYFRAMES[i + 1];
        break;
      }
    }
    const span = next[0] - prev[0] || 1;
    const t = (h - prev[0]) / span;
    const lerp = (a: number, b: number) => a + (b - a) * t;
    const [r, g, b, a] = prev[1].map((v, i) => lerp(v, next[1][i]));
    if (a <= 0.002) return; // daytime — skip

    const canvasWidth = parseInt(this.canvas.style.width || '0', 10) || 0;
    const canvasHeight = parseInt(this.canvas.style.height || '0', 10) || 0;
    this.ctx.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a})`;
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Scatter a few stars at deep-night tints.
    if (a > 0.33 && r < 60) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      // Deterministic "star field" based on minute so it doesn't
      // jitter every frame.
      const seed = now.getHours() * 60 + now.getMinutes();
      for (let i = 0; i < 40; i++) {
        const hash = ((seed + i * 2654435761) >>> 0);
        const sx = (hash % 1000) / 1000 * canvasWidth;
        const sy = ((hash >>> 10) % 1000) / 1000 * (canvasHeight * 0.5);
        const size = ((hash >>> 20) % 3) + 1;
        this.ctx.fillRect(sx, sy, size, size);
      }
    }
  }

  // ─── Agent Profile Panel ───

  private wrapText(text: string, maxWidth: number, ctx: CanvasRenderingContext2D): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.slice(0, 3); // max 3 lines
  }

  private drawAgentProfile(agent: AvatarRuntime, _timestamp: number): void {
    const canvasWidth = parseInt(this.canvas.style.width || '0', 10) || 0;
    const canvasHeight = parseInt(this.canvas.style.height || '0', 10) || 0;

    // Look up the full server-side agent (tasks, tools, zone).
    const serverAgent = (this.state as any)?.agents?.[agent.id] || null;
    const recentTasks: any[] = serverAgent && Array.isArray(serverAgent.tasks)
      ? [...serverAgent.tasks].sort((a: any, b: any) =>
          String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).slice(0, 3)
      : [];

    const panelW = Math.min(300, canvasWidth * 0.38);
    const taskLinesCount = recentTasks.length;
    const hasSheets = this.spriteStore.characterSheetImages && this.spriteStore.characterSheetImages.length > 0;
    const pickerH = hasSheets ? 70 : 0;
    const panelH = 170 + (taskLinesCount > 0 ? 24 + taskLinesCount * 16 : 0) + pickerH;
    const panelX = 12;
    const panelY = canvasHeight - panelH - 12;

    // Panel background
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    this.ctx.beginPath();
    drawRoundedRect(this.ctx, panelX, panelY, panelW, panelH, 8);
    this.ctx.fill();

    // Border
    this.ctx.strokeStyle = '#475569';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // Close hint
    this.ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
    this.ctx.font = '9px Menlo, monospace';
    this.ctx.textAlign = 'right';
    this.ctx.fillText('click elsewhere to close', panelX + panelW - 10, panelY + 14);

    // Agent name
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#7dd3fc';
    this.ctx.font = 'bold 13px Menlo, monospace';
    const name = agent.displayName || agent.id || 'Unknown';
    this.ctx.fillText(name, panelX + 12, panelY + 32);

    // Status indicator
    const statusColor = agent.state === 'working' ? '#fbbf24' : '#34d399';
    const statusText = agent.state === 'working' ? 'Working' : 'Idle';
    this.ctx.fillStyle = statusColor;
    this.ctx.beginPath();
    this.ctx.arc(panelX + 14, panelY + 50, 4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#e2e8f0';
    this.ctx.font = '11px Menlo, monospace';
    this.ctx.fillText(statusText, panelX + 24, panelY + 54);

    // Current activity
    this.ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
    this.ctx.font = '10px Menlo, monospace';
    this.ctx.fillText('Current Activity:', panelX + 12, panelY + 74);
    this.ctx.fillStyle = '#e2e8f0';
    const activity = agent.bubbleText || 'none';
    const activityLines = this.wrapText(activity, panelW - 24, this.ctx);
    activityLines.forEach((line, i) => {
      this.ctx.fillText(line, panelX + 12, panelY + 88 + i * 14);
    });

    // Tool + zone row
    let rowY = panelY + 88 + activityLines.length * 14 + 6;
    if (serverAgent) {
      this.ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
      this.ctx.font = '9px Menlo, monospace';
      const tool = serverAgent.lastTool || '\u2014';
      const zone = serverAgent.zone || 'idle';
      this.ctx.fillText(`Tool: ${tool}   Zone: ${zone}`, panelX + 12, rowY);
      rowY += 14;
    }

    // Recent tasks
    if (recentTasks.length > 0) {
      this.ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
      this.ctx.font = '10px Menlo, monospace';
      this.ctx.fillText('Recent tasks:', panelX + 12, rowY + 8);
      rowY += 20;
      for (const task of recentTasks) {
        const status = task.status || '';
        const color =
          status === 'completed' ? '#34d399' :
          status === 'in_progress' || status === 'assigned' ? '#fbbf24' :
          status === 'blocked' || status === 'paused' ? '#f87171' : '#94a3b8';
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(panelX + 16, rowY, 3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#e2e8f0';
        this.ctx.font = '10px Menlo, monospace';
        const label = (task.label || task.id || '').slice(0, 30);
        this.ctx.fillText(label, panelX + 24, rowY + 3);
        rowY += 16;
      }
    }

    // Position
    this.ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    this.ctx.font = '9px Menlo, monospace';
    this.ctx.fillText(`Position: (${agent.x}, ${agent.y})`, panelX + 12, rowY + 8);
    rowY += 20;

    // ─── Character Picker ───
    this.avatarPickerHitRegions = [];
    this.avatarPickerArrows = { left: null, right: null };
    const sheets = this.spriteStore.characterSheetImages;
    if (sheets && sheets.length > 0) {
      const totalVariants = sheets.length * CHARACTERS_PER_SHEET;
      const thumbSize = 28;
      const thumbGap = 3;
      const pickerPadX = 12;
      const availW = panelW - pickerPadX * 2;
      const arrowW = 18;
      const thumbAreaW = availW - arrowW * 2 - 8;
      const thumbsPerRow = Math.max(1, Math.floor((thumbAreaW + thumbGap) / (thumbSize + thumbGap)));

      // Label
      this.ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
      this.ctx.font = '10px Menlo, monospace';
      this.ctx.fillText('Appearance:', panelX + pickerPadX, rowY + 4);
      rowY += 14;

      // Current variant indicator
      const currentVariant = this.getCustomAvatarVariant?.(agent.agentId || agent.id);
      const activeVariant = currentVariant != null ? currentVariant : hashString(agent.id || '') % totalVariants;
      const pageStart = this.avatarPickerScroll;

      // Left arrow
      const arrowY = rowY;
      if (pageStart > 0) {
        this.ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
        this.ctx.font = 'bold 16px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('◀', panelX + pickerPadX + arrowW / 2, arrowY + thumbSize / 2 + 5);
        this.avatarPickerArrows.left = { x: panelX + pickerPadX, y: arrowY, w: arrowW, h: thumbSize };
      }

      // Thumbnails
      const thumbStartX = panelX + pickerPadX + arrowW + 4;
      for (let i = 0; i < thumbsPerRow && pageStart + i < totalVariants; i++) {
        const vi = pageStart + i;
        const sheetIdx = Math.floor(vi / CHARACTERS_PER_SHEET);
        const charInSheet = vi % CHARACTERS_PER_SHEET;
        const sheet = sheets[sheetIdx];
        if (!sheet) continue;

        const tx = thumbStartX + i * (thumbSize + thumbGap);
        const ty = arrowY;

        // Extract the idle-down frame from the character sheet
        const baseCol = (charInSheet % 4) * 3;
        const baseRow = Math.floor(charInSheet / 4) * 4;
        const cellW = Math.floor(sheet.width / 12);
        const cellH = Math.floor(sheet.height / 8);
        const sx = (baseCol + 1) * cellW;  // idle frame (column 1)
        const sy = baseRow * cellH;        // down direction (row 0)

        // Background
        const isActive = vi === activeVariant;
        this.ctx.fillStyle = isActive ? 'rgba(125, 211, 252, 0.3)' : 'rgba(30, 41, 59, 0.8)';
        this.ctx.beginPath();
        drawRoundedRect(this.ctx, tx, ty, thumbSize, thumbSize, 4);
        this.ctx.fill();
        if (isActive) {
          this.ctx.strokeStyle = '#7dd3fc';
          this.ctx.lineWidth = 2;
          this.ctx.stroke();
        }

        // Draw character thumbnail
        this.ctx.drawImage(sheet, sx, sy, cellW, cellH, tx + 2, ty + 1, thumbSize - 4, thumbSize - 2);

        this.avatarPickerHitRegions.push({ x: tx, y: ty, w: thumbSize, h: thumbSize, variantIndex: vi });
      }

      // Right arrow
      if (pageStart + thumbsPerRow < totalVariants) {
        const rightX = thumbStartX + thumbsPerRow * (thumbSize + thumbGap) + 2;
        this.ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
        this.ctx.font = 'bold 16px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('▶', panelX + panelW - pickerPadX - arrowW / 2, arrowY + thumbSize / 2 + 5);
        this.avatarPickerArrows.right = { x: panelX + panelW - pickerPadX - arrowW, y: arrowY, w: arrowW, h: thumbSize };
      }

      this.ctx.textAlign = 'left';
      rowY += thumbSize + 6;

      // Page indicator
      const totalPages = Math.ceil(totalVariants / thumbsPerRow);
      const currentPage = Math.floor(pageStart / thumbsPerRow) + 1;
      this.ctx.fillStyle = 'rgba(100, 116, 139, 0.7)';
      this.ctx.font = '9px Menlo, monospace';
      this.ctx.fillText(`${currentPage}/${totalPages}  (${totalVariants} characters)`, panelX + pickerPadX, rowY);
    }

    // Highlight selected agent on map
    const ax = this.offsetX + agent.x * this.tileSize + this.tileSize / 2;
    const ay = this.offsetY + agent.y * this.tileSize + this.tileSize / 2;
    this.ctx.strokeStyle = '#7dd3fc';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 3]);
    this.ctx.beginPath();
    this.ctx.arc(ax, ay, this.tileSize * 0.6, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  // ─── Editor Overlay ───

  private drawEditorOverlay(): void {
    const state = this.editorState;
    if (!state || !state.layout) return;
    const ts = this.tileSize;
    const { layout, selection, pendingAdd } = state;
    // Use editor layout buildings for positions (not stale world state)
    const editorBuildings = Array.isArray(layout.buildings) ? layout.buildings : [];
    const locById: Record<string, any> = {};
    for (const b of editorBuildings) locById[b.id] = b;
    // Fallback to world state locations for any missing buildings
    const wsLocations = (this.state?.world as any)?.locations || [];
    for (const l of wsLocations) { if (!locById[l.id]) locById[l.id] = l; }

    // Build marker list with world coords
    const markers: { kind: string; id: string; x: number; y: number; color: string }[] = [];
    layout.trees.forEach((t, i) => markers.push({ kind: 'tree', id: `tree_${i}`, x: t.x, y: t.y, color: '#16a34a' }));
    layout.outdoorStations.forEach(s => markers.push({
      kind: 'outdoor', id: s.id, x: s.x, y: s.y,
      color: s.kind === 'work' ? '#f59e0b' : '#10b981',
    }));
    layout.indoorStations.forEach(s => {
      const loc = locById[s.locationId];
      if (!loc) return;
      markers.push({
        kind: 'indoor', id: s.id, x: loc.x + s.dx, y: loc.y + s.dy,
        color: s.kind === 'work' ? '#f59e0b' : '#10b981',
      });
    });

    for (const m of markers) {
      const isSel = selection && selection.kind === m.kind && selection.id === m.id;
      this.ctx.strokeStyle = m.color;
      this.ctx.lineWidth = 1.5;
      this.ctx.fillStyle = m.color + '33'; // 20% alpha
      this.ctx.beginPath();
      this.ctx.rect(this.offsetX + m.x * ts + 2, this.offsetY + m.y * ts + 2, ts - 4, ts - 4);
      this.ctx.fill();
      this.ctx.stroke();
      if (isSel) {
        this.ctx.strokeStyle = '#fbbf24';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(this.offsetX + m.x * ts - 1, this.offsetY + m.y * ts - 1, ts + 2, ts + 2);
      }
    }

    // Building outlines + selection ring (multi-tile rects).
    const buildings = Array.isArray(layout.buildings) ? layout.buildings : [];
    for (const b of buildings) {
      const isSel = selection && selection.kind === 'building' && selection.id === b.id;
      const x = this.offsetX + b.x * ts;
      const y = this.offsetY + b.y * ts;
      const w = b.w * ts;
      const hh = b.h * ts;
      this.ctx.strokeStyle = isSel ? '#fbbf24' : 'rgba(251,191,36,0.35)';
      this.ctx.lineWidth = isSel ? 3 : 1;
      this.ctx.setLineDash(isSel ? [] : [4, 3]);
      this.ctx.strokeRect(x, y, w, hh);
      this.ctx.setLineDash([]);
    }

    // Pending-add cursor hint
    if (pendingAdd) {
      this.ctx.fillStyle = 'rgba(15,23,42,0.85)';
      this.ctx.fillRect(this.offsetX, this.offsetY - 32, 280, 26);
      this.ctx.fillStyle = 'rgba(251,191,36,0.95)';
      this.ctx.font = '13px Menlo, monospace';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(`Placing: ${pendingAdd.type} \u2014 click to drop, Esc to cancel`, this.offsetX + 8, this.offsetY - 14);
    }
  }

  // ─── Main Render ───

  render(timestamp = performance.now()): void {
    const canvasW = parseInt(this.canvas.style.width || '0', 10) || 0;
    const canvasH = parseInt(this.canvas.style.height || '0', 10) || 0;
    this.ctx.clearRect(0, 0, canvasW, canvasH);
    this.ctx.fillStyle = COLORS.background;
    this.ctx.fillRect(0, 0, canvasW, canvasH);

    if (!this.state) {
      this.ctx.fillStyle = COLORS.label;
      this.ctx.font = '16px Menlo, monospace';
      this.ctx.fillText('Waiting for world state...', 20, 32);
      return;
    }

    const layout = this.sceneLayout || buildSceneLayout(this.state);
    const { width, height } = layout;

    // World border
    this.ctx.fillStyle = COLORS.border;
    this.ctx.fillRect(this.offsetX - 2, this.offsetY - 2, width * this.tileSize + 4, height * this.tileSize + 4);

    // Layer 0: Terrain
    const ts = this.tileSize;
    for (let ty = 0; ty < height; ty++) {
      const row = layout.tiles[ty] || [];
      for (let tx = 0; tx < width; tx++) {
        const px = this.offsetX + tx * ts;
        const py = this.offsetY + ty * ts;
        if (px + ts < 0 || px > canvasW || py + ts < 0 || py > canvasH) continue;
        this.drawTerrainTile(row[tx] || 'grass', tx, ty, timestamp);
      }
    }

    // Layer 1: Decorations
    layout.decorations.forEach(deco => {
      const px = this.offsetX + deco.x * this.tileSize;
      const py = this.offsetY + deco.y * this.tileSize;
      this.drawSprite(deco.spriteKey, px, py, this.tileSize, this.tileSize);
    });

    // Layer 2: Building interiors
    layout.buildings.forEach(b => this.drawBuildingInterior(b));

    // Layer 3: Props
    layout.props.forEach(p => this.drawProp(p));

    // Layer 4: Avatars
    this.avatarRuntime.forEach(avatar => this.drawAvatar(avatar, timestamp));

    // Layer 5: Building roofs (only for buildings without stations)
    layout.buildings.forEach(b => {
      if (b.stations && b.stations.length > 0) return;
      this.drawBuilding(b, false);
    });

    // Layer 6: Location signs
    this.drawLocationSigns(layout);

    // Layer 6.5: Day/night sky tint over the world
    this.drawSkyOverlay();

    // Layer 7: UI overlays — time display and agent roster
    this.drawTimeDisplay();
    this.drawAgentRoster();

    // Layer 8: Selected agent profile panel
    if (this.selectedAgent) {
      this.drawAgentProfile(this.selectedAgent, timestamp);
    }

    // Layer 9: Editor overlays (only when edit mode is on)
    if (this.editor && this.editorState) {
      this.drawEditorOverlay();
    }
  }
}
