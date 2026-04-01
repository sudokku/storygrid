import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActiveTool = 'select' | 'split-h' | 'split-v';

type EditorState = {
  selectedNodeId: string | null;
  zoom: number;
  canvasScale: number;
  showSafeZone: boolean;
  activeTool: ActiveTool;
  setSelectedNode: (id: string | null) => void;
  setZoom: (z: number) => void;
  setCanvasScale: (s: number) => void;
  toggleSafeZone: () => void;
  setActiveTool: (tool: ActiveTool) => void;
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useEditorStore = create<EditorState>()(set => ({
  selectedNodeId: null,
  zoom: 1,
  canvasScale: 1,
  showSafeZone: false,
  activeTool: 'select',
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setZoom: (z) => set({ zoom: Math.min(1.5, Math.max(0.5, z)) }),
  setCanvasScale: (s) => set({ canvasScale: s }),
  toggleSafeZone: () => set((s) => ({ showSafeZone: !s.showSafeZone })),
  setActiveTool: (tool) => set({ activeTool: tool }),
}));
