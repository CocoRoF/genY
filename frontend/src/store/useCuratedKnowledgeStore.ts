import { create } from 'zustand';
import type {
  MemoryFileInfo,
  MemoryFileDetail,
  MemoryIndex,
  MemoryGraphNode,
  MemoryGraphEdge,
} from '@/types';

export type ViewMode = 'editor' | 'graph' | 'search';
export type SidebarPanel = 'files' | 'tags' | 'backlinks';

export interface CuratedKnowledgeState {
  // User info
  username: string | null;

  // Memory Index
  memoryIndex: MemoryIndex | null;
  stats: {
    total_files: number;
    total_chars: number;
    categories: Record<string, number>;
    total_tags: number;
    vector_enabled: boolean;
  } | null;
  loading: boolean;

  // Files
  files: Record<string, MemoryFileInfo>;
  selectedFile: string | null;
  fileDetail: MemoryFileDetail | null;
  openFiles: string[];

  // Graph
  graphNodes: MemoryGraphNode[];
  graphEdges: MemoryGraphEdge[];

  // Search
  searchQuery: string;
  searchResults: Array<Record<string, unknown>>;
  searching: boolean;

  // UI
  viewMode: ViewMode;
  sidebarPanel: SidebarPanel;
  sidebarCollapsed: boolean;
  rightPanelOpen: boolean;

  // Curation
  curatingFiles: Set<string>;

  // Actions
  setUsername: (u: string | null) => void;
  setMemoryIndex: (idx: MemoryIndex | null) => void;
  setStats: (s: CuratedKnowledgeState['stats']) => void;
  setLoading: (v: boolean) => void;
  setFiles: (f: Record<string, MemoryFileInfo>) => void;
  setSelectedFile: (fn: string | null) => void;
  setFileDetail: (d: MemoryFileDetail | null) => void;
  openFile: (fn: string) => void;
  closeFile: (fn: string) => void;
  setGraphData: (nodes: MemoryGraphNode[], edges: MemoryGraphEdge[]) => void;
  setSearchQuery: (q: string) => void;
  setSearchResults: (r: Array<Record<string, unknown>>) => void;
  setSearching: (v: boolean) => void;
  setViewMode: (m: ViewMode) => void;
  setSidebarPanel: (p: SidebarPanel) => void;
  setSidebarCollapsed: (v: boolean) => void;
  setRightPanelOpen: (v: boolean) => void;
  setCuratingFile: (fn: string, curating: boolean) => void;
  reset: () => void;
}

const initialState = {
  username: null as string | null,
  memoryIndex: null as MemoryIndex | null,
  stats: null as CuratedKnowledgeState['stats'],
  loading: false,
  files: {} as Record<string, MemoryFileInfo>,
  selectedFile: null as string | null,
  fileDetail: null as MemoryFileDetail | null,
  openFiles: [] as string[],
  graphNodes: [] as MemoryGraphNode[],
  graphEdges: [] as MemoryGraphEdge[],
  searchQuery: '',
  searchResults: [] as Array<Record<string, unknown>>,
  searching: false,
  viewMode: 'editor' as ViewMode,
  sidebarPanel: 'files' as SidebarPanel,
  sidebarCollapsed: false,
  rightPanelOpen: true,
  curatingFiles: new Set<string>(),
};

export const useCuratedKnowledgeStore = create<CuratedKnowledgeState>((set) => ({
  ...initialState,

  setUsername: (username) => set({ username }),
  setMemoryIndex: (idx) => set({ memoryIndex: idx }),
  setStats: (stats) => set({ stats }),
  setLoading: (loading) => set({ loading }),
  setFiles: (files) => set({ files }),
  setSelectedFile: (fn) => set({ selectedFile: fn }),
  setFileDetail: (d) => set({ fileDetail: d }),
  openFile: (fn) =>
    set((state) => ({
      selectedFile: fn,
      openFiles: state.openFiles.includes(fn) ? state.openFiles : [...state.openFiles, fn],
    })),
  closeFile: (fn) =>
    set((state) => {
      const openFiles = state.openFiles.filter((f) => f !== fn);
      return {
        openFiles,
        selectedFile: state.selectedFile === fn ? (openFiles[openFiles.length - 1] ?? null) : state.selectedFile,
        fileDetail: state.selectedFile === fn ? null : state.fileDetail,
      };
    }),
  setGraphData: (nodes, edges) => set({ graphNodes: nodes, graphEdges: edges }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchResults: (r) => set({ searchResults: r }),
  setSearching: (v) => set({ searching: v }),
  setViewMode: (m) => set({ viewMode: m }),
  setSidebarPanel: (p) => set({ sidebarPanel: p }),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setRightPanelOpen: (v) => set({ rightPanelOpen: v }),
  setCuratingFile: (fn, curating) =>
    set((state) => {
      const next = new Set(state.curatingFiles);
      if (curating) next.add(fn);
      else next.delete(fn);
      return { curatingFiles: next };
    }),
  reset: () => set({ ...initialState, curatingFiles: new Set<string>() }),
}));
