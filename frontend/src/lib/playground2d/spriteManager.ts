import type { SpriteDefinition, SpriteFrame, SpriteCandidate } from './types';
import { DEFAULT_ASSET_ROOT } from './types';
import { FURNITURE_SPRITES } from './furnitureCatalog';

// Tileset paths
const FIELD_B_TILESET = 'Cute RPG World (RPG Maker)/Cute RPG World - RPG Maker MZ/tilesets/CuteRPG_Field_B.png';
const FIELD_B_GRID = { mode: 'grid' as const, columns: 16, rows: 16 };
const FOREST_B_TILESET = 'Cute RPG World (RPG Maker)/Cute RPG World - RPG Maker MZ/tilesets/CuteRPG_Forest_B.png';
const FOREST_B_GRID = { mode: 'grid' as const, columns: 16, rows: 16 };
const FIELD_C_TILESET = 'Cute RPG World (RPG Maker)/Cute RPG World - RPG Maker MZ/tilesets/CuteRPG_Field_C.png';
const FIELD_C_GRID = { mode: 'grid' as const, columns: 16, rows: 16 };
const INTERIOR_B_TILESET = 'Cute RPG World (RPG Maker)/Cute RPG World - RPG Maker MZ/tilesets/CuteRPG_Interior_B.png';
const INTERIOR_B_GRID = { mode: 'grid' as const, columns: 16, rows: 16 };

// Character sheets: 53 sheets, each has 4 skin-tone variants
export const CHARACTER_SHEETS = Array.from({ length: 53 }, (_, i) => {
  const n = String(i + 1).padStart(3, '0');
  return `Cute RPG World (RPG Maker)/Cute RPG World - RPG Maker MZ/characters/!Character_RM_${n}.png`;
});
const CHARACTER_SHEET = CHARACTER_SHEETS[0];
const CHARACTER_GRID = { mode: 'grid' as const, columns: 12, rows: 8 };
export const CHARACTERS_PER_SHEET = 4;
export const TOTAL_CHARACTERS = CHARACTER_SHEETS.length * CHARACTERS_PER_SHEET;

// Tile type to sprite key mapping
export const TILE_TYPE_TO_SPRITE: Record<string, string[]> = {
  grass: ['terrain.grassA', 'terrain.grassB'],
  dirt: ['terrain.dirt'],
  path: ['terrain.path'],
  sand: ['terrain.sand'],
  stone: ['terrain.stone'],
  water: ['terrain.water'],
};

// ALL default sprite definitions (terrain, trees, buildings, furniture, avatars)
export const DEFAULT_SPRITE_DEFINITIONS: SpriteDefinition[] = [
  // Terrain
  { key: 'terrain.grassA', candidates: [{ url: FIELD_B_TILESET, frame: { ...FIELD_B_GRID, column: 1, row: 2 } }] },
  { key: 'terrain.grassB', candidates: [{ url: FIELD_B_TILESET, frame: { ...FIELD_B_GRID, column: 3, row: 2 } }] },
  { key: 'terrain.dirt', candidates: [{ url: FOREST_B_TILESET, frame: { ...FOREST_B_GRID, column: 1, row: 6 } }] },
  { key: 'terrain.path', candidates: [] }, // use procedural fallback (COLORS.path) — Field_B autotile pieces have transparency
  { key: 'terrain.sand', candidates: [{ url: FIELD_B_TILESET, frame: { ...FIELD_B_GRID, column: 1, row: 4 } }] },
  { key: 'terrain.stone', candidates: [{ url: FIELD_C_TILESET, frame: { ...FIELD_C_GRID, column: 1, row: 2 } }] },
  { key: 'terrain.water', candidates: [] },
  // Trees
  { key: 'prop.tree', candidates: [{ url: FIELD_B_TILESET, frame: { sx: 576, sy: 576, sw: 48, sh: 96 } }] },
  { key: 'prop.tree.alt', candidates: [{ url: FIELD_B_TILESET, frame: { sx: 624, sy: 576, sw: 48, sh: 96 } }] },
  { key: 'prop.tree.alt2', candidates: [{ url: FIELD_B_TILESET, frame: { sx: 672, sy: 576, sw: 48, sh: 96 } }] },
  { key: 'prop.tree.alt3', candidates: [{ url: FIELD_B_TILESET, frame: { sx: 720, sy: 576, sw: 48, sh: 96 } }] },
  { key: 'prop.tree.conifer', candidates: [{ url: FIELD_B_TILESET, frame: { sx: 528, sy: 576, sw: 48, sh: 96 } }] },
  { key: 'prop.tree.big', candidates: [{ url: FIELD_B_TILESET, frame: { sx: 240, sy: 384, sw: 96, sh: 96 } }] },
  { key: 'prop.tree.big.alt', candidates: [{ url: FIELD_B_TILESET, frame: { sx: 240, sy: 576, sw: 96, sh: 96 } }] },
  { key: 'prop.rock', candidates: [{ url: FOREST_B_TILESET, frame: { ...FOREST_B_GRID, column: 9, row: 3 } }] },
  { key: 'prop.rock.small', candidates: [{ url: FOREST_B_TILESET, frame: { ...FOREST_B_GRID, column: 7, row: 2 } }] },
  // Flowers
  { key: 'deco.flower.pink', candidates: [{ url: FOREST_B_TILESET, frame: { ...FOREST_B_GRID, column: 5, row: 4 } }] },
  { key: 'deco.flower.purple', candidates: [{ url: FOREST_B_TILESET, frame: { ...FOREST_B_GRID, column: 6, row: 5 } }] },
  { key: 'deco.flower.mixed', candidates: [{ url: FIELD_C_TILESET, frame: { ...FIELD_C_GRID, column: 2, row: 9 } }] },
  { key: 'deco.flower.red', candidates: [{ url: FIELD_B_TILESET, frame: { ...FIELD_B_GRID, column: 10, row: 5 } }] },
  // Buildings
  { key: 'building.house', candidates: [{ url: 'Cute RPG World (RPG Maker)/Cute RPG World - RPG Maker MZ/tilesets/CuteRPG_Houses_RPGMaker_C1.png', frame: { sx: 3, sy: 24, sw: 186, sh: 216 } }] },
  { key: 'building.house2', candidates: [{ url: 'Cute RPG World (RPG Maker)/Cute RPG World - RPG Maker MZ/tilesets/CuteRPG_Houses_RPGMaker_C1.png', frame: { sx: 195, sy: 24, sw: 186, sh: 216 } }] },
  { key: 'building.house.green', candidates: [{ url: 'Cute RPG World (RPG Maker)/Cute RPG World - RPG Maker MZ/tilesets/CuteRPG_Houses_RPGMaker_C2.png', frame: { sx: 3, sy: 24, sw: 186, sh: 216 } }] },
  { key: 'building.house.green2', candidates: [{ url: 'Cute RPG World (RPG Maker)/Cute RPG World - RPG Maker MZ/tilesets/CuteRPG_Houses_RPGMaker_C2.png', frame: { sx: 195, sy: 24, sw: 186, sh: 216 } }] },
  { key: 'building.house.gray', candidates: [{ url: 'Cute RPG World (RPG Maker)/Cute RPG World - RPG Maker MZ/tilesets/CuteRPG_Houses_RPGMaker_C3.png', frame: { sx: 3, sy: 24, sw: 186, sh: 216 } }] },
  { key: 'building.tower', candidates: [{ url: 'Cute RPG World (RPG Maker)/Cute RPG World - RPG Maker MZ/tilesets/CuteRPG_Houses_RPGMaker_C3.png', frame: { sx: 387, sy: 24, sw: 186, sh: 216 } }] },
  { key: 'building.large', candidates: [{ url: 'Cute RPG World (RPG Maker)/Cute RPG World - RPG Maker MZ/tilesets/CuteRPG_Houses_RPGMaker_C1.png', frame: { sx: 3, sy: 552, sw: 237, sh: 216 } }] },
  { key: 'building.shop', candidates: [{ url: 'Cute RPG World (RPG Maker)/Cute RPG World - RPG Maker MZ/tilesets/CuteRPG_Houses_RPGMaker_C1.png', frame: { sx: 579, sy: 24, sw: 186, sh: 216 } }] },
  // Furniture (from catalog)
  ...FURNITURE_SPRITES.map(def => ({ key: def.key, candidates: [{ url: def.url, frame: def.frame }] as SpriteCandidate[] })),
  // Avatar sprites (default character sheet)
  { key: 'avatar.idle.down', candidates: [{ url: CHARACTER_SHEET, frame: { ...CHARACTER_GRID, column: 1, row: 0 } }] },
  { key: 'avatar.walk.down.0', candidates: [{ url: CHARACTER_SHEET, frame: { ...CHARACTER_GRID, column: 0, row: 0 } }] },
  { key: 'avatar.walk.down.1', candidates: [{ url: CHARACTER_SHEET, frame: { ...CHARACTER_GRID, column: 2, row: 0 } }] },
  { key: 'avatar.idle.left', candidates: [{ url: CHARACTER_SHEET, frame: { ...CHARACTER_GRID, column: 1, row: 1 } }] },
  { key: 'avatar.walk.left.0', candidates: [{ url: CHARACTER_SHEET, frame: { ...CHARACTER_GRID, column: 0, row: 1 } }] },
  { key: 'avatar.walk.left.1', candidates: [{ url: CHARACTER_SHEET, frame: { ...CHARACTER_GRID, column: 2, row: 1 } }] },
  { key: 'avatar.idle.right', candidates: [{ url: CHARACTER_SHEET, frame: { ...CHARACTER_GRID, column: 1, row: 2 } }] },
  { key: 'avatar.walk.right.0', candidates: [{ url: CHARACTER_SHEET, frame: { ...CHARACTER_GRID, column: 0, row: 2 } }] },
  { key: 'avatar.walk.right.1', candidates: [{ url: CHARACTER_SHEET, frame: { ...CHARACTER_GRID, column: 2, row: 2 } }] },
  { key: 'avatar.idle.up', candidates: [{ url: CHARACTER_SHEET, frame: { ...CHARACTER_GRID, column: 1, row: 3 } }] },
  { key: 'avatar.walk.up.0', candidates: [{ url: CHARACTER_SHEET, frame: { ...CHARACTER_GRID, column: 0, row: 3 } }] },
  { key: 'avatar.walk.up.1', candidates: [{ url: CHARACTER_SHEET, frame: { ...CHARACTER_GRID, column: 2, row: 3 } }] },
];

// Helper functions
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveUrl(basePath: string, filePath: string): string | null {
  if (!filePath) return null;
  if (/^https?:\/\//i.test(filePath) || filePath.startsWith('/')) return filePath;
  return `${basePath.replace(/\/+$/, '')}/${filePath.replace(/^\/+/, '')}`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Image load failed: ${url}`));
    image.src = encodeURI(url);
  });
}

interface ResolvedFrame {
  sx: number; sy: number; sw: number; sh: number;
}

function resolveFrame(image: HTMLImageElement, frame: any): ResolvedFrame {
  if (!frame) return { sx: 0, sy: 0, sw: image.width, sh: image.height };
  if (frame.mode === 'grid') {
    const columns = clamp(Math.floor(frame.columns || 1), 1, 256);
    const rows = clamp(Math.floor(frame.rows || 1), 1, 256);
    const column = clamp(Math.floor(frame.column || 0), 0, columns - 1);
    const row = clamp(Math.floor(frame.row || 0), 0, rows - 1);
    const sw = Math.max(1, Math.floor(image.width / columns));
    const sh = Math.max(1, Math.floor(image.height / rows));
    return { sx: column * sw, sy: row * sh, sw, sh };
  }
  return {
    sx: clamp(Math.floor(frame.sx || 0), 0, image.width - 1),
    sy: clamp(Math.floor(frame.sy || 0), 0, image.height - 1),
    sw: clamp(Math.floor(frame.sw || image.width), 1, image.width),
    sh: clamp(Math.floor(frame.sh || image.height), 1, image.height),
  };
}

export interface LoadedSprite {
  image: HTMLImageElement;
  sx: number; sy: number; sw: number; sh: number;
}

export class SpriteStore {
  private assetRoot: string;
  private sprites = new Map<string, LoadedSprite>();
  public characterSheetImages: HTMLImageElement[] = [];
  public loaded = false;
  public summary = { loadedCount: 0, missingKeys: [] as string[] };

  constructor(assetRoot = DEFAULT_ASSET_ROOT) {
    this.assetRoot = assetRoot;
  }

  getSprite(key: string): LoadedSprite | null {
    return this.sprites.get(key) || null;
  }

  async load(onProgress?: (loaded: number, total: number) => void): Promise<typeof this.summary> {
    const definitions = [...DEFAULT_SPRITE_DEFINITIONS];
    const total = definitions.length + CHARACTER_SHEETS.length;
    let loaded = 0;
    const missingKeys: string[] = [];

    for (const def of definitions) {
      const sprite = await this.loadDefinition(def);
      if (!sprite) { missingKeys.push(def.key); }
      else { this.sprites.set(def.key, sprite); }
      loaded++;
      onProgress?.(loaded, total);
    }

    for (const sheetPath of CHARACTER_SHEETS) {
      const url = resolveUrl(this.assetRoot, sheetPath);
      if (url) {
        try {
          const img = await loadImage(url);
          this.characterSheetImages.push(img);
        } catch { /* skip */ }
      }
      loaded++;
      onProgress?.(loaded, total);
    }

    this.loaded = true;
    this.summary = { loadedCount: this.sprites.size, missingKeys };
    return this.summary;
  }

  private async loadDefinition(definition: SpriteDefinition): Promise<LoadedSprite | null> {
    const candidates = definition.candidates || [];
    for (const candidate of candidates) {
      const url = resolveUrl(this.assetRoot, candidate.url);
      if (!url) continue;
      try {
        const image = await loadImage(url);
        const frame = resolveFrame(image, candidate.frame);
        return { image, ...frame };
      } catch { continue; }
    }
    return null;
  }
}

// Sprite key inference functions
export function inferBuildingSpriteKey(type: string): string {
  if (type.includes('tower') || type.includes('castle')) return 'building.tower';
  if (type === 'house2') return 'building.house2';
  if (type === 'house.green') return 'building.house.green';
  if (type === 'house.green2') return 'building.house.green2';
  if (type === 'house.gray') return 'building.house.gray';
  if (type === 'large') return 'building.large';
  if (type === 'shop') return 'building.shop';
  return 'building.house';
}

export function inferPropSpriteKey(type: string): string {
  if (type === 'rock.small') return 'prop.rock.small';
  if (type.includes('rock') || type.includes('stone')) return 'prop.rock';
  if (type === 'tree.big') return 'prop.tree.big';
  if (type === 'tree.big.alt') return 'prop.tree.big.alt';
  if (type === 'tree.alt') return 'prop.tree.alt';
  if (type === 'tree.alt2') return 'prop.tree.alt2';
  if (type === 'tree.alt3') return 'prop.tree.alt3';
  if (type === 'tree.conifer') return 'prop.tree.conifer';
  return 'prop.tree';
}

export function inferDecoSpriteKey(type: string): string {
  if (type === 'flower.purple') return 'deco.flower.purple';
  if (type === 'flower.mixed') return 'deco.flower.mixed';
  if (type === 'flower.red') return 'deco.flower.red';
  return 'deco.flower.pink';
}

export function chooseTerrainSpriteKey(tileType: string, x: number, y: number): string {
  const candidates = TILE_TYPE_TO_SPRITE[tileType] || TILE_TYPE_TO_SPRITE.grass;
  if (!candidates || candidates.length === 0) return 'terrain.grassA';
  if (candidates.length === 1) return candidates[0];
  return candidates[(x + y) % candidates.length];
}
