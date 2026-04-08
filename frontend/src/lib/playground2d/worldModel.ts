import type { Tile, TileType, World, WorldLayout, Location } from './types';
import { WORLD_WIDTH, WORLD_HEIGHT, DEFAULT_TILE_TYPE } from './types';
import { LOCATION_DEFS, OUTDOOR_STATIONS, SUB_LOCATIONS } from './locationDefs';

export function createVillageGrid(width = WORLD_WIDTH, height = WORLD_HEIGHT): Tile[][] {
  /* ---- main crossroads at center ---- */
  const MAIN_X = 30;
  const MAIN_Y = 30;

  /* ---- secondary N-S roads at x=10 and x=50 ---- */
  /* ---- secondary E-W roads at y=12 and y=48 ---- */

  /* connectors from secondary roads to main roads */
  const CONNECTORS = [
    /* NW district: x=10 N-S stub, connect y=12 E-W to main */
    { x1: 10, x2: 10, y1: 4,  y2: 12 },   /* x=10 north stub */
    { x1: 10, x2: 10, y1: 12, y2: 30 },   /* x=10 south to main */
    { x1: 10, x2: 30, y1: 12, y2: 12 },   /* y=12 east connector to main */

    /* NE district: x=50 N-S stub, connect y=12 E-W to main */
    { x1: 50, x2: 50, y1: 4,  y2: 12 },   /* x=50 north stub */
    { x1: 50, x2: 50, y1: 12, y2: 30 },   /* x=50 south to main */
    { x1: 30, x2: 50, y1: 12, y2: 12 },   /* y=12 west connector to main */

    /* SW district: x=10 south stub, connect y=48 E-W to main */
    { x1: 10, x2: 10, y1: 30, y2: 48 },   /* x=10 south from main */
    { x1: 10, x2: 10, y1: 48, y2: 56 },   /* x=10 far south */
    { x1: 10, x2: 30, y1: 48, y2: 48 },   /* y=48 east connector to main */

    /* SE district: x=50 south stub, connect y=48 E-W to main */
    { x1: 50, x2: 50, y1: 30, y2: 48 },   /* x=50 south from main */
    { x1: 50, x2: 50, y1: 48, y2: 56 },   /* x=50 far south */
    { x1: 30, x2: 50, y1: 48, y2: 48 },   /* y=48 west connector to main */
  ];

  /* central plaza: stone tiles 28-32, 28-32 */
  const PLAZA = { x1: 28, x2: 32, y1: 28, y2: 32 };

  /* pond in SE area, center ~(50,15), radius ~3 */
  const pondCX = 50;
  const pondCY = 15;

  /* stream/canal in NW area, center ~(10,45) */
  const streamCX = 10;
  const streamCY = 45;

  function inRect(x: number, y: number, r: { x1: number; x2: number; y1: number; y2: number }) {
    return x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2;
  }

  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      /* ---- pond in SE ---- */
      const pdx = x - pondCX;
      const pdy = y - pondCY;
      const pondSq = pdx * pdx + pdy * pdy * 1.5;
      if (pondSq <= 9)  return { x, y, type: 'water' as TileType };
      if (pondSq <= 16) return { x, y, type: 'sand' as TileType };

      /* ---- stream in NW ---- */
      const sdx = x - streamCX;
      const sdy = y - streamCY;
      const streamSq = sdx * sdx + sdy * sdy * 1.5;
      if (streamSq <= 6)  return { x, y, type: 'water' as TileType };
      if (streamSq <= 12) return { x, y, type: 'dirt' as TileType };

      /* ---- central plaza ---- */
      if (inRect(x, y, PLAZA)) return { x, y, type: 'stone' as TileType };

      /* ---- main N-S road ---- */
      if (x === MAIN_X && y >= 2 && y <= 57) return { x, y, type: 'path' as TileType };
      /* ---- main E-W road ---- */
      if (y === MAIN_Y && x >= 2 && x <= 57) return { x, y, type: 'path' as TileType };

      /* ---- connectors / secondary roads ---- */
      for (const c of CONNECTORS) {
        if (inRect(x, y, c)) return { x, y, type: 'path' as TileType };
      }

      return { x, y, type: DEFAULT_TILE_TYPE as TileType };
    })
  );
}

export function createWorldModel(layout: WorldLayout | null = null): World {
  const stationsByLocation: Record<string, any[]> = {};
  if (layout && Array.isArray(layout.indoorStations)) {
    for (const s of layout.indoorStations) {
      if (!stationsByLocation[s.locationId]) stationsByLocation[s.locationId] = [];
      const st: any = { id: s.id, kind: s.kind, type: s.type, dx: s.dx, dy: s.dy, label: s.label || '' };
      if (s.flipX) st.flipX = true;
      if (s.flipY) st.flipY = true;
      stationsByLocation[s.locationId].push(st);
    }
  }

  const outdoorStations = layout && Array.isArray(layout.outdoorStations)
    ? layout.outdoorStations.slice()
    : OUTDOOR_STATIONS.slice();

  const trees = layout && Array.isArray(layout.trees) ? layout.trees.slice() : [];

  const defsById = Object.fromEntries(LOCATION_DEFS.map(l => [l.id, l]));
  const buildingSource = layout && Array.isArray(layout.buildings)
    ? layout.buildings
    : LOCATION_DEFS;

  return {
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    defaultTile: DEFAULT_TILE_TYPE,
    tiles: createVillageGrid(),
    locations: buildingSource.map(loc => {
      const def = defsById[loc.id] || null;
      return {
        id: loc.id,
        name: loc.name,
        type: loc.type,
        x: loc.x,
        y: loc.y,
        w: loc.w,
        h: loc.h,
        subLocations: SUB_LOCATIONS[loc.id] || [],
        stations: layout
          ? (stationsByLocation[loc.id] || [])
          : (def && Array.isArray(def.stations) ? def.stations : []),
        zones: def && Array.isArray(def.zones) ? def.zones : [],
        interiorWalls: def && Array.isArray(def.interiorWalls) ? def.interiorWalls : []
      };
    }),
    outdoorStations,
    trees
  };
}
