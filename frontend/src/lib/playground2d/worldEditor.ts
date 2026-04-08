/**
 * WorldEditor — DOM-based side panel + canvas overlay editor for the 2D playground.
 * Ported from agent-world/frontend/components/WorldEditor.js
 *
 * Provides: building/tree/furniture/outdoor placement, drag-to-move, flip,
 * undo/redo, save/revert, keyboard shortcuts, floating toolbar for selection.
 */

import type { WorldLayout, WorldState, Station, TreeDef, Location, LocationLayoutDef } from './types';
import { WORLD_WIDTH, WORLD_HEIGHT } from './types';
import { FURNITURE_ALIASES } from './furnitureCatalog';

// ─── Constants ───

const EDITOR_VERSION = 2;
const HISTORY_LIMIT = 50;
const STATION_KINDS = ['work', 'rest'] as const;
const TREE_TYPES = ['tree.alt', 'tree.alt2', 'tree.alt3', 'tree.big', 'tree.big.alt'];
const INDOOR_TYPES = ['bed.wide.pink', 'bed.wide.blue', 'bookshelf', 'bookshelf.full', 'bookshelf.scroll', 'cabinet.books', 'cabinet.drawer', 'cabinet.glass', 'cabinet.metal', 'cabinet.metal.alt', 'cabinet.wood', 'cabinet.wood.alt', 'chair', 'chair.alt', 'counter', 'display', 'display.alt', 'dresser.alt', 'dresser.plain', 'dresser.beer', 'nightstand', 'nightstand.alt', 'plant.pink', 'plant.purple', 'safe', 'sofa', 'sofa.alt', 'sofa.alt2', 'stove', 'stove.alt', 'table', 'table.mid', 'table.tiny'];
const OUTDOOR_TYPES = ['outdoor.fishing', 'outdoor.watching', 'outdoor.sitting', 'outdoor.reading', 'outdoor.chatting', 'outdoor.flowers', 'outdoor.mining', 'outdoor.foraging', 'outdoor.napping'];
const BUILDING_TYPES = ['house', 'house2', 'house.green', 'house.green2', 'house.gray', 'tower', 'shop', 'large'];
const OUTDOOR_ICONS: Record<string, string> = {
  'outdoor.fishing': '\u{1F3A3}',
  'outdoor.watching': '\u{1F440}',
  'outdoor.sitting': '\u{1FA91}',
  'outdoor.reading': '\u{1F4D6}',
  'outdoor.chatting': '\u{1F4AC}',
  'outdoor.flowers': '\u{1F338}',
  'outdoor.mining': '\u26CF',
  'outdoor.foraging': '\u{1F353}',
  'outdoor.napping': '\u{1F634}',
};

// ─── Interfaces ───

interface EditorSelection {
  kind: 'tree' | 'indoor' | 'outdoor' | 'building';
  id: string;
}

interface PendingAdd {
  kind: 'tree' | 'indoor' | 'outdoor' | 'building';
  type: string;
  locationId?: string;
}

interface DragState {
  kind: string;
  id: string;
  startTile: { x: number; y: number };
  lastTile: { x: number; y: number };
  moved?: boolean;
  grabOffsetX?: number;
  grabOffsetY?: number;
}

// ─── Helpers ───

function h(
  tag: string,
  attrs: Record<string, any> = {},
  children: (HTMLElement | string | null)[] | string = [],
): HTMLElement {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'class') {
      el.className = val;
    } else if (key === 'style' && typeof val === 'object') {
      Object.assign(el.style, val);
    } else if (key.startsWith('on') && typeof val === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), val);
    } else if (key === 'innerHTML') {
      el.innerHTML = val;
    } else {
      el.setAttribute(key, String(val));
    }
  }
  if (typeof children === 'string') {
    el.textContent = children;
  } else {
    for (const child of children) {
      if (child === null) continue;
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else {
        el.appendChild(child);
      }
    }
  }
  return el;
}

function resolveSpriteKey(kind: string, type: string): string | null {
  if (kind === 'tree') return `prop.${type}`;
  if (kind === 'indoor') {
    const raw = `furniture.${type}`;
    return FURNITURE_ALIASES[raw] || raw;
  }
  if (kind === 'building') return `building.${type}`;
  return null; // outdoor
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function generateId(): string {
  return `ed_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Styles ───

const BG_BASE = '#0c1222';
const BG_PANEL = '#111827';
const BG_CARD = '#1e293b';
const BG_HOVER = '#273548';
const BG_ACTIVE = '#334155';
const BORDER = '#1e3a5f';
const BORDER_LIGHT = '#2d4a6f';
const ACCENT = '#f59e0b';
const ACCENT_HOVER = '#fbbf24';
const ACCENT_DIM = 'rgba(245,158,11,0.15)';
const ACCENT_BG = 'rgba(245,158,11,0.08)';
const DANGER = '#ef4444';
const DANGER_DIM = 'rgba(239,68,68,0.12)';
const SUCCESS = '#22c55e';
const INFO = '#3b82f6';
const TEXT_PRIMARY = '#e2e8f0';
const TEXT_SECONDARY = '#94a3b8';
const TEXT_MUTED = '#64748b';
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const FONT_MONO = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace";

const RADIUS_SM = '6px';
const RADIUS_MD = '8px';
const RADIUS_LG = '12px';

const panelStyle: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  top: '0',
  right: '0',
  width: '340px',
  height: '100%',
  background: BG_PANEL,
  borderLeft: `1px solid ${BORDER}`,
  color: TEXT_PRIMARY,
  fontFamily: FONT,
  fontSize: '13px',
  overflowY: 'auto',
  overflowX: 'hidden',
  zIndex: '50',
  display: 'none',
  boxSizing: 'border-box',
  boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
};

const toggleBtnStyle: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  top: '10px',
  right: '10px',
  padding: '8px 16px',
  background: BG_CARD,
  border: `1px solid ${BORDER_LIGHT}`,
  borderRadius: RADIUS_MD,
  color: TEXT_PRIMARY,
  fontFamily: FONT,
  fontWeight: '600',
  fontSize: '13px',
  cursor: 'pointer',
  zIndex: '51',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  lineHeight: '1',
  whiteSpace: 'nowrap',
  transition: 'all 0.15s ease',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
};

const floaterStyle: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  background: BG_CARD,
  border: `1px solid ${BORDER_LIGHT}`,
  borderRadius: RADIUS_MD,
  padding: '4px',
  zIndex: '52',
  display: 'none',
  gap: '3px',
  fontFamily: FONT,
  fontSize: '12px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
};

// ─── Button Helpers ───

function iconBtn(label: string, opts: { color?: string; bg?: string; onClick: () => void; disabled?: boolean; title?: string; small?: boolean }): HTMLElement {
  const small = opts.small ?? false;
  return h('button', {
    style: {
      background: opts.bg || BG_CARD,
      border: `1px solid ${BORDER}`,
      color: opts.disabled ? TEXT_MUTED : (opts.color || TEXT_PRIMARY),
      cursor: opts.disabled ? 'default' : 'pointer',
      padding: small ? '3px 8px' : '6px 12px',
      borderRadius: RADIUS_SM,
      fontFamily: FONT,
      fontSize: small ? '11px' : '12px',
      fontWeight: '500',
      opacity: opts.disabled ? '0.4' : '1',
      transition: 'all 0.1s ease',
      lineHeight: '1.2',
      whiteSpace: 'nowrap',
    },
    title: opts.title || label,
    onClick: opts.onClick,
  }, label);
}

function badge(text: string, color: string): HTMLElement {
  return h('span', {
    style: {
      background: color + '22',
      color,
      fontSize: '10px',
      fontWeight: '600',
      padding: '1px 6px',
      borderRadius: '10px',
      lineHeight: '1.4',
    },
  }, text);
}

// ─── WorldEditor Class ───

export default class WorldEditor {
  private worldMap: any;
  private container: HTMLElement;
  private apiBaseUrl: string;
  private onLayoutChanged?: (layout: WorldLayout) => void;

  // DOM
  private toggleBtn: HTMLButtonElement;
  private panel: HTMLDivElement;
  private floater: HTMLDivElement;

  // State
  private open = false;
  private layout: WorldLayout | null = null;
  private originalLayout: WorldLayout | null = null;
  private selection: EditorSelection | null = null;
  private pendingAdd: PendingAdd | null = null;
  private drag: DragState | null = null;
  private activeTab: 'buildings' | 'trees' | 'indoor' | 'outdoor' = 'buildings';
  private dirty = false;
  private fetched = false;
  private selectedBuildingId: string | null = null;

  // History
  private undoStack: WorldLayout[] = [];
  private redoStack: WorldLayout[] = [];

  // Bound handlers
  private _onKeyDown: (e: KeyboardEvent) => void;
  private _onMouseMove: (e: MouseEvent) => void;
  private _onMouseUp: (e: MouseEvent) => void;
  private _onTouchMove: (e: TouchEvent) => void;
  private _onTouchEnd: (e: TouchEvent) => void;

  constructor(options: {
    worldMap: any;
    container: HTMLElement;
    apiBaseUrl?: string;
    onLayoutChanged?: (layout: WorldLayout) => void;
  }) {
    this.worldMap = options.worldMap;
    this.container = options.container;
    this.apiBaseUrl = (options.apiBaseUrl || '').replace(/\/$/, '');
    this.onLayoutChanged = options.onLayoutChanged;

    this.toggleBtn = document.createElement('button');
    this.panel = document.createElement('div');
    this.floater = document.createElement('div');

    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onTouchMove = this._handleTouchMove.bind(this);
    this._onTouchEnd = this._handleTouchEnd.bind(this);

    this._buildUI();
    this._bindKeyboard();
    this._bindMouse();
  }

  // ─── UI Setup ───

  private _buildUI(): void {
    Object.assign(this.toggleBtn.style, toggleBtnStyle);
    this.toggleBtn.innerHTML = '\u270F\uFE0F Edit (<u>E</u>)';
    this.toggleBtn.title = 'Toggle World Editor (E)';
    this.toggleBtn.addEventListener('click', () => this.toggle());
    this.container.appendChild(this.toggleBtn);

    Object.assign(this.panel.style, panelStyle);
    this.container.appendChild(this.panel);

    Object.assign(this.floater.style, floaterStyle);
    this.floater.style.display = 'none';
    this.container.appendChild(this.floater);
  }

  // ─── Keyboard ───

  private _bindKeyboard(): void {
    document.addEventListener('keydown', this._onKeyDown);
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === 'e' || e.key === 'E') {
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this.toggle();
        return;
      }
    }

    if (!this.open || !this.layout) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this._undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      this._redo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      this._saveLayout();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selection) {
        e.preventDefault();
        this._deleteSelected();
        return;
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.pendingAdd) {
        this.pendingAdd = null;
        this._syncCanvas();
        this._render();
      } else if (this.selection) {
        this.selection = null;
        this._syncCanvas();
        this._updateFloater();
        this._render();
      }
      return;
    }
    if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) {
      if (this.selection) {
        e.preventDefault();
        this._flipSelected(e.shiftKey ? 'y' : 'x');
        return;
      }
    }
    const arrowMap: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    if (arrowMap[e.key] && this.selection) {
      e.preventDefault();
      const [dx, dy] = arrowMap[e.key];
      this._moveSelected(dx, dy);
      return;
    }
  }

  // ─── Mouse / Touch ───

  private _bindMouse(): void {
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('touchmove', this._onTouchMove, { passive: false });
    document.addEventListener('touchend', this._onTouchEnd);
  }

  private _eventToTile(event: MouseEvent | Touch): { x: number; y: number } | null {
    const canvas: HTMLCanvasElement = this.worldMap.canvas ?? this.worldMap._canvas;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const tileSize: number = this.worldMap.tileSize ?? this.worldMap._tileSize ?? 24;
    const offX: number = this.worldMap.offsetX ?? this.worldMap._offsetX ?? 0;
    const offY: number = this.worldMap.offsetY ?? this.worldMap._offsetY ?? 0;
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    const tx = Math.floor((cx - offX) / tileSize);
    const ty = Math.floor((cy - offY) / tileSize);
    return { x: tx, y: ty };
  }

  private _handleMouseMove(e: MouseEvent): void {
    if (!this.drag || !this.layout) return;
    const tile = this._eventToTile(e);
    if (!tile) return;
    if (tile.x === this.drag.lastTile.x && tile.y === this.drag.lastTile.y) return;
    const dx = tile.x - this.drag.lastTile.x;
    const dy = tile.y - this.drag.lastTile.y;
    this.drag.lastTile = { x: tile.x, y: tile.y };
    this.drag.moved = true;
    this._applyDrag(dx, dy);
  }

  private _handleMouseUp(_e: MouseEvent): void {
    if (!this.drag) return;
    if (this.drag.moved) {
      this._pushHistory();
      this.dirty = true;
    }
    this.drag = null;
    this._syncCanvas();
    this._updateFloater();
    this._render();
  }

  private _handleTouchMove(e: TouchEvent): void {
    if (!this.drag || !this.layout) return;
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const tile = this._eventToTile(e.touches[0]);
    if (!tile) return;
    if (tile.x === this.drag.lastTile.x && tile.y === this.drag.lastTile.y) return;
    const dx = tile.x - this.drag.lastTile.x;
    const dy = tile.y - this.drag.lastTile.y;
    this.drag.lastTile = { x: tile.x, y: tile.y };
    this.drag.moved = true;
    this._applyDrag(dx, dy);
  }

  private _handleTouchEnd(_e: TouchEvent): void {
    if (!this.drag) return;
    if (this.drag.moved) {
      this._pushHistory();
      this.dirty = true;
    }
    this.drag = null;
    this._syncCanvas();
    this._updateFloater();
    this._render();
  }

  private _applyDrag(dx: number, dy: number): void {
    if (!this.drag || !this.layout) return;
    const { kind, id } = this.drag;

    if (kind === 'tree') {
      const tree = this.layout.trees.find((t, i) => `tree_${i}` === id);
      if (tree) { tree.x += dx; tree.y += dy; }
    } else if (kind === 'indoor') {
      const st = this.layout.indoorStations.find(s => s.id === id);
      if (st) { st.dx += dx; st.dy += dy; }
    } else if (kind === 'outdoor') {
      const st = this.layout.outdoorStations.find(s => s.id === id);
      if (st && st.x != null && st.y != null) { st.x += dx; st.y += dy; }
    } else if (kind === 'building') {
      const b = this.layout.buildings?.find(b => b.id === id);
      if (b) { b.x += dx; b.y += dy; }
    }
    this._syncCanvas();
    this._updateFloater();
  }

  // ─── Called from WorldMap (canvas mouse down) ───

  onCanvasMouseDown(
    tileX: number,
    tileY: number,
    worldState: WorldState | null,
    event: MouseEvent | TouchEvent,
  ): void {
    if (!this.open || !this.layout) return;

    if (this.pendingAdd) {
      this._placeAtTile(tileX, tileY, worldState);
      return;
    }

    const hit = this._findHit(tileX, tileY, worldState);
    if (hit) {
      this.selection = hit;
      this.drag = {
        kind: hit.kind,
        id: hit.id,
        startTile: { x: tileX, y: tileY },
        lastTile: { x: tileX, y: tileY },
        moved: false,
      };
      this._syncCanvas();
      this._updateFloater();
      this._render();
    } else {
      if (this.selection) {
        this.selection = null;
        this._syncCanvas();
        this._updateFloater();
        this._render();
      }
    }
  }

  // ─── Toggle ───

  toggle(): void {
    this.open = !this.open;
    if (this.worldMap.setEditorMode) {
      this.worldMap.setEditorMode(this.open, this);
    }
    if (this.open) {
      this.panel.style.display = 'block';
      this.toggleBtn.style.right = '350px';
      this.toggleBtn.style.background = ACCENT;
      this.toggleBtn.style.color = BG_BASE;
      this.toggleBtn.style.borderColor = ACCENT;
      if (!this.fetched) {
        this._fetchLayout();
      } else {
        this._render();
        this._syncCanvas();
      }
    } else {
      this.panel.style.display = 'none';
      this.floater.style.display = 'none';
      this.toggleBtn.style.right = '10px';
      this.toggleBtn.style.background = BG_CARD;
      this.toggleBtn.style.color = TEXT_PRIMARY;
      this.toggleBtn.style.borderColor = BORDER_LIGHT;
      this.selection = null;
      this.pendingAdd = null;
      this.drag = null;
      this._syncCanvas();
    }
  }

  // ─── API ───

  private async _fetchLayout(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/api/playground2d/layout`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.layout = data as WorldLayout;
      if (!this.layout.version) this.layout.version = EDITOR_VERSION;
      if (!this.layout.buildings) this.layout.buildings = [];
      if (!this.layout.trees) this.layout.trees = [];
      if (!this.layout.indoorStations) this.layout.indoorStations = [];
      if (!this.layout.outdoorStations) this.layout.outdoorStations = [];
      this.originalLayout = deepClone(this.layout);
      this.fetched = true;
      this.dirty = false;
      this._resetHistory();
      // Auto-select first building for indoor tab
      if (this.layout.buildings && this.layout.buildings.length > 0) {
        this.selectedBuildingId = this.layout.buildings[0].id;
      }
      this._syncCanvas();
      this._render();
    } catch (err) {
      console.error('[WorldEditor] Failed to fetch layout:', err);
      this.layout = {
        version: EDITOR_VERSION,
        indoorStations: [],
        outdoorStations: [],
        trees: [],
        buildings: [],
      };
      this.originalLayout = deepClone(this.layout);
      this.fetched = true;
      this.dirty = false;
      this._resetHistory();
      this._render();
    }
  }

  private async _saveLayout(): Promise<void> {
    if (!this.layout) return;
    try {
      const res = await fetch(`${this.apiBaseUrl}/api/playground2d/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.layout),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.originalLayout = deepClone(this.layout);
      this.dirty = false;
      this._render();
      this.onLayoutChanged?.(deepClone(this.layout));
    } catch (err) {
      console.error('[WorldEditor] Failed to save layout:', err);
      alert('Failed to save layout. Check the console for details.');
    }
  }

  private _revert(): void {
    if (!this.originalLayout) return;
    this._pushHistory();
    this.layout = deepClone(this.originalLayout);
    this.dirty = false;
    this.selection = null;
    this.pendingAdd = null;
    this._syncCanvas();
    this._updateFloater();
    this._render();
  }

  // ─── History ───

  private _pushHistory(): void {
    if (!this.layout) return;
    this.undoStack.push(deepClone(this.layout));
    if (this.undoStack.length > HISTORY_LIMIT) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  private _undo(): void {
    if (this.undoStack.length === 0 || !this.layout) return;
    this.redoStack.push(deepClone(this.layout));
    this.layout = this.undoStack.pop()!;
    this.dirty = true;
    this.selection = null;
    this._syncCanvas();
    this._updateFloater();
    this._render();
  }

  private _redo(): void {
    if (this.redoStack.length === 0 || !this.layout) return;
    this.undoStack.push(deepClone(this.layout));
    this.layout = this.redoStack.pop()!;
    this.dirty = true;
    this.selection = null;
    this._syncCanvas();
    this._updateFloater();
    this._render();
  }

  private _resetHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  // ─── Selection Operations ───

  private _deleteSelected(): void {
    if (!this.selection || !this.layout) return;
    this._pushHistory();
    const { kind, id } = this.selection;

    if (kind === 'tree') {
      const idx = this.layout.trees.findIndex((_, i) => `tree_${i}` === id);
      if (idx >= 0) this.layout.trees.splice(idx, 1);
    } else if (kind === 'indoor') {
      const idx = this.layout.indoorStations.findIndex(s => s.id === id);
      if (idx >= 0) this.layout.indoorStations.splice(idx, 1);
    } else if (kind === 'outdoor') {
      const idx = this.layout.outdoorStations.findIndex(s => s.id === id);
      if (idx >= 0) this.layout.outdoorStations.splice(idx, 1);
    } else if (kind === 'building') {
      if (this.layout.buildings) {
        const idx = this.layout.buildings.findIndex(b => b.id === id);
        if (idx >= 0) this.layout.buildings.splice(idx, 1);
      }
    }

    this.selection = null;
    this.dirty = true;
    this._syncCanvas();
    this._updateFloater();
    this._render();
  }

  private _flipSelected(axis: 'x' | 'y'): void {
    if (!this.selection || !this.layout) return;
    this._pushHistory();
    const obj = this._getSelectedObject();
    if (!obj) return;

    if (axis === 'x') {
      (obj as any).flipX = !(obj as any).flipX;
    } else {
      (obj as any).flipY = !(obj as any).flipY;
    }

    this.dirty = true;
    this._syncCanvas();
    this._render();
  }

  private _moveSelected(dx: number, dy: number): void {
    if (!this.selection || !this.layout) return;
    this._pushHistory();
    const { kind, id } = this.selection;

    const maxX = WORLD_WIDTH - 1;
    const maxY = WORLD_HEIGHT - 1;

    if (kind === 'tree') {
      const tree = this.layout.trees.find((_, i) => `tree_${i}` === id);
      if (tree) {
        tree.x = Math.max(0, Math.min(maxX, tree.x + dx));
        tree.y = Math.max(0, Math.min(maxY, tree.y + dy));
      }
    } else if (kind === 'indoor') {
      const st = this.layout.indoorStations.find(s => s.id === id);
      if (st) { st.dx += dx; st.dy += dy; }
    } else if (kind === 'outdoor') {
      const st = this.layout.outdoorStations.find(s => s.id === id);
      if (st && st.x != null && st.y != null) {
        st.x = Math.max(0, Math.min(maxX, st.x + dx));
        st.y = Math.max(0, Math.min(maxY, st.y + dy));
      }
    } else if (kind === 'building') {
      const b = this.layout.buildings?.find(b => b.id === id);
      if (b) {
        b.x = Math.max(0, Math.min(maxX, b.x + dx));
        b.y = Math.max(0, Math.min(maxY, b.y + dy));
      }
    }

    this.dirty = true;
    this._syncCanvas();
    this._updateFloater();
    this._render();
  }

  // ─── Hit Testing ───

  private _findHit(tx: number, ty: number, worldState: WorldState | null): EditorSelection | null {
    if (!this.layout) return null;

    // Check indoor stations first (they sit inside buildings, higher priority than building body)
    const buildings = this.layout.buildings || [];
    for (const st of this.layout.indoorStations) {
      const loc = buildings.find(b => b.id === st.locationId);
      if (loc) {
        const absX = loc.x + st.dx;
        const absY = loc.y + st.dy;
        if (tx === absX && ty === absY) {
          return { kind: 'indoor', id: st.id };
        }
      }
    }

    // Check outdoor stations
    for (const st of this.layout.outdoorStations) {
      if (st.x != null && st.y != null && tx === st.x && ty === st.y) {
        return { kind: 'outdoor', id: st.id };
      }
    }

    // Check trees
    for (let i = this.layout.trees.length - 1; i >= 0; i--) {
      const tree = this.layout.trees[i];
      if (tx === tree.x && ty === tree.y) {
        return { kind: 'tree', id: `tree_${i}` };
      }
    }

    // Check buildings last (they are bigger, lower priority)
    if (this.layout.buildings) {
      for (const b of this.layout.buildings) {
        if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) {
          return { kind: 'building', id: b.id };
        }
      }
    }

    return null;
  }

  // ─── Placement ───

  private _placeAtTile(tx: number, ty: number, worldState: WorldState | null): void {
    if (!this.pendingAdd || !this.layout) return;
    this._pushHistory();
    const { kind, type, locationId } = this.pendingAdd;

    if (kind === 'tree') {
      this.layout.trees.push({ x: tx, y: ty, type });
    } else if (kind === 'indoor') {
      // Use the selected building from the indoor tab's building selector
      const targetBuildingId = locationId || this.selectedBuildingId || '';
      const loc = targetBuildingId
        ? (this.layout.buildings || []).find(b => b.id === targetBuildingId)
        : null;

      if (!loc) {
        // No valid building selected — cannot place indoor item
        this.pendingAdd = null;
        this._syncCanvas();
        this._render();
        return;
      }

      const relX = tx - loc.x;
      const relY = ty - loc.y;
      const station: Station & { locationId: string } = {
        id: generateId(),
        kind: 'work',
        type,
        dx: relX,
        dy: relY,
        label: type,
        locationId: targetBuildingId,
      };
      this.layout.indoorStations.push(station);
    } else if (kind === 'outdoor') {
      const station: Station = {
        id: generateId(),
        kind: 'rest',
        type,
        dx: 0,
        dy: 0,
        label: type,
        x: tx,
        y: ty,
        activity: type.replace('outdoor.', ''),
      };
      this.layout.outdoorStations.push(station);
    } else if (kind === 'building') {
      if (!this.layout.buildings) this.layout.buildings = [];
      const def: LocationLayoutDef = {
        id: generateId(),
        name: type,
        type,
        x: tx,
        y: ty,
        w: type === 'large' ? 8 : type === 'tower' ? 4 : 5,
        h: type === 'large' ? 6 : type === 'tower' ? 6 : 4,
      };
      this.layout.buildings.push(def);
      // Auto-select new building for indoor placement
      this.selectedBuildingId = def.id;
    }

    this.pendingAdd = null;
    this.dirty = true;
    this._syncCanvas();
    this._render();
  }

  // ─── Sync ───

  private _syncCanvas(): void {
    if (!this.worldMap.setEditorState) return;
    if (!this.open || !this.layout) {
      this.worldMap.setEditorState(null);
      return;
    }
    this.worldMap.setEditorState({
      layout: {
        trees: this.layout.trees || [],
        outdoorStations: this.layout.outdoorStations || [],
        indoorStations: this.layout.indoorStations || [],
        buildings: this.layout.buildings || [],
      },
      selection: this.selection || null,
      pendingAdd: this.pendingAdd || null,
      dragging: !!this.drag,
    });
    this._updateFloater();
  }

  // ─── Floater ───

  private _updateFloater(): void {
    if (!this.selection || !this.open) {
      this.floater.style.display = 'none';
      return;
    }
    const obj = this._getSelectedObject();
    if (!obj) {
      this.floater.style.display = 'none';
      return;
    }

    const tileSize: number = this.worldMap.tileSize ?? this.worldMap._tileSize ?? 24;
    const offX: number = this.worldMap.offsetX ?? this.worldMap._offsetX ?? 0;
    const offY: number = this.worldMap.offsetY ?? this.worldMap._offsetY ?? 0;

    let px = 0;
    let py = 0;

    if (this.selection.kind === 'indoor' && 'dx' in obj) {
      // Indoor stations: compute absolute position from building + offset
      const st = obj as Station & { locationId: string };
      const buildings = this.layout?.buildings || [];
      const loc = buildings.find(b => b.id === st.locationId);
      if (loc) {
        px = offX + (loc.x + st.dx) * tileSize;
        py = offY + (loc.y + st.dy) * tileSize;
      } else {
        px = offX + st.dx * tileSize;
        py = offY + st.dy * tileSize;
      }
    } else if ('x' in obj && typeof (obj as any).x === 'number') {
      px = offX + (obj as any).x * tileSize;
      py = offY + (obj as any).y * tileSize;
    } else if ('dx' in obj) {
      px = offX + ((obj as any).dx ?? 0) * tileSize;
      py = offY + ((obj as any).dy ?? 0) * tileSize;
    }

    this.floater.style.left = `${px}px`;
    this.floater.style.top = `${Math.max(0, py - 44)}px`;
    this.floater.style.display = 'flex';
    this._renderFloater();
  }

  private _renderFloater(): void {
    this.floater.innerHTML = '';
    const mk = (label: string, color: string, onClick: () => void) =>
      h('button', {
        style: {
          background: BG_ACTIVE,
          border: `1px solid ${BORDER}`,
          color,
          cursor: 'pointer',
          padding: '4px 10px',
          borderRadius: RADIUS_SM,
          fontFamily: FONT,
          fontSize: '11px',
          fontWeight: '500',
          transition: 'all 0.1s ease',
        },
        onClick,
      }, label);

    this.floater.appendChild(mk('Flip X', TEXT_PRIMARY, () => this._flipSelected('x')));
    this.floater.appendChild(mk('Flip Y', TEXT_PRIMARY, () => this._flipSelected('y')));
    this.floater.appendChild(mk('Delete', DANGER, () => this._deleteSelected()));
    this.floater.appendChild(mk('\u2715', TEXT_MUTED, () => {
      this.selection = null;
      this._syncCanvas();
      this._updateFloater();
      this._render();
    }));
  }

  // ─── Get Selected ───

  private _getSelectedObject(): Station | TreeDef | LocationLayoutDef | null {
    if (!this.selection || !this.layout) return null;
    const { kind, id } = this.selection;
    if (kind === 'tree') {
      const idx = this.layout.trees.findIndex((_, i) => `tree_${i}` === id);
      return idx >= 0 ? this.layout.trees[idx] : null;
    }
    if (kind === 'indoor') {
      return this.layout.indoorStations.find(s => s.id === id) || null;
    }
    if (kind === 'outdoor') {
      return this.layout.outdoorStations.find(s => s.id === id) || null;
    }
    if (kind === 'building') {
      return this.layout.buildings?.find(b => b.id === id) || null;
    }
    return null;
  }

  // ─── Helper: resolve building name from id ───

  private _getBuildingName(id: string): string {
    const b = this.layout?.buildings?.find(b => b.id === id);
    return b ? (b.name || b.type || id) : id;
  }

  // ─── Panel Render ───

  private _render(): void {
    this.panel.innerHTML = '';
    if (!this.open) return;

    // Inject scrollbar styles
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .we-panel::-webkit-scrollbar { width: 6px; }
      .we-panel::-webkit-scrollbar-track { background: ${BG_PANEL}; }
      .we-panel::-webkit-scrollbar-thumb { background: ${BG_ACTIVE}; border-radius: 3px; }
      .we-panel::-webkit-scrollbar-thumb:hover { background: ${BORDER_LIGHT}; }
      .we-select { appearance: none; background: ${BG_CARD}; border: 1px solid ${BORDER}; color: ${TEXT_PRIMARY}; padding: 6px 28px 6px 10px; border-radius: ${RADIUS_SM}; font-family: ${FONT}; font-size: 12px; cursor: pointer; outline: none; width: 100%; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M3 5l3 3 3-3'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 8px center; }
      .we-select:focus { border-color: ${ACCENT}; }
      .we-input { background: ${BG_CARD}; border: 1px solid ${BORDER}; color: ${TEXT_PRIMARY}; padding: 5px 10px; border-radius: ${RADIUS_SM}; font-family: ${FONT}; font-size: 12px; outline: none; width: 100%; box-sizing: border-box; }
      .we-input:focus { border-color: ${ACCENT}; }
    `;
    this.panel.appendChild(styleEl);
    this.panel.classList.add('we-panel');

    this.panel.appendChild(this._renderHeader());
    this.panel.appendChild(this._renderTabs());

    // Building selector for indoor tab
    if (this.activeTab === 'indoor') {
      this.panel.appendChild(this._renderBuildingSelector());
    }

    this.panel.appendChild(this._renderAddToolbar());

    if (this.selection) {
      this.panel.appendChild(this._renderInspector());
    }

    this.panel.appendChild(this._renderItemList());
  }

  // ─── Header ───

  private _renderHeader(): HTMLElement {
    const left = h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
      h('span', { style: { fontWeight: '700', color: ACCENT, fontSize: '15px', letterSpacing: '0.5px' } }, 'EDITOR'),
      this.dirty
        ? badge('unsaved', ACCENT)
        : badge('saved', SUCCESS),
    ]);

    const right = h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, [
      iconBtn('\u21B6', { onClick: () => this._undo(), disabled: this.undoStack.length === 0, title: 'Undo (Ctrl+Z)', small: true }),
      iconBtn('\u21B7', { onClick: () => this._redo(), disabled: this.redoStack.length === 0, title: 'Redo (Ctrl+Y)', small: true }),
      iconBtn('\u21BA', { onClick: () => this._revert(), color: '#fb923c', title: 'Revert to saved', small: true }),
      iconBtn('Save', {
        onClick: () => this._saveLayout(),
        bg: this.dirty ? ACCENT : BG_CARD,
        color: this.dirty ? BG_BASE : TEXT_MUTED,
        title: 'Save (Ctrl+S)',
        small: true,
      }),
      iconBtn('\u2715', { onClick: () => this.toggle(), color: TEXT_MUTED, title: 'Close editor', small: true }),
    ]);

    return h('div', {
      style: {
        padding: '12px 14px',
        borderBottom: `1px solid ${BORDER}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: BG_BASE,
      },
    }, [left, right]);
  }

  // ─── Tabs ───

  private _renderTabs(): HTMLElement {
    const tabDefs: { key: 'buildings' | 'trees' | 'indoor' | 'outdoor'; label: string; icon: string; count: number }[] = [
      { key: 'buildings', label: 'Buildings', icon: '\u{1F3E0}', count: this.layout?.buildings?.length || 0 },
      { key: 'trees', label: 'Trees', icon: '\u{1F332}', count: this.layout?.trees?.length || 0 },
      { key: 'indoor', label: 'Indoor', icon: '\u{1FA91}', count: this.layout?.indoorStations?.length || 0 },
      { key: 'outdoor', label: 'Outdoor', icon: '\u{1F3D5}', count: this.layout?.outdoorStations?.length || 0 },
    ];

    const tabs = tabDefs.map(def => {
      const active = this.activeTab === def.key;
      return h('button', {
        style: {
          flex: '1',
          background: active ? ACCENT_DIM : 'transparent',
          border: active ? `1px solid ${ACCENT}55` : '1px solid transparent',
          borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
          color: active ? ACCENT : TEXT_SECONDARY,
          cursor: 'pointer',
          padding: '8px 4px 6px',
          borderRadius: `${RADIUS_SM} ${RADIUS_SM} 0 0`,
          fontFamily: FONT,
          fontSize: '11px',
          fontWeight: active ? '600' : '400',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          transition: 'all 0.15s ease',
        },
        onClick: () => {
          this.activeTab = def.key;
          this.pendingAdd = null;
          this._syncCanvas();
          this._render();
        },
      }, [
        h('span', { style: { fontSize: '16px', lineHeight: '1' } }, def.icon),
        h('span', {}, `${def.label}`),
        def.count > 0 ? h('span', {
          style: {
            fontSize: '9px',
            color: active ? ACCENT : TEXT_MUTED,
            fontWeight: '600',
          },
        }, `${def.count}`) : null,
      ]);
    });

    return h('div', {
      style: {
        display: 'flex',
        borderBottom: `1px solid ${BORDER}`,
        background: BG_BASE,
      },
    }, tabs);
  }

  // ─── Building Selector (Indoor tab) ───

  private _renderBuildingSelector(): HTMLElement {
    const buildings = this.layout?.buildings || [];

    if (buildings.length === 0) {
      return h('div', {
        style: {
          padding: '12px 14px',
          background: DANGER_DIM,
          borderBottom: `1px solid ${BORDER}`,
          color: DANGER,
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        },
      }, [
        h('span', { style: { fontSize: '16px' } }, '\u26A0'),
        h('span', {}, 'No buildings exist. Add buildings first before placing indoor furniture.'),
      ]);
    }

    const select = document.createElement('select');
    select.className = 'we-select';
    for (const b of buildings) {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.name || b.type} (${b.x},${b.y})`;
      if (b.id === this.selectedBuildingId) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      this.selectedBuildingId = select.value;
      this._render();
    });

    // If no building selected or selected doesn't exist, auto-select first
    if (!this.selectedBuildingId || !buildings.find(b => b.id === this.selectedBuildingId)) {
      this.selectedBuildingId = buildings[0].id;
    }

    const selectedBuilding = buildings.find(b => b.id === this.selectedBuildingId);
    const stationCount = this.layout?.indoorStations.filter(s => s.locationId === this.selectedBuildingId).length || 0;

    return h('div', {
      style: {
        padding: '10px 14px',
        borderBottom: `1px solid ${BORDER}`,
        background: ACCENT_BG,
      },
    }, [
      h('div', {
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' },
      }, [
        h('span', { style: { fontSize: '11px', fontWeight: '600', color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.5px' } }, 'Target Building'),
        stationCount > 0
          ? h('span', { style: { fontSize: '10px', color: TEXT_MUTED } }, `${stationCount} station${stationCount > 1 ? 's' : ''} inside`)
          : null,
      ]),
      select,
      selectedBuilding
        ? h('div', {
            style: { marginTop: '6px', fontSize: '10px', color: TEXT_MUTED },
          }, `${selectedBuilding.type} at (${selectedBuilding.x}, ${selectedBuilding.y}) \u2014 ${selectedBuilding.w}\u00D7${selectedBuilding.h}`)
        : null,
    ]);
  }

  // ─── Add Toolbar ───

  private _renderAddToolbar(): HTMLElement {
    let types: string[] = [];
    let kind: PendingAdd['kind'] = 'tree';

    if (this.activeTab === 'buildings') {
      types = BUILDING_TYPES;
      kind = 'building';
    } else if (this.activeTab === 'trees') {
      types = TREE_TYPES;
      kind = 'tree';
    } else if (this.activeTab === 'indoor') {
      types = INDOOR_TYPES;
      kind = 'indoor';
    } else if (this.activeTab === 'outdoor') {
      types = OUTDOOR_TYPES;
      kind = 'outdoor';
    }

    // For indoor, check if building is selected
    const indoorBlocked = this.activeTab === 'indoor' && (!this.selectedBuildingId || !(this.layout?.buildings || []).find(b => b.id === this.selectedBuildingId));

    const pending = this.pendingAdd;
    const thumbs = types.map(type => {
      const isActive = pending && pending.kind === kind && pending.type === type;
      const thumb = this._makeThumbnail(kind, type, 40);
      const shortName = type.replace('outdoor.', '').replace('tree.', '').replace('house.', '');

      return h('div', {
        style: {
          width: '54px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          cursor: indoorBlocked ? 'not-allowed' : 'pointer',
          background: isActive ? ACCENT_DIM : 'transparent',
          border: isActive ? `2px solid ${ACCENT}` : `2px solid transparent`,
          borderRadius: RADIUS_MD,
          padding: '4px 2px',
          opacity: indoorBlocked ? '0.3' : '1',
          transition: 'all 0.1s ease',
        },
        title: type,
        onClick: () => {
          if (indoorBlocked) return;
          if (isActive) {
            this.pendingAdd = null;
          } else {
            const pa: PendingAdd = { kind, type };
            if (kind === 'indoor' && this.selectedBuildingId) {
              pa.locationId = this.selectedBuildingId;
            }
            this.pendingAdd = pa;
          }
          this._syncCanvas();
          this._render();
        },
      }, [
        thumb,
        h('span', {
          style: { fontSize: '9px', color: TEXT_MUTED, textAlign: 'center', lineHeight: '1.1', maxWidth: '52px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        }, shortName),
      ]);
    });

    const hint = this.pendingAdd
      ? `Click on canvas to place ${this.pendingAdd.type}. Press Esc to cancel.`
      : 'Select an item below, then click on the canvas to place it.';

    return h('div', {
      style: {
        padding: '10px 14px',
        borderBottom: `1px solid ${BORDER}`,
      },
    }, [
      h('div', {
        style: {
          fontSize: '10px',
          color: this.pendingAdd ? ACCENT : TEXT_MUTED,
          marginBottom: '8px',
          padding: this.pendingAdd ? '4px 8px' : '0',
          background: this.pendingAdd ? ACCENT_DIM : 'transparent',
          borderRadius: RADIUS_SM,
          fontWeight: this.pendingAdd ? '500' : '400',
        },
      }, hint),
      h('div', {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          maxHeight: '180px',
          overflowY: 'auto',
        },
      }, thumbs),
    ]);
  }

  // ─── Inspector ───

  private _renderInspector(): HTMLElement {
    const obj = this._getSelectedObject();
    if (!obj) {
      return h('div', { style: { padding: '10px 14px', color: TEXT_MUTED } }, 'No selection');
    }

    const rows: HTMLElement[] = [];

    const addRow = (label: string, content: HTMLElement | string) => {
      const valEl = typeof content === 'string'
        ? h('span', { style: { color: TEXT_PRIMARY, fontSize: '12px', fontFamily: FONT_MONO } }, content)
        : content;
      rows.push(h('div', {
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' },
      }, [
        h('span', { style: { color: TEXT_MUTED, fontSize: '11px', fontWeight: '500' } }, label),
        valEl,
      ]));
    };

    // Kind badge
    const kindColors: Record<string, string> = { building: INFO, tree: SUCCESS, indoor: ACCENT, outdoor: '#a78bfa' };
    addRow('Type', badge(this.selection!.kind, kindColors[this.selection!.kind] || TEXT_PRIMARY));

    // ID
    addRow('ID', this.selection!.id.length > 16 ? this.selection!.id.slice(0, 16) + '\u2026' : this.selection!.id);

    // Type/sprite
    if ('type' in obj) addRow('Sprite', (obj as any).type);

    // Position
    if (this.selection!.kind === 'indoor' && 'dx' in obj) {
      const st = obj as Station & { locationId: string };
      const loc = (this.layout?.buildings || []).find(b => b.id === st.locationId);
      if (loc) {
        addRow('Building', `${this._getBuildingName(st.locationId)}`);
        addRow('Offset', `dx=${st.dx}, dy=${st.dy}`);
        addRow('Absolute', `${loc.x + st.dx}, ${loc.y + st.dy}`);
      } else {
        addRow('Building', h('span', { style: { color: DANGER, fontSize: '11px' } }, 'UNLINKED'));
        addRow('Offset', `dx=${st.dx}, dy=${st.dy}`);
      }
    } else if ('x' in obj && typeof (obj as any).x === 'number') {
      addRow('Position', `${(obj as any).x}, ${(obj as any).y}`);
    }

    // Size (buildings)
    if ('w' in obj) addRow('Size', `${(obj as any).w} \u00D7 ${(obj as any).h}`);

    // Flip state
    if ('flipX' in obj || 'flipY' in obj) {
      const flipX = !!(obj as any).flipX;
      const flipY = !!(obj as any).flipY;
      addRow('Flip', `${flipX ? 'X' : ''} ${flipY ? 'Y' : ''}`.trim() || 'none');
    }

    // Station kind toggle (indoor/outdoor)
    if (this.selection!.kind === 'indoor' || this.selection!.kind === 'outdoor') {
      const station = obj as Station;
      const kindToggle = h('div', { style: { display: 'flex', gap: '4px' } }, [
        this._kindToggleBtn('work', station.kind === 'work', () => {
          this._pushHistory();
          station.kind = 'work';
          this.dirty = true;
          this._syncCanvas();
          this._render();
        }),
        this._kindToggleBtn('rest', station.kind === 'rest', () => {
          this._pushHistory();
          station.kind = 'rest';
          this.dirty = true;
          this._syncCanvas();
          this._render();
        }),
      ]);
      addRow('Kind', kindToggle);
    }

    // Label editor (indoor/outdoor)
    if ('label' in obj) {
      const station = obj as Station;
      const input = document.createElement('input');
      input.className = 'we-input';
      input.value = station.label || '';
      input.style.width = '140px';
      input.style.fontSize = '11px';
      input.style.padding = '3px 8px';
      input.addEventListener('change', () => {
        this._pushHistory();
        station.label = input.value;
        this.dirty = true;
        this._syncCanvas();
      });
      addRow('Label', input);
    }

    // Activity selector (outdoor only)
    if (this.selection!.kind === 'outdoor' && 'activity' in obj) {
      const station = obj as Station;
      const activities = OUTDOOR_TYPES.map(t => t.replace('outdoor.', ''));
      const select = document.createElement('select');
      select.className = 'we-select';
      select.style.width = '140px';
      select.style.fontSize = '11px';
      select.style.padding = '3px 8px 3px 8px';
      for (const act of activities) {
        const opt = document.createElement('option');
        opt.value = act;
        opt.textContent = `${OUTDOOR_ICONS['outdoor.' + act] || ''} ${act}`;
        if (act === station.activity) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        this._pushHistory();
        station.activity = select.value;
        this.dirty = true;
        this._syncCanvas();
      });
      addRow('Activity', select);
    }

    // Building name editor
    if (this.selection!.kind === 'building' && 'name' in obj) {
      const building = obj as LocationLayoutDef;
      const input = document.createElement('input');
      input.className = 'we-input';
      input.value = building.name || '';
      input.style.width = '140px';
      input.style.fontSize = '11px';
      input.style.padding = '3px 8px';
      input.addEventListener('change', () => {
        this._pushHistory();
        building.name = input.value;
        this.dirty = true;
        this._syncCanvas();
      });
      addRow('Name', input);
    }

    // Indoor building reassignment
    if (this.selection!.kind === 'indoor') {
      const station = obj as Station & { locationId: string };
      const buildings = this.layout?.buildings || [];
      if (buildings.length > 1) {
        const select = document.createElement('select');
        select.className = 'we-select';
        select.style.width = '140px';
        select.style.fontSize = '11px';
        select.style.padding = '3px 8px 3px 8px';
        for (const b of buildings) {
          const opt = document.createElement('option');
          opt.value = b.id;
          opt.textContent = `${b.name || b.type}`;
          if (b.id === station.locationId) opt.selected = true;
          select.appendChild(opt);
        }
        select.addEventListener('change', () => {
          this._pushHistory();
          const oldLoc = buildings.find(b => b.id === station.locationId);
          const newLoc = buildings.find(b => b.id === select.value);
          // Recompute dx/dy to keep absolute position the same
          if (oldLoc && newLoc) {
            const absX = oldLoc.x + station.dx;
            const absY = oldLoc.y + station.dy;
            station.dx = absX - newLoc.x;
            station.dy = absY - newLoc.y;
          }
          station.locationId = select.value;
          this.dirty = true;
          this._syncCanvas();
          this._render();
        });
        addRow('Move to', select);
      }
    }

    return h('div', {
      style: {
        margin: '8px 10px',
        padding: '10px 12px',
        background: BG_CARD,
        borderRadius: RADIUS_LG,
        border: `1px solid ${BORDER}`,
      },
    }, [
      h('div', {
        style: { fontWeight: '600', color: ACCENT, marginBottom: '8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' },
      }, 'Inspector'),
      ...rows,
    ]);
  }

  private _kindToggleBtn(kind: string, active: boolean, onClick: () => void): HTMLElement {
    const colors: Record<string, string> = { work: '#f59e0b', rest: '#22c55e' };
    const color = colors[kind] || TEXT_PRIMARY;
    return h('button', {
      style: {
        background: active ? color + '22' : 'transparent',
        border: active ? `1px solid ${color}66` : `1px solid ${BORDER}`,
        color: active ? color : TEXT_MUTED,
        cursor: 'pointer',
        padding: '2px 10px',
        borderRadius: RADIUS_SM,
        fontFamily: FONT,
        fontSize: '10px',
        fontWeight: active ? '600' : '400',
        transition: 'all 0.1s ease',
      },
      onClick,
    }, kind);
  }

  // ─── Item List ───

  private _renderItemList(): HTMLElement {
    if (!this.layout) {
      return h('div', { style: { padding: '14px', color: TEXT_MUTED, textAlign: 'center' } }, 'No layout loaded');
    }

    const items: HTMLElement[] = [];

    const sectionHeader = (title: string, count: number) =>
      h('div', {
        style: {
          padding: '8px 14px 6px',
          color: TEXT_MUTED,
          fontSize: '10px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
      }, [
        h('span', {}, title),
        h('span', { style: { color: TEXT_MUTED, fontWeight: '400' } }, `${count}`),
      ]);

    const itemRow = (opts: {
      selected: boolean;
      pos: string;
      label: string;
      sublabel?: string;
      kindBadge?: { text: string; color: string };
      icon?: string;
      onClick: () => void;
    }) => {
      return h('button', {
        style: {
          background: opts.selected ? ACCENT_DIM : 'transparent',
          border: 'none',
          borderLeft: opts.selected ? `3px solid ${ACCENT}` : '3px solid transparent',
          color: opts.selected ? TEXT_PRIMARY : TEXT_SECONDARY,
          cursor: 'pointer',
          padding: '6px 14px 6px 11px',
          fontFamily: FONT,
          fontSize: '12px',
          textAlign: 'left',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.1s ease',
          boxSizing: 'border-box',
        },
        onClick: opts.onClick,
      }, [
        h('span', {
          style: {
            color: opts.selected ? ACCENT : TEXT_MUTED,
            fontSize: '10px',
            fontFamily: FONT_MONO,
            minWidth: '42px',
            textAlign: 'right',
          },
        }, opts.pos),
        opts.icon ? h('span', { style: { fontSize: '14px', lineHeight: '1' } }, opts.icon) : null,
        h('div', { style: { flex: '1', minWidth: '0' } }, [
          h('div', {
            style: {
              fontSize: '12px',
              color: opts.selected ? TEXT_PRIMARY : TEXT_SECONDARY,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            },
          }, opts.label),
          opts.sublabel
            ? h('div', { style: { fontSize: '10px', color: TEXT_MUTED, marginTop: '1px' } }, opts.sublabel)
            : null,
        ]),
        opts.kindBadge ? badge(opts.kindBadge.text, opts.kindBadge.color) : null,
      ]);
    };

    // Buildings
    if (this.activeTab === 'buildings' && this.layout.buildings) {
      items.push(sectionHeader('Buildings', this.layout.buildings.length));
      for (const b of this.layout.buildings) {
        const sel = this.selection?.kind === 'building' && this.selection.id === b.id;
        const stationCount = this.layout.indoorStations.filter(s => s.locationId === b.id).length;
        items.push(itemRow({
          selected: sel,
          pos: `${b.x},${b.y}`,
          label: b.type,
          sublabel: `${b.name !== b.type ? b.name + ' \u2014 ' : ''}${b.w}\u00D7${b.h}${stationCount > 0 ? ` \u2022 ${stationCount} stations` : ''}`,
          icon: '\u{1F3E0}',
          onClick: () => {
            this.selection = { kind: 'building', id: b.id };
            this._syncCanvas();
            this._updateFloater();
            this._render();
          },
        }));
      }
    }

    // Trees
    if (this.activeTab === 'trees') {
      items.push(sectionHeader('Trees', this.layout.trees.length));
      this.layout.trees.forEach((t, i) => {
        const id = `tree_${i}`;
        const sel = this.selection?.kind === 'tree' && this.selection.id === id;
        items.push(itemRow({
          selected: sel,
          pos: `${t.x},${t.y}`,
          label: t.type,
          sublabel: t.flipX ? 'flipped' : undefined,
          icon: '\u{1F332}',
          onClick: () => {
            this.selection = { kind: 'tree', id };
            this._syncCanvas();
            this._updateFloater();
            this._render();
          },
        }));
      });
    }

    // Indoor — grouped by building
    if (this.activeTab === 'indoor') {
      const buildings = this.layout.buildings || [];
      const grouped: Record<string, (Station & { locationId: string })[]> = {};
      for (const st of this.layout.indoorStations) {
        if (!grouped[st.locationId]) grouped[st.locationId] = [];
        grouped[st.locationId].push(st);
      }

      let totalCount = this.layout.indoorStations.length;
      items.push(sectionHeader('Indoor Stations', totalCount));

      // Show stations grouped by building
      for (const b of buildings) {
        const stationsInBuilding = grouped[b.id] || [];
        if (stationsInBuilding.length === 0 && buildings.length > 1) continue;

        items.push(h('div', {
          style: {
            padding: '4px 14px 2px',
            fontSize: '10px',
            color: INFO,
            fontWeight: '500',
            background: BG_BASE,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          },
        }, [
          h('span', {}, '\u{1F3E0}'),
          h('span', {}, `${b.name || b.type} (${stationsInBuilding.length})`),
        ]));

        for (const st of stationsInBuilding) {
          const sel = this.selection?.kind === 'indoor' && this.selection.id === st.id;
          items.push(itemRow({
            selected: sel,
            pos: `+${st.dx},${st.dy}`,
            label: st.type,
            sublabel: st.label !== st.type ? st.label : undefined,
            kindBadge: { text: st.kind || 'work', color: st.kind === 'rest' ? SUCCESS : ACCENT },
            onClick: () => {
              this.selection = { kind: 'indoor', id: st.id };
              this._syncCanvas();
              this._updateFloater();
              this._render();
            },
          }));
        }
      }

      // Orphaned stations (locationId doesn't match any building)
      const orphaned = this.layout.indoorStations.filter(
        st => !buildings.find(b => b.id === st.locationId)
      );
      if (orphaned.length > 0) {
        items.push(h('div', {
          style: {
            padding: '4px 14px 2px',
            fontSize: '10px',
            color: DANGER,
            fontWeight: '500',
            background: DANGER_DIM,
          },
        }, `\u26A0 Orphaned (${orphaned.length}) \u2014 no matching building`));

        for (const st of orphaned) {
          const sel = this.selection?.kind === 'indoor' && this.selection.id === st.id;
          items.push(itemRow({
            selected: sel,
            pos: `+${st.dx},${st.dy}`,
            label: st.type,
            sublabel: `locationId: ${st.locationId || '(empty)'}`,
            kindBadge: { text: 'orphan', color: DANGER },
            onClick: () => {
              this.selection = { kind: 'indoor', id: st.id };
              this._syncCanvas();
              this._updateFloater();
              this._render();
            },
          }));
        }
      }
    }

    // Outdoor
    if (this.activeTab === 'outdoor') {
      items.push(sectionHeader('Outdoor Stations', this.layout.outdoorStations.length));
      for (const st of this.layout.outdoorStations) {
        const sel = this.selection?.kind === 'outdoor' && this.selection.id === st.id;
        const icon = OUTDOOR_ICONS[st.type] || OUTDOOR_ICONS['outdoor.' + st.activity] || '';
        items.push(itemRow({
          selected: sel,
          pos: `${st.x ?? '?'},${st.y ?? '?'}`,
          label: st.activity || st.type,
          sublabel: st.label !== st.type ? st.label : undefined,
          icon,
          kindBadge: { text: st.kind || 'rest', color: st.kind === 'work' ? ACCENT : SUCCESS },
          onClick: () => {
            this.selection = { kind: 'outdoor', id: st.id };
            this._syncCanvas();
            this._updateFloater();
            this._render();
          },
        }));
      }
    }

    if (items.length === 0) {
      items.push(h('div', {
        style: {
          padding: '24px 14px',
          color: TEXT_MUTED,
          fontSize: '12px',
          textAlign: 'center',
        },
      }, 'No items in this category'));
    }

    return h('div', {
      style: { overflowY: 'auto', flexGrow: '1' },
    }, items);
  }

  // ─── Thumbnail ───

  private _makeThumbnail(kind: string, type: string, size: number): HTMLElement {
    if (kind === 'outdoor') {
      const icon = OUTDOOR_ICONS[type] || '?';
      return h('div', {
        style: {
          width: `${size}px`,
          height: `${size}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${Math.floor(size * 0.55)}px`,
          lineHeight: '1',
          background: BG_CARD,
          borderRadius: RADIUS_SM,
          border: `1px solid ${BORDER}`,
        },
      }, icon);
    }

    const spriteKey = resolveSpriteKey(kind, type);
    if (!spriteKey) {
      return h('div', {
        style: {
          width: `${size}px`,
          height: `${size}px`,
          background: BG_CARD,
          borderRadius: RADIUS_SM,
          border: `1px solid ${BORDER}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '9px',
          color: TEXT_MUTED,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      }, type.slice(0, 6));
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.style.imageRendering = 'pixelated';
    canvas.style.borderRadius = RADIUS_SM;
    canvas.style.border = `1px solid ${BORDER}`;

    const spriteStore = this.worldMap.spriteStore ?? this.worldMap._spriteStore;
    if (spriteStore) {
      const sprite = spriteStore.getSprite?.(spriteKey);
      if (sprite) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          ctx.fillStyle = BG_CARD;
          ctx.fillRect(0, 0, size, size);
          const aspect = sprite.sw / sprite.sh;
          let dw = size - 4;
          let dh = size - 4;
          if (aspect > 1) {
            dh = (size - 4) / aspect;
          } else {
            dw = (size - 4) * aspect;
          }
          const dx = (size - dw) / 2;
          const dy = (size - dh) / 2;
          ctx.drawImage(sprite.image, sprite.sx, sprite.sy, sprite.sw, sprite.sh, dx, dy, dw, dh);
        }
      } else {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = BG_CARD;
          ctx.fillRect(0, 0, size, size);
          ctx.fillStyle = TEXT_MUTED;
          ctx.font = `9px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(type.slice(0, 8), size / 2, size / 2);
        }
      }
    } else {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = BG_CARD;
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = TEXT_MUTED;
        ctx.font = `9px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(type.slice(0, 8), size / 2, size / 2);
      }
    }

    return canvas;
  }

  // ─── Destroy ───

  destroy(): void {
    if (this.toggleBtn.parentNode) this.toggleBtn.parentNode.removeChild(this.toggleBtn);
    if (this.panel.parentNode) this.panel.parentNode.removeChild(this.panel);
    if (this.floater.parentNode) this.floater.parentNode.removeChild(this.floater);

    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('touchmove', this._onTouchMove);
    document.removeEventListener('touchend', this._onTouchEnd);

    this.layout = null;
    this.originalLayout = null;
    this.selection = null;
    this.pendingAdd = null;
    this.drag = null;
    this.undoStack = [];
    this.redoStack = [];
  }
}
