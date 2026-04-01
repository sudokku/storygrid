import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActiveTool = 'select' | 'split-h' | 'split-v';
export type ExportFormat = 'png' | 'jpeg';
export type BackgroundMode = 'solid' | 'gradient';
export type GradientDir = 'to-bottom' | 'to-right' | 'diagonal';

type EditorState = {
  selectedNodeId: string | null;
  zoom: number;
  canvasScale: number;
  showSafeZone: boolean;
  activeTool: ActiveTool;
  isExporting: boolean;
  exportFormat: ExportFormat;
  exportQuality: number;
  // Phase 5 canvas settings
  panModeNodeId: string | null;
  gap: number;
  borderRadius: number;
  borderColor: string;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  backgroundGradientFrom: string;
  backgroundGradientTo: string;
  backgroundGradientDir: GradientDir;
  // Actions
  setSelectedNode: (id: string | null) => void;
  setZoom: (z: number) => void;
  setCanvasScale: (s: number) => void;
  toggleSafeZone: () => void;
  setActiveTool: (tool: ActiveTool) => void;
  setIsExporting: (v: boolean) => void;
  setExportFormat: (f: ExportFormat) => void;
  setExportQuality: (q: number) => void;
  // Phase 5 setters
  setPanModeNodeId: (id: string | null) => void;
  setGap: (v: number) => void;
  setBorderRadius: (v: number) => void;
  setBorderColor: (v: string) => void;
  setBackgroundMode: (v: BackgroundMode) => void;
  setBackgroundColor: (v: string) => void;
  setBackgroundGradientFrom: (v: string) => void;
  setBackgroundGradientTo: (v: string) => void;
  setBackgroundGradientDir: (v: GradientDir) => void;
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
  // Phase 5 canvas settings initial values
  panModeNodeId: null,
  gap: 0,
  borderRadius: 0,
  borderColor: '#000000',
  backgroundMode: 'solid' as const,
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#000000',
  backgroundGradientDir: 'to-bottom' as const,
  // Existing setters
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setZoom: (z) => set({ zoom: Math.min(1.5, Math.max(0.5, z)) }),
  setCanvasScale: (s) => set({ canvasScale: s }),
  toggleSafeZone: () => set((s) => ({ showSafeZone: !s.showSafeZone })),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setIsExporting: (v) => set({ isExporting: v }),
  setExportFormat: (f) => set({ exportFormat: f }),
  setExportQuality: (q) => set({ exportQuality: q }),
  // Phase 5 setters
  setPanModeNodeId: (id) => set({ panModeNodeId: id }),
  setGap: (v) => set({ gap: Math.min(20, Math.max(0, v)) }),
  setBorderRadius: (v) => set({ borderRadius: Math.min(24, Math.max(0, v)) }),
  setBorderColor: (v) => set({ borderColor: v }),
  setBackgroundMode: (v) => set({ backgroundMode: v }),
  setBackgroundColor: (v) => set({ backgroundColor: v }),
  setBackgroundGradientFrom: (v) => set({ backgroundGradientFrom: v }),
  setBackgroundGradientTo: (v) => set({ backgroundGradientTo: v }),
  setBackgroundGradientDir: (v) => set({ backgroundGradientDir: v }),
}));
