import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActiveTool = 'select' | 'split-h' | 'split-v';
export type ExportFormat = 'png' | 'jpeg';

type EditorState = {
  selectedNodeId: string | null;
  zoom: number;
  canvasScale: number;
  showSafeZone: boolean;
  activeTool: ActiveTool;
  isExporting: boolean;
  exportFormat: ExportFormat;
  exportQuality: number;
  setSelectedNode: (id: string | null) => void;
  setZoom: (z: number) => void;
  setCanvasScale: (s: number) => void;
  toggleSafeZone: () => void;
  setActiveTool: (tool: ActiveTool) => void;
  setIsExporting: (v: boolean) => void;
  setExportFormat: (f: ExportFormat) => void;
  setExportQuality: (q: number) => void;
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
  isExporting: false,
  exportFormat: 'png' as const,
  exportQuality: 0.9,
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setZoom: (z) => set({ zoom: Math.min(1.5, Math.max(0.5, z)) }),
  setCanvasScale: (s) => set({ canvasScale: s }),
  toggleSafeZone: () => set((s) => ({ showSafeZone: !s.showSafeZone })),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setIsExporting: (v) => set({ isExporting: v }),
  setExportFormat: (f) => set({ exportFormat: f }),
  setExportQuality: (q) => set({ exportQuality: q }),
}));
