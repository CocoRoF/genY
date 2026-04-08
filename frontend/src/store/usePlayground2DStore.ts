import { create } from 'zustand';
import type { WorldState, WorldEvent, EditorState, WorldLayout } from '@/lib/playground2d/types';
import { WORLD_WIDTH, WORLD_HEIGHT } from '@/lib/playground2d/types';

interface Playground2DState {
  // World state
  worldState: WorldState | null;
  initialized: boolean;
  loading: boolean;
  loadProgress: number;

  // Agent avatar customization: agentId → character variant index (0..211)
  agentAvatars: Record<string, number>;

  // Editor
  editor: EditorState;

  // Actions
  initWorld: (layout?: WorldLayout | null) => void;
  setWorldState: (state: WorldState) => void;
  processEvents: (events: WorldEvent[]) => void;
  setLoading: (loading: boolean) => void;
  setLoadProgress: (progress: number) => void;

  // Avatar customization
  setAgentAvatar: (agentId: string, variantIndex: number) => void;
  getAgentAvatar: (agentId: string) => number | null;

  // Editor actions
  toggleEditor: () => void;
  setEditorTab: (tab: EditorState['activeToolTab']) => void;
  pushUndoState: (layout: WorldLayout) => void;
  undo: () => WorldLayout | null;
  redo: () => WorldLayout | null;
  setEditorDirty: (dirty: boolean) => void;
}

const MAX_UNDO = 50;

export const usePlayground2DStore = create<Playground2DState>((set, get) => ({
  worldState: null,
  initialized: false,
  loading: false,
  loadProgress: 0,

  editor: {
    active: false,
    selectedItem: null,
    undoStack: [],
    redoStack: [],
    dirty: false,
    activeToolTab: 'buildings',
  },

  agentAvatars: (() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('playground2d_avatars') : null;
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  })(),

  setAgentAvatar: (agentId, variantIndex) => {
    set(s => {
      const next = { ...s.agentAvatars, [agentId]: variantIndex };
      try { localStorage.setItem('playground2d_avatars', JSON.stringify(next)); } catch {}
      return { agentAvatars: next };
    });
  },

  getAgentAvatar: (agentId) => {
    const val = get().agentAvatars[agentId];
    return val !== undefined ? val : null;
  },

  initWorld: (layout = null) => {
    // Will be populated by worldModel.createWorldModel()
    set({ initialized: true });
  },

  setWorldState: (worldState) => set({ worldState }),

  processEvents: (events) => {
    // Will delegate to eventsPipeline
    const current = get().worldState;
    if (!current) return;
    // Events processing happens externally and calls setWorldState
  },

  setLoading: (loading) => set({ loading }),
  setLoadProgress: (progress) => set({ loadProgress: progress }),

  toggleEditor: () => set(s => ({
    editor: { ...s.editor, active: !s.editor.active }
  })),

  setEditorTab: (tab) => set(s => ({
    editor: { ...s.editor, activeToolTab: tab }
  })),

  pushUndoState: (layout) => set(s => ({
    editor: {
      ...s.editor,
      undoStack: [...s.editor.undoStack.slice(-MAX_UNDO + 1), layout],
      redoStack: [],
      dirty: true,
    }
  })),

  undo: () => {
    const { editor } = get();
    if (editor.undoStack.length === 0) return null;
    const prev = editor.undoStack[editor.undoStack.length - 1];
    // Need current state for redo - caller must provide
    set(s => ({
      editor: {
        ...s.editor,
        undoStack: s.editor.undoStack.slice(0, -1),
        redoStack: [...s.editor.redoStack, prev],
        dirty: s.editor.undoStack.length > 1,
      }
    }));
    return prev;
  },

  redo: () => {
    const { editor } = get();
    if (editor.redoStack.length === 0) return null;
    const next = editor.redoStack[editor.redoStack.length - 1];
    set(s => ({
      editor: {
        ...s.editor,
        redoStack: s.editor.redoStack.slice(0, -1),
        undoStack: [...s.editor.undoStack, next],
        dirty: true,
      }
    }));
    return next;
  },

  setEditorDirty: (dirty) => set(s => ({
    editor: { ...s.editor, dirty }
  })),
}));
