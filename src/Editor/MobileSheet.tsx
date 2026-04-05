import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useGridStore } from '../store/gridStore';
import { CanvasSettingsPanel, SelectedCellPanel } from './Sidebar';
import { TemplatesPopover } from '../components/TemplatesPopover';
import { Undo2, Redo2, Trash2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Snap state constants
// ---------------------------------------------------------------------------

type SheetSnapState = 'collapsed' | 'half' | 'full';

const SNAP_TRANSLATE: Record<SheetSnapState, string> = {
  full: 'translateY(max(calc(env(safe-area-inset-top) + 56px), 72px))',
  half: 'translateY(60vh)',
  collapsed: 'translateY(calc(100% - 60px))',
};

const DRAG_THRESHOLD = 50;

// ---------------------------------------------------------------------------
// MobileSheet component
// ---------------------------------------------------------------------------

export const MobileSheet = React.memo(function MobileSheet() {
  const sheetSnapState = useEditorStore(s => s.sheetSnapState);
  const setSheetSnapState = useEditorStore(s => s.setSheetSnapState);
  const selectedNodeId = useEditorStore(s => s.selectedNodeId);
  const panModeNodeId = useEditorStore(s => s.panModeNodeId);
  const setPanModeNodeId = useEditorStore(s => s.setPanModeNodeId);

  const undo = useGridStore(s => s.undo);
  const redo = useGridStore(s => s.redo);
  const clearGrid = useGridStore(s => s.clearGrid);
  const canUndo = useGridStore(s => s.historyIndex > 0);
  const canRedo = useGridStore(s => s.historyIndex < s.history.length - 1);

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ y: number; snap: SheetSnapState } | null>(null);

  // Auto-expand sheet to half when a cell is selected
  useEffect(() => {
    if (selectedNodeId) setSheetSnapState('half');
  }, [selectedNodeId, setSheetSnapState]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { y: e.clientY, snap: sheetSnapState };
    setIsDragging(true);
  }, [sheetSnapState]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dy = e.clientY - dragStartRef.current.y;
    const currentSnap = dragStartRef.current.snap;

    if (dy < -DRAG_THRESHOLD) {
      // Dragged up → advance to higher snap
      if (currentSnap === 'collapsed') setSheetSnapState('half');
      else if (currentSnap === 'half') setSheetSnapState('full');
    } else if (dy > DRAG_THRESHOLD) {
      // Dragged down → go to lower snap
      if (currentSnap === 'full') setSheetSnapState('half');
      else if (currentSnap === 'half') setSheetSnapState('collapsed');
    }

    setIsDragging(false);
    dragStartRef.current = null;
  }, [setSheetSnapState]);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--card)] rounded-t-2xl border-t border-[var(--border)] md:hidden"
      style={{
        height: '100vh',
        transform: SNAP_TRANSLATE[sheetSnapState],
        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
      }}
      data-testid="mobile-sheet"
      data-sheet-snap={sheetSnapState}
    >
      {/* Drag handle area — 60px tall, contains handle bar + header row */}
      <div
        className="touch-none cursor-grab select-none"
        style={{ height: 60 }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        data-testid="sheet-drag-handle"
      >
        {/* Visual drag handle bar: centered, 4x32px, rounded */}
        <div className="mx-auto mt-3 mb-2 h-1 w-8 rounded-full bg-[#555]" />

        {/* Sheet header row: Templates | Undo | Redo | Clear */}
        <div className="flex items-center justify-center gap-4 px-4 pb-2">
          <TemplatesPopover />
          <button
            className="min-w-[44px] h-11 flex items-center justify-center rounded-md text-[var(--muted-foreground)] active:text-[var(--foreground)]"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            data-testid="sheet-undo"
          >
            <Undo2 size={20} />
          </button>
          <button
            className="min-w-[44px] h-11 flex items-center justify-center rounded-md text-[var(--muted-foreground)] active:text-[var(--foreground)]"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
            data-testid="sheet-redo"
          >
            <Redo2 size={20} />
          </button>
          <button
            className="min-w-[44px] h-11 flex items-center justify-center rounded-md text-[var(--muted-foreground)] active:text-[var(--foreground)]"
            onClick={clearGrid}
            aria-label="Clear canvas"
            data-testid="sheet-clear"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Sheet content — scrollable */}
      <div
        className="overflow-y-auto"
        style={{
          height: 'calc(100% - 60px)',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
        {panModeNodeId ? (
          <div className="p-4">
            <button
              className="w-full py-3 rounded-lg text-sm font-medium bg-[var(--sidebar-primary)] text-white"
              onClick={() => setPanModeNodeId(null)}
              data-testid="exit-pan-mode"
            >
              Exit Pan Mode
            </button>
          </div>
        ) : selectedNodeId ? (
          <SelectedCellPanel nodeId={selectedNodeId} key={selectedNodeId} />
        ) : (
          <CanvasSettingsPanel />
        )}
      </div>
    </div>
  );
});
