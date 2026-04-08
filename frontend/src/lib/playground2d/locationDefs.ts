import type { Location, Station } from './types';
import { FLOOR_COLORS } from './types';

const F = FLOOR_COLORS;

export const LOCATION_DEFS: Location[] = [
  /* ========== Northwest District (Government / Creative) ========== */
  {
    id: 'home_nw', name: 'Architect Studio', type: 'house', x: 4, y: 4, w: 5, h: 6,
    subLocations: ['workbench', 'drafting_table', 'lounge'],
    zones: [
      { x1: 0, y1: 0, x2: 5, y2: 2, floor: F.CARPET },
      { x1: 0, y1: 2, x2: 5, y2: 6, floor: F.SOFT }
    ],
    interiorWalls: [
      { x1: 0, y1: 2, x2: 2, y2: 2 },
      { x1: 3, y1: 2, x2: 5, y2: 2 }
    ],
    stations: [
      { id: 'nw_w1', kind: 'work', type: 'bookshelf', dx: 1, dy: 0, label: 'refs' },
      { id: 'nw_w2', kind: 'work', type: 'bookshelf.full', dx: 2, dy: 0, label: 'archive' },
      { id: 'nw_plant', kind: 'rest', type: 'plant.purple', dx: 3, dy: 0, label: 'studio plant' },
      { id: 'nw_chair', kind: 'work', type: 'chair', dx: 1, dy: 1, label: 'design chair' },
      { id: 'nw_desk', kind: 'work', type: 'table.mid', dx: 2, dy: 1, label: 'drafting desk' },
      { id: 'nw_bed', kind: 'rest', type: 'bed.wide.pink', dx: 1, dy: 2, label: 'bed' },
      { id: 'nw_wardrobe', kind: 'rest', type: 'cabinet.wood.alt', dx: 3, dy: 2, label: 'wardrobe' },
      { id: 'nw_dresser', kind: 'rest', type: 'dresser', dx: 1, dy: 3, label: 'dresser' },
      { id: 'nw_nightstand', kind: 'rest', type: 'nightstand', dx: 2, dy: 3, label: 'nightstand' },
      { id: 'nw_sofa', kind: 'rest', type: 'sofa', dx: 3, dy: 3, label: 'reading sofa' },
      { id: 'nw_table', kind: 'rest', type: 'table.tiny', dx: 2, dy: 4, label: 'side table' },
      { id: 'nw_chair2', kind: 'rest', type: 'chair.alt', dx: 3, dy: 4, label: 'accent chair' }
    ]
  },
  {
    id: 'office', name: 'CEO Office', type: 'tower', x: 12, y: 4, w: 4, h: 4,
    subLocations: ['desk', 'meeting_room', 'lobby'],
    zones: [{ x1: 0, y1: 0, x2: 4, y2: 4, floor: F.RED }],
    interiorWalls: [],
    stations: [
      { id: 'ceo_w1', kind: 'work', type: 'bookshelf.full', dx: 1, dy: 0, label: 'private library' },
      { id: 'ceo_safe', kind: 'work', type: 'safe', dx: 2, dy: 0, label: 'CEO safe' },
      { id: 'ceo_desk', kind: 'work', type: 'table.mid', dx: 1, dy: 1, label: 'CEO desk' },
      { id: 'ceo_chair', kind: 'work', type: 'chair', dx: 2, dy: 1, label: 'CEO chair' },
      { id: 'ceo_sofa', kind: 'rest', type: 'sofa', dx: 1, dy: 2, label: 'guest sofa' },
      { id: 'ceo_table', kind: 'rest', type: 'table.tiny', dx: 2, dy: 2, label: 'coffee table' }
    ]
  },
  {
    id: 'town_hall', name: 'Town Hall', type: 'large', x: 4, y: 14, w: 8, h: 6,
    subLocations: ['council_chamber', 'records_office', 'lobby'],
    zones: [
      { x1: 0, y1: 0, x2: 8, y2: 3, floor: F.TILE },
      { x1: 0, y1: 3, x2: 8, y2: 6, floor: F.CARPET }
    ],
    interiorWalls: [
      { x1: 0, y1: 3, x2: 3, y2: 3 },
      { x1: 4, y1: 3, x2: 8, y2: 3 }
    ],
    stations: [
      { id: 'th_podium', kind: 'work', type: 'counter', dx: 3, dy: 0, label: 'podium' },
      { id: 'th_desk1', kind: 'work', type: 'table.mid', dx: 1, dy: 0, label: 'clerk desk' },
      { id: 'th_chair1', kind: 'work', type: 'chair', dx: 2, dy: 0, label: 'clerk chair' },
      { id: 'th_records', kind: 'work', type: 'cabinet.books', dx: 5, dy: 0, label: 'records' },
      { id: 'th_safe', kind: 'work', type: 'safe', dx: 6, dy: 0, label: 'town vault' },
      { id: 'th_bench1', kind: 'rest', type: 'sofa', dx: 1, dy: 1, label: 'council bench L' },
      { id: 'th_bench2', kind: 'rest', type: 'sofa.alt', dx: 5, dy: 1, label: 'council bench R' },
      { id: 'th_table', kind: 'work', type: 'table', dx: 3, dy: 1, label: 'council table' },
      { id: 'th_flag', kind: 'rest', type: 'plant.purple', dx: 6, dy: 1, label: 'banner' },
      { id: 'th_shelf', kind: 'work', type: 'bookshelf', dx: 1, dy: 3, label: 'law books' },
      { id: 'th_shelf2', kind: 'work', type: 'bookshelf.full', dx: 2, dy: 3, label: 'archives' },
      { id: 'th_chair2', kind: 'rest', type: 'chair.alt', dx: 5, dy: 3, label: 'waiting chair' }
    ]
  },
  {
    id: 'art_gallery', name: 'Art Gallery', type: 'house.green', x: 20, y: 4, w: 5, h: 5,
    subLocations: ['main_hall', 'studio', 'gift_shop'],
    zones: [
      { x1: 0, y1: 0, x2: 5, y2: 2, floor: F.WOOD },
      { x1: 0, y1: 2, x2: 5, y2: 5, floor: F.TILE }
    ],
    interiorWalls: [
      { x1: 0, y1: 2, x2: 2, y2: 2 },
      { x1: 3, y1: 2, x2: 5, y2: 2 }
    ],
    stations: [
      { id: 'ag_display1', kind: 'work', type: 'display', dx: 1, dy: 0, label: 'exhibit A' },
      { id: 'ag_display2', kind: 'work', type: 'display.alt', dx: 2, dy: 0, label: 'exhibit B' },
      { id: 'ag_display3', kind: 'work', type: 'display', dx: 3, dy: 0, label: 'exhibit C' },
      { id: 'ag_easel', kind: 'work', type: 'table.mid', dx: 1, dy: 1, label: 'easel' },
      { id: 'ag_chair', kind: 'work', type: 'chair', dx: 2, dy: 1, label: 'artist stool' },
      { id: 'ag_plant', kind: 'rest', type: 'plant.pink', dx: 3, dy: 1, label: 'gallery fern' },
      { id: 'ag_case', kind: 'work', type: 'cabinet.glass', dx: 1, dy: 2, label: 'sculpture case' },
      { id: 'ag_bench', kind: 'rest', type: 'sofa', dx: 2, dy: 2, label: 'viewing bench' },
      { id: 'ag_counter', kind: 'work', type: 'counter', dx: 1, dy: 3, label: 'gift counter' },
      { id: 'ag_shelf', kind: 'work', type: 'bookshelf.scroll', dx: 3, dy: 3, label: 'print rack' }
    ]
  },
  {
    id: 'workshop', name: 'Workshop', type: 'house2', x: 20, y: 12, w: 6, h: 4,
    subLocations: ['forge', 'assembly', 'storage'],
    zones: [{ x1: 0, y1: 0, x2: 6, y2: 4, floor: F.CONCRETE }],
    interiorWalls: [],
    stations: [
      { id: 'ws_anvil', kind: 'work', type: 'counter', dx: 1, dy: 0, label: 'anvil' },
      { id: 'ws_stove', kind: 'work', type: 'stove', dx: 2, dy: 0, label: 'furnace' },
      { id: 'ws_tools', kind: 'work', type: 'cabinet.wood', dx: 3, dy: 0, label: 'tool rack' },
      { id: 'ws_metal', kind: 'work', type: 'cabinet.metal', dx: 4, dy: 0, label: 'metal stock' },
      { id: 'ws_bench', kind: 'work', type: 'table.mid', dx: 1, dy: 1, label: 'work bench' },
      { id: 'ws_chair', kind: 'work', type: 'chair', dx: 2, dy: 1, label: 'stool' },
      { id: 'ws_vice', kind: 'work', type: 'cabinet.metal.alt', dx: 3, dy: 1, label: 'vice station' },
      { id: 'ws_crate', kind: 'work', type: 'cabinet.drawer', dx: 4, dy: 1, label: 'parts crate' },
      { id: 'ws_shelf', kind: 'work', type: 'bookshelf', dx: 1, dy: 2, label: 'manuals' },
      { id: 'ws_sofa', kind: 'rest', type: 'sofa', dx: 3, dy: 2, label: 'break bench' }
    ]
  },

  /* ========== Northeast District (Research / Tech) ========== */
  {
    id: 'home_ne', name: 'QA Lab', type: 'house2', x: 44, y: 4, w: 6, h: 4,
    subLocations: ['test_station', 'monitor_wall', 'break_area'],
    zones: [
      { x1: 0, y1: 0, x2: 4, y2: 4, floor: F.CONCRETE },
      { x1: 4, y1: 0, x2: 6, y2: 4, floor: F.TILE }
    ],
    interiorWalls: [
      { x1: 4, y1: 0, x2: 4, y2: 1 },
      { x1: 4, y1: 2, x2: 4, y2: 4 }
    ],
    stations: [
      { id: 'ne_mon1', kind: 'work', type: 'dresser.beer', dx: 1, dy: 0, label: 'monitor 1' },
      { id: 'ne_chair1', kind: 'work', type: 'chair', dx: 2, dy: 0, label: 'analyst 1' },
      { id: 'ne_mon2', kind: 'work', type: 'dresser.alt', dx: 3, dy: 0, label: 'monitor 2' },
      { id: 'ne_bench', kind: 'work', type: 'table.mid', dx: 1, dy: 1, label: 'prep bench' },
      { id: 'ne_chair2', kind: 'work', type: 'chair.alt', dx: 2, dy: 1, label: 'analyst 2' },
      { id: 'ne_safe', kind: 'work', type: 'safe', dx: 3, dy: 1, label: 'sample safe' },
      { id: 'ne_docs', kind: 'work', type: 'bookshelf.scroll', dx: 1, dy: 2, label: 'test docs' },
      { id: 'ne_display', kind: 'work', type: 'display', dx: 2, dy: 2, label: 'test display' },
      { id: 'ne_sofa', kind: 'rest', type: 'sofa', dx: 3, dy: 2, label: 'break seat' },
      { id: 'ne_rack', kind: 'work', type: 'cabinet.metal', dx: 4, dy: 0, label: 'rack A' },
      { id: 'ne_rack2', kind: 'work', type: 'cabinet.metal.alt', dx: 4, dy: 1, label: 'rack B' },
      { id: 'ne_case', kind: 'work', type: 'cabinet.glass', dx: 4, dy: 2, label: 'sample case' }
    ]
  },
  {
    id: 'research_lab', name: 'Research Lab', type: 'large', x: 36, y: 4, w: 8, h: 6,
    subLocations: ['main_lab', 'clean_room', 'data_room'],
    zones: [
      { x1: 0, y1: 0, x2: 4, y2: 6, floor: F.TILE },
      { x1: 4, y1: 0, x2: 8, y2: 6, floor: F.CONCRETE }
    ],
    interiorWalls: [
      { x1: 4, y1: 0, x2: 4, y2: 2 },
      { x1: 4, y1: 3, x2: 4, y2: 6 }
    ],
    stations: [
      { id: 'rl_micro', kind: 'work', type: 'display', dx: 1, dy: 0, label: 'microscope' },
      { id: 'rl_desk1', kind: 'work', type: 'table.mid', dx: 2, dy: 0, label: 'lab bench A' },
      { id: 'rl_chair1', kind: 'work', type: 'chair', dx: 3, dy: 0, label: 'researcher 1' },
      { id: 'rl_cab1', kind: 'work', type: 'cabinet.glass', dx: 1, dy: 1, label: 'specimen case' },
      { id: 'rl_stove', kind: 'work', type: 'stove', dx: 2, dy: 1, label: 'bunsen burner' },
      { id: 'rl_safe', kind: 'work', type: 'safe', dx: 3, dy: 1, label: 'reagent safe' },
      { id: 'rl_shelf', kind: 'work', type: 'bookshelf', dx: 1, dy: 3, label: 'journal shelf' },
      { id: 'rl_shelf2', kind: 'work', type: 'bookshelf.full', dx: 2, dy: 3, label: 'reference shelf' },
      { id: 'rl_desk2', kind: 'work', type: 'table.mid', dx: 5, dy: 0, label: 'lab bench B' },
      { id: 'rl_chair2', kind: 'work', type: 'chair.alt', dx: 6, dy: 0, label: 'researcher 2' },
      { id: 'rl_rack', kind: 'work', type: 'cabinet.metal', dx: 5, dy: 1, label: 'server rack' },
      { id: 'rl_sofa', kind: 'rest', type: 'sofa', dx: 5, dy: 3, label: 'break couch' }
    ]
  },
  {
    id: 'data_center', name: 'Data Center', type: 'tower', x: 52, y: 4, w: 4, h: 6,
    subLocations: ['server_room', 'ops_desk', 'cooling_unit'],
    zones: [{ x1: 0, y1: 0, x2: 4, y2: 6, floor: F.CONCRETE }],
    interiorWalls: [],
    stations: [
      { id: 'dc_rack1', kind: 'work', type: 'cabinet.metal', dx: 1, dy: 0, label: 'rack 1' },
      { id: 'dc_rack2', kind: 'work', type: 'cabinet.metal.alt', dx: 2, dy: 0, label: 'rack 2' },
      { id: 'dc_rack3', kind: 'work', type: 'cabinet.metal', dx: 1, dy: 1, label: 'rack 3' },
      { id: 'dc_rack4', kind: 'work', type: 'cabinet.metal.alt', dx: 2, dy: 1, label: 'rack 4' },
      { id: 'dc_desk', kind: 'work', type: 'table.mid', dx: 1, dy: 2, label: 'ops terminal' },
      { id: 'dc_chair', kind: 'work', type: 'chair', dx: 2, dy: 2, label: 'ops chair' },
      { id: 'dc_display', kind: 'work', type: 'display', dx: 1, dy: 3, label: 'status board' },
      { id: 'dc_safe', kind: 'work', type: 'safe', dx: 2, dy: 3, label: 'key safe' },
      { id: 'dc_stool', kind: 'rest', type: 'chair.alt', dx: 1, dy: 4, label: 'break stool' }
    ]
  },
  {
    id: 'training_center', name: 'Training Center', type: 'house', x: 44, y: 14, w: 5, h: 5,
    subLocations: ['classroom', 'sim_room', 'lobby'],
    zones: [
      { x1: 0, y1: 0, x2: 5, y2: 2, floor: F.CARPET },
      { x1: 0, y1: 2, x2: 5, y2: 5, floor: F.WOOD }
    ],
    interiorWalls: [
      { x1: 0, y1: 2, x2: 2, y2: 2 },
      { x1: 3, y1: 2, x2: 5, y2: 2 }
    ],
    stations: [
      { id: 'tc_board', kind: 'work', type: 'display', dx: 2, dy: 0, label: 'whiteboard' },
      { id: 'tc_desk1', kind: 'work', type: 'table.mid', dx: 1, dy: 0, label: 'instructor desk' },
      { id: 'tc_chair1', kind: 'work', type: 'chair', dx: 3, dy: 0, label: 'instructor seat' },
      { id: 'tc_desk2', kind: 'work', type: 'table.mid', dx: 1, dy: 1, label: 'student desk 1' },
      { id: 'tc_desk3', kind: 'work', type: 'table.mid', dx: 3, dy: 1, label: 'student desk 2' },
      { id: 'tc_shelf', kind: 'work', type: 'bookshelf', dx: 1, dy: 2, label: 'course material' },
      { id: 'tc_shelf2', kind: 'work', type: 'bookshelf.full', dx: 2, dy: 2, label: 'training manuals' },
      { id: 'tc_sim', kind: 'work', type: 'display.alt', dx: 1, dy: 3, label: 'simulator' },
      { id: 'tc_chair2', kind: 'rest', type: 'chair.alt', dx: 2, dy: 3, label: 'student chair' },
      { id: 'tc_sofa', kind: 'rest', type: 'sofa', dx: 3, dy: 3, label: 'lobby couch' }
    ]
  },

  /* ========== Southwest District (Operations / Living) ========== */
  {
    id: 'home_sw', name: 'Security HQ', type: 'house.green', x: 4, y: 40, w: 5, h: 6,
    subLocations: ['console', 'server_rack', 'meeting_corner'],
    zones: [
      { x1: 0, y1: 0, x2: 5, y2: 3, floor: F.CONCRETE },
      { x1: 0, y1: 3, x2: 5, y2: 6, floor: F.SOFT }
    ],
    interiorWalls: [
      { x1: 0, y1: 3, x2: 2, y2: 3 },
      { x1: 3, y1: 3, x2: 5, y2: 3 }
    ],
    stations: [
      { id: 'sw_w1', kind: 'work', type: 'cabinet.metal', dx: 1, dy: 0, label: 'evidence' },
      { id: 'sw_w2', kind: 'work', type: 'cabinet.metal.alt', dx: 2, dy: 0, label: 'armory' },
      { id: 'sw_w3', kind: 'work', type: 'cabinet.wood.alt', dx: 3, dy: 0, label: 'gear locker' },
      { id: 'sw_mon1', kind: 'work', type: 'display', dx: 1, dy: 1, label: 'monitor 1' },
      { id: 'sw_mon2', kind: 'work', type: 'display.alt', dx: 2, dy: 1, label: 'monitor 2' },
      { id: 'sw_safe', kind: 'work', type: 'safe', dx: 3, dy: 1, label: 'safe' },
      { id: 'sw_console', kind: 'work', type: 'table.mid', dx: 1, dy: 2, label: 'console' },
      { id: 'sw_chair', kind: 'work', type: 'chair', dx: 2, dy: 2, label: 'operator' },
      { id: 'sw_records', kind: 'work', type: 'cabinet.books', dx: 3, dy: 2, label: 'records' },
      { id: 'sw_nightst', kind: 'rest', type: 'nightstand', dx: 1, dy: 3, label: 'nightstand' },
      { id: 'sw_bunk', kind: 'rest', type: 'bed.wide.blue', dx: 2, dy: 3, label: 'on-call bunk' },
      { id: 'sw_dresser', kind: 'rest', type: 'dresser', dx: 1, dy: 4, label: 'dresser' },
      { id: 'sw_chair2', kind: 'rest', type: 'chair.alt', dx: 2, dy: 4, label: 'duty chair' },
      { id: 'sw_table', kind: 'rest', type: 'table.tiny', dx: 3, dy: 4, label: 'side table' }
    ]
  },
  {
    id: 'store', name: 'Deploy Center', type: 'house.green2', x: 4, y: 50, w: 5, h: 4,
    subLocations: ['console', 'rack', 'staging_area'],
    zones: [{ x1: 0, y1: 0, x2: 5, y2: 4, floor: F.CONCRETE }],
    interiorWalls: [],
    stations: [
      { id: 'store_r1', kind: 'work', type: 'cabinet.metal', dx: 1, dy: 0, label: 'rack A' },
      { id: 'store_r2', kind: 'work', type: 'cabinet.metal.alt', dx: 2, dy: 0, label: 'rack B' },
      { id: 'store_vault', kind: 'work', type: 'safe', dx: 3, dy: 0, label: 'vault' },
      { id: 'store_counter', kind: 'work', type: 'counter', dx: 1, dy: 1, label: 'staging' },
      { id: 'store_drawer', kind: 'work', type: 'cabinet.drawer', dx: 2, dy: 1, label: 'parts drawer' },
      { id: 'store_tools', kind: 'work', type: 'cabinet.wood', dx: 3, dy: 1, label: 'tools' },
      { id: 'store_desk', kind: 'work', type: 'table.mid', dx: 1, dy: 2, label: 'ops desk' },
      { id: 'store_chair', kind: 'work', type: 'chair', dx: 2, dy: 2, label: 'ops chair' },
      { id: 'store_case', kind: 'work', type: 'cabinet.glass', dx: 3, dy: 2, label: 'sample case' }
    ]
  },
  {
    id: 'barracks', name: 'Barracks', type: 'house2', x: 14, y: 40, w: 6, h: 5,
    subLocations: ['bunks', 'mess_hall', 'locker_room'],
    zones: [
      { x1: 0, y1: 0, x2: 6, y2: 2, floor: F.CONCRETE },
      { x1: 0, y1: 2, x2: 6, y2: 5, floor: F.SOFT }
    ],
    interiorWalls: [
      { x1: 0, y1: 2, x2: 2, y2: 2 },
      { x1: 3, y1: 2, x2: 6, y2: 2 }
    ],
    stations: [
      { id: 'bk_bunk1', kind: 'rest', type: 'bed.wide.blue', dx: 1, dy: 0, label: 'bunk 1' },
      { id: 'bk_bunk2', kind: 'rest', type: 'bed.wide.blue', dx: 3, dy: 0, label: 'bunk 2' },
      { id: 'bk_locker1', kind: 'rest', type: 'cabinet.wood', dx: 4, dy: 0, label: 'locker 1' },
      { id: 'bk_locker2', kind: 'rest', type: 'cabinet.wood.alt', dx: 1, dy: 1, label: 'locker 2' },
      { id: 'bk_dresser', kind: 'rest', type: 'dresser', dx: 2, dy: 1, label: 'dresser' },
      { id: 'bk_nightst', kind: 'rest', type: 'nightstand', dx: 3, dy: 1, label: 'nightstand' },
      { id: 'bk_table', kind: 'rest', type: 'table', dx: 1, dy: 2, label: 'mess table' },
      { id: 'bk_chair1', kind: 'rest', type: 'chair', dx: 2, dy: 2, label: 'mess chair 1' },
      { id: 'bk_chair2', kind: 'rest', type: 'chair.alt', dx: 3, dy: 2, label: 'mess chair 2' },
      { id: 'bk_stove', kind: 'work', type: 'stove', dx: 4, dy: 2, label: 'mess stove' },
      { id: 'bk_sofa', kind: 'rest', type: 'sofa', dx: 1, dy: 3, label: 'day room sofa' },
      { id: 'bk_plant', kind: 'rest', type: 'plant.purple', dx: 4, dy: 3, label: 'barracks plant' }
    ]
  },
  {
    id: 'armory', name: 'Armory', type: 'house.gray', x: 14, y: 50, w: 5, h: 4,
    subLocations: ['weapons_rack', 'repair_bench', 'vault'],
    zones: [{ x1: 0, y1: 0, x2: 5, y2: 4, floor: F.CONCRETE }],
    interiorWalls: [],
    stations: [
      { id: 'arm_rack1', kind: 'work', type: 'cabinet.metal', dx: 1, dy: 0, label: 'weapons rack A' },
      { id: 'arm_rack2', kind: 'work', type: 'cabinet.metal.alt', dx: 2, dy: 0, label: 'weapons rack B' },
      { id: 'arm_safe', kind: 'work', type: 'safe', dx: 3, dy: 0, label: 'ammo vault' },
      { id: 'arm_bench', kind: 'work', type: 'table.mid', dx: 1, dy: 1, label: 'repair bench' },
      { id: 'arm_chair', kind: 'work', type: 'chair', dx: 2, dy: 1, label: 'armorer seat' },
      { id: 'arm_tools', kind: 'work', type: 'cabinet.wood', dx: 3, dy: 1, label: 'tool cabinet' },
      { id: 'arm_display', kind: 'work', type: 'display', dx: 1, dy: 2, label: 'inventory display' },
      { id: 'arm_drawer', kind: 'work', type: 'cabinet.drawer', dx: 2, dy: 2, label: 'parts drawer' },
      { id: 'arm_stool', kind: 'rest', type: 'chair.alt', dx: 3, dy: 2, label: 'break stool' }
    ]
  },

  /* ========== Southeast District (Culture / Commerce) ========== */
  {
    id: 'library', name: 'Docs Archive', type: 'house.gray', x: 44, y: 40, w: 6, h: 5,
    subLocations: ['desk', 'bookshelf', 'reading_area'],
    zones: [
      { x1: 0, y1: 0, x2: 3, y2: 5, floor: F.WOOD },
      { x1: 3, y1: 0, x2: 6, y2: 5, floor: F.GREEN }
    ],
    interiorWalls: [
      { x1: 3, y1: 0, x2: 3, y2: 2 },
      { x1: 3, y1: 3, x2: 3, y2: 5 }
    ],
    stations: [
      { id: 'lib_w1', kind: 'work', type: 'bookshelf', dx: 1, dy: 0, label: 'shelf A' },
      { id: 'lib_w2', kind: 'work', type: 'bookshelf.full', dx: 2, dy: 0, label: 'shelf B' },
      { id: 'lib_w3', kind: 'work', type: 'bookshelf.scroll', dx: 1, dy: 1, label: 'scrolls' },
      { id: 'lib_cab', kind: 'work', type: 'cabinet.books', dx: 2, dy: 1, label: 'catalog' },
      { id: 'lib_w4', kind: 'work', type: 'bookshelf', dx: 1, dy: 3, label: 'shelf C' },
      { id: 'lib_w5', kind: 'work', type: 'bookshelf.full', dx: 2, dy: 3, label: 'shelf D' },
      { id: 'lib_desk', kind: 'work', type: 'table.mid', dx: 4, dy: 0, label: 'study desk' },
      { id: 'lib_chair1', kind: 'work', type: 'chair', dx: 5, dy: 0, label: 'study chair' },
      { id: 'lib_plant', kind: 'rest', type: 'plant.purple', dx: 4, dy: 1, label: 'corner plant' },
      { id: 'lib_sofa', kind: 'rest', type: 'sofa', dx: 5, dy: 1, label: 'reading sofa' },
      { id: 'lib_table', kind: 'rest', type: 'table.tiny', dx: 4, dy: 3, label: 'side table' },
      { id: 'lib_chair2', kind: 'rest', type: 'chair.alt', dx: 5, dy: 3, label: 'lounge chair' }
    ]
  },
  {
    id: 'cafe', name: 'Agent Lounge', type: 'shop', x: 36, y: 36, w: 5, h: 5,
    subLocations: ['counter', 'table_1', 'table_2', 'kitchen'],
    zones: [
      { x1: 0, y1: 0, x2: 5, y2: 2, floor: F.TILE },
      { x1: 0, y1: 2, x2: 5, y2: 5, floor: F.WOOD }
    ],
    interiorWalls: [
      { x1: 0, y1: 2, x2: 2, y2: 2 },
      { x1: 3, y1: 2, x2: 5, y2: 2 }
    ],
    stations: [
      { id: 'cafe_case', kind: 'work', type: 'cabinet.glass', dx: 1, dy: 0, label: 'pastry case' },
      { id: 'cafe_stove', kind: 'work', type: 'stove', dx: 2, dy: 0, label: 'main stove' },
      { id: 'cafe_plant', kind: 'rest', type: 'plant.pink', dx: 3, dy: 0, label: 'cafe plant' },
      { id: 'cafe_stove2', kind: 'work', type: 'stove.alt', dx: 1, dy: 1, label: 'grill' },
      { id: 'cafe_counter', kind: 'work', type: 'counter', dx: 2, dy: 1, label: 'prep counter' },
      { id: 'cafe_sofa1', kind: 'rest', type: 'sofa', dx: 1, dy: 2, label: 'corner booth' },
      { id: 'cafe_sofa2', kind: 'rest', type: 'sofa.alt', dx: 3, dy: 2, label: 'window booth' },
      { id: 'cafe_chair1', kind: 'rest', type: 'chair', dx: 1, dy: 3, label: 'diner 1' },
      { id: 'cafe_table', kind: 'rest', type: 'table', dx: 2, dy: 3, label: 'dining table' },
      { id: 'cafe_chair2', kind: 'rest', type: 'chair.alt', dx: 3, dy: 3, label: 'diner 2' },
      { id: 'cafe_sofa3', kind: 'rest', type: 'sofa.alt2', dx: 1, dy: 4, label: 'lounge sofa' },
      { id: 'cafe_ns', kind: 'rest', type: 'nightstand.alt', dx: 3, dy: 4, label: 'side stand' }
    ]
  },
  {
    id: 'market', name: 'Market', type: 'large', x: 44, y: 50, w: 8, h: 5,
    subLocations: ['produce_stall', 'goods_stall', 'back_room'],
    zones: [
      { x1: 0, y1: 0, x2: 4, y2: 5, floor: F.WOOD },
      { x1: 4, y1: 0, x2: 8, y2: 5, floor: F.TILE }
    ],
    interiorWalls: [
      { x1: 4, y1: 0, x2: 4, y2: 2 },
      { x1: 4, y1: 3, x2: 4, y2: 5 }
    ],
    stations: [
      { id: 'mk_stall1', kind: 'work', type: 'counter', dx: 1, dy: 0, label: 'produce stall' },
      { id: 'mk_stall2', kind: 'work', type: 'counter', dx: 2, dy: 0, label: 'goods stall' },
      { id: 'mk_case', kind: 'work', type: 'cabinet.glass', dx: 3, dy: 0, label: 'display case' },
      { id: 'mk_chair1', kind: 'work', type: 'chair', dx: 1, dy: 1, label: 'vendor seat 1' },
      { id: 'mk_drawer', kind: 'work', type: 'cabinet.drawer', dx: 2, dy: 1, label: 'coin drawer' },
      { id: 'mk_chair2', kind: 'work', type: 'chair.alt', dx: 3, dy: 1, label: 'vendor seat 2' },
      { id: 'mk_crate1', kind: 'work', type: 'cabinet.wood', dx: 1, dy: 3, label: 'crate A' },
      { id: 'mk_crate2', kind: 'work', type: 'cabinet.wood.alt', dx: 2, dy: 3, label: 'crate B' },
      { id: 'mk_rack', kind: 'work', type: 'cabinet.metal', dx: 5, dy: 0, label: 'storage rack' },
      { id: 'mk_desk', kind: 'work', type: 'table.mid', dx: 5, dy: 1, label: 'ledger desk' },
      { id: 'mk_safe', kind: 'work', type: 'safe', dx: 6, dy: 0, label: 'market safe' },
      { id: 'mk_sofa', kind: 'rest', type: 'sofa', dx: 5, dy: 3, label: 'break bench' }
    ]
  },
  {
    id: 'inn', name: 'Inn', type: 'house.green2', x: 36, y: 50, w: 5, h: 5,
    subLocations: ['tavern', 'guest_room', 'kitchen'],
    zones: [
      { x1: 0, y1: 0, x2: 5, y2: 2, floor: F.WOOD },
      { x1: 0, y1: 2, x2: 5, y2: 5, floor: F.SOFT }
    ],
    interiorWalls: [
      { x1: 0, y1: 2, x2: 2, y2: 2 },
      { x1: 3, y1: 2, x2: 5, y2: 2 }
    ],
    stations: [
      { id: 'inn_bar', kind: 'work', type: 'counter', dx: 1, dy: 0, label: 'bar counter' },
      { id: 'inn_stove', kind: 'work', type: 'stove', dx: 2, dy: 0, label: 'tavern stove' },
      { id: 'inn_tap', kind: 'work', type: 'dresser.beer', dx: 3, dy: 0, label: 'beer tap' },
      { id: 'inn_table', kind: 'rest', type: 'table', dx: 1, dy: 1, label: 'tavern table' },
      { id: 'inn_chair1', kind: 'rest', type: 'chair', dx: 2, dy: 1, label: 'tavern chair' },
      { id: 'inn_chair2', kind: 'rest', type: 'chair.alt', dx: 3, dy: 1, label: 'bar stool' },
      { id: 'inn_bed1', kind: 'rest', type: 'bed.wide.pink', dx: 1, dy: 2, label: 'guest bed 1' },
      { id: 'inn_nightst', kind: 'rest', type: 'nightstand', dx: 2, dy: 2, label: 'bedside table' },
      { id: 'inn_bed2', kind: 'rest', type: 'bed.wide.blue', dx: 3, dy: 2, label: 'guest bed 2' },
      { id: 'inn_dresser', kind: 'rest', type: 'dresser', dx: 1, dy: 3, label: 'guest dresser' },
      { id: 'inn_plant', kind: 'rest', type: 'plant.pink', dx: 3, dy: 3, label: 'inn plant' }
    ]
  },

  /* ========== Central ========== */
  {
    id: 'clock_tower', name: 'Clock Tower', type: 'tower', x: 28, y: 22, w: 4, h: 4,
    subLocations: ['observation_deck', 'mechanism_room'],
    zones: [{ x1: 0, y1: 0, x2: 4, y2: 4, floor: F.TILE }],
    interiorWalls: [],
    stations: [
      { id: 'ct_clock', kind: 'work', type: 'display', dx: 1, dy: 0, label: 'clock mechanism' },
      { id: 'ct_bell', kind: 'work', type: 'display.alt', dx: 2, dy: 0, label: 'bell controls' },
      { id: 'ct_desk', kind: 'work', type: 'table.mid', dx: 1, dy: 1, label: 'logbook desk' },
      { id: 'ct_chair', kind: 'work', type: 'chair', dx: 2, dy: 1, label: 'keeper chair' },
      { id: 'ct_shelf', kind: 'work', type: 'bookshelf', dx: 1, dy: 2, label: 'parts shelf' },
      { id: 'ct_sofa', kind: 'rest', type: 'sofa', dx: 2, dy: 2, label: 'observation seat' }
    ]
  }
];

export const OUTDOOR_STATIONS: Station[] = [
  /* ---- Central plaza area ---- */
  { id: 'plaza_bench_n', kind: 'rest', type: 'outdoor.reading', x: 29, y: 27, dx: 0, dy: 0, label: 'plaza bench N', activity: 'reading on a bench' },
  { id: 'plaza_bench_s', kind: 'rest', type: 'outdoor.sitting', x: 31, y: 33, dx: 0, dy: 0, label: 'plaza bench S', activity: 'taking a break' },
  { id: 'plaza_bench_e', kind: 'rest', type: 'outdoor.sitting', x: 33, y: 29, dx: 0, dy: 0, label: 'plaza bench E', activity: 'people watching' },
  { id: 'plaza_bench_w', kind: 'rest', type: 'outdoor.reading', x: 27, y: 31, dx: 0, dy: 0, label: 'plaza bench W', activity: 'reading the paper' },
  { id: 'plaza_center', kind: 'rest', type: 'outdoor.chatting', x: 30, y: 30, dx: 0, dy: 0, label: 'plaza fountain', activity: 'chatting at the plaza' },

  /* ---- NW quadrant ---- */
  { id: 'garden_nw1', kind: 'rest', type: 'outdoor.flowers', x: 16, y: 8, dx: 0, dy: 0, label: 'NW rose garden', activity: 'enjoying the roses' },
  { id: 'garden_nw2', kind: 'rest', type: 'outdoor.flowers', x: 8, y: 18, dx: 0, dy: 0, label: 'NW herb garden', activity: 'tending herbs' },
  { id: 'bench_nw', kind: 'rest', type: 'outdoor.sitting', x: 14, y: 22, dx: 0, dy: 0, label: 'NW park bench', activity: 'sitting under a tree' },
  { id: 'nap_nw', kind: 'rest', type: 'outdoor.napping', x: 18, y: 18, dx: 0, dy: 0, label: 'NW shady spot', activity: 'napping under a tree' },
  { id: 'mine_nw', kind: 'work', type: 'outdoor.mining', x: 3, y: 24, dx: 0, dy: 0, label: 'NW quarry', activity: 'mining stones' },
  { id: 'forage_nw', kind: 'work', type: 'outdoor.foraging', x: 18, y: 4, dx: 0, dy: 0, label: 'NW berry bush', activity: 'picking berries' },
  { id: 'stream_bench', kind: 'rest', type: 'outdoor.sitting', x: 13, y: 44, dx: 0, dy: 0, label: 'stream bench', activity: 'listening to the stream' },
  { id: 'stream_fish', kind: 'rest', type: 'outdoor.fishing', x: 8, y: 44, dx: 0, dy: 0, label: 'stream fishing', activity: 'fishing in the canal' },

  /* ---- NE quadrant ---- */
  { id: 'garden_ne1', kind: 'rest', type: 'outdoor.flowers', x: 42, y: 10, dx: 0, dy: 0, label: 'NE flower bed', activity: 'smelling the flowers' },
  { id: 'garden_ne2', kind: 'rest', type: 'outdoor.flowers', x: 55, y: 12, dx: 0, dy: 0, label: 'NE hedge', activity: 'trimming hedges' },
  { id: 'bench_ne', kind: 'rest', type: 'outdoor.sitting', x: 48, y: 20, dx: 0, dy: 0, label: 'NE park bench', activity: 'resting on a bench' },
  { id: 'nap_ne', kind: 'rest', type: 'outdoor.napping', x: 40, y: 18, dx: 0, dy: 0, label: 'NE shady tree', activity: 'dozing off' },
  { id: 'mine_ne', kind: 'work', type: 'outdoor.mining', x: 56, y: 22, dx: 0, dy: 0, label: 'NE rock face', activity: 'chipping rocks' },
  { id: 'forage_ne', kind: 'work', type: 'outdoor.foraging', x: 34, y: 14, dx: 0, dy: 0, label: 'NE mushroom patch', activity: 'gathering mushrooms' },
  { id: 'pond_fish', kind: 'rest', type: 'outdoor.fishing', x: 48, y: 14, dx: 0, dy: 0, label: 'pond fishing', activity: 'fishing by the pond' },
  { id: 'pond_view', kind: 'rest', type: 'outdoor.watching', x: 52, y: 18, dx: 0, dy: 0, label: 'pond view', activity: 'watching the water' },

  /* ---- SW quadrant ---- */
  { id: 'garden_sw1', kind: 'rest', type: 'outdoor.flowers', x: 14, y: 36, dx: 0, dy: 0, label: 'SW garden', activity: 'watering flowers' },
  { id: 'garden_sw2', kind: 'rest', type: 'outdoor.flowers', x: 22, y: 46, dx: 0, dy: 0, label: 'SW wildflowers', activity: 'picking wildflowers' },
  { id: 'bench_sw', kind: 'rest', type: 'outdoor.sitting', x: 6, y: 56, dx: 0, dy: 0, label: 'SW corner bench', activity: 'sitting quietly' },
  { id: 'nap_sw', kind: 'rest', type: 'outdoor.napping', x: 20, y: 54, dx: 0, dy: 0, label: 'SW grassy knoll', activity: 'napping in the sun' },
  { id: 'mine_sw', kind: 'work', type: 'outdoor.mining', x: 3, y: 56, dx: 0, dy: 0, label: 'SW rock pile', activity: 'breaking rocks' },
  { id: 'forage_sw', kind: 'work', type: 'outdoor.foraging', x: 24, y: 38, dx: 0, dy: 0, label: 'SW herb patch', activity: 'foraging herbs' },

  /* ---- SE quadrant ---- */
  { id: 'garden_se1', kind: 'rest', type: 'outdoor.flowers', x: 42, y: 36, dx: 0, dy: 0, label: 'SE rose garden', activity: 'strolling the garden' },
  { id: 'garden_se2', kind: 'rest', type: 'outdoor.flowers', x: 54, y: 46, dx: 0, dy: 0, label: 'SE flower arch', activity: 'admiring the arch' },
  { id: 'bench_se', kind: 'rest', type: 'outdoor.sitting', x: 56, y: 38, dx: 0, dy: 0, label: 'SE bench', activity: 'enjoying the view' },
  { id: 'nap_se', kind: 'rest', type: 'outdoor.napping', x: 40, y: 56, dx: 0, dy: 0, label: 'SE shady tree', activity: 'dozing in the shade' },
  { id: 'mine_se', kind: 'work', type: 'outdoor.mining', x: 56, y: 56, dx: 0, dy: 0, label: 'SE quarry', activity: 'mining ore' },
  { id: 'forage_se', kind: 'work', type: 'outdoor.foraging', x: 54, y: 34, dx: 0, dy: 0, label: 'SE berry bush', activity: 'gathering berries' },
];

export const SUB_LOCATIONS: Record<string, string[]> = {
  'home_nw': ['workbench', 'drafting_table', 'lounge'],
  'home_ne': ['test_station', 'monitor_wall', 'break_area'],
  'home_sw': ['console', 'server_rack', 'meeting_corner'],
  'cafe': ['counter', 'table_1', 'table_2', 'kitchen'],
  'library': ['desk', 'bookshelf', 'reading_area'],
  'office': ['desk', 'meeting_room', 'lobby'],
  'store': ['console', 'rack', 'staging_area'],
  'town_hall': ['council_chamber', 'records_office', 'lobby'],
  'art_gallery': ['main_hall', 'studio', 'gift_shop'],
  'workshop': ['forge', 'assembly', 'storage'],
  'research_lab': ['main_lab', 'clean_room', 'data_room'],
  'data_center': ['server_room', 'ops_desk', 'cooling_unit'],
  'training_center': ['classroom', 'sim_room', 'lobby'],
  'barracks': ['bunks', 'mess_hall', 'locker_room'],
  'armory': ['weapons_rack', 'repair_bench', 'vault'],
  'market': ['produce_stall', 'goods_stall', 'back_room'],
  'inn': ['tavern', 'guest_room', 'kitchen'],
  'clock_tower': ['observation_deck', 'mechanism_room'],
};

export const ACTIVITY_TEMPLATES: Record<string, string[]> = {
  idle: ['walking around the village', 'taking a stroll', 'wandering through the village', 'enjoying the scenery'],
  working: ['working on a task', 'deep in thought', 'focused on work', 'reviewing code', 'writing documentation', 'debugging an issue', 'planning next steps'],
  at_cafe: ['having coffee', 'chatting with teammates', 'taking a break'],
  at_library: ['reading docs', 'researching a solution', 'browsing the archive'],
  at_office: ['in a standup', 'reviewing reports', 'presenting to CEO'],
  at_home: ['deep in focus mode', 'pair programming', 'whiteboarding'],
  at_store: ['checking deploy pipeline', 'reviewing artifacts'],
  at_town_hall: ['attending a council meeting', 'filing a report', 'reviewing town records'],
  at_art_gallery: ['admiring an exhibit', 'sketching a painting', 'browsing the gift shop'],
  at_workshop: ['forging a tool', 'repairing equipment', 'assembling a prototype'],
  at_research_lab: ['running an experiment', 'analyzing samples', 'writing a paper'],
  at_data_center: ['monitoring servers', 'running diagnostics', 'patching firmware'],
  at_training_center: ['attending a lecture', 'running a simulation', 'studying course material'],
  at_barracks: ['resting in the bunk', 'eating at the mess hall', 'organizing gear'],
  at_armory: ['maintaining weapons', 'inventorying supplies', 'sharpening blades'],
  at_market: ['browsing goods', 'haggling over prices', 'restocking inventory'],
  at_inn: ['having a drink', 'resting in a guest room', 'chatting at the bar'],
  at_clock_tower: ['winding the clock', 'gazing from the tower', 'logging the hour'],
};
