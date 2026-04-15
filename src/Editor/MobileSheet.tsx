import React, { useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { CanvasSettingsPanel, SelectedCellPanel } from './Sidebar';
import { ChevronUp, ChevronDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// Snap state constants
// ---------------------------------------------------------------------------

type SheetSnapState = 'collapsed' | 'full';

const SNAP_TRANSLATE: Record<SheetSnapState, string> = {
  full: 'translateY(max(calc(env(safe-area-inset-top) + 56px), 72px))',
  collapsed: 'translateY(calc(100% - 60px))',
};

// ---------------------------------------------------------------------------
// MobileSheet component
// ---------------------------------------------------------------------------

export const MobileSheet = React.memo(function MobileSheet() {
  const sheetSnapState = useEditorStore(s => s.sheetSnapState);
  const setSheetSnapState = useEditorStore(s => s.setSheetSnapState);
  const selectedNodeId = useEditorStore(s => s.selectedNodeId);
  const panModeNodeId = useEditorStore(s => s.panModeNodeId);
  const setPanModeNodeId = useEditorStore(s => s.setPanModeNodeId);

  // Auto-expand sheet to full only on null → non-null transitions (cell newly selected)
  const prevSelectedRef = useRef(selectedNodeId);
  useEffect(() => {
    const prev = prevSelectedRef.current;
    prevSelectedRef.current = selectedNodeId;
    if (!prev && selectedNodeId) setSheetSnapState('full');
  }, [selectedNodeId, setSheetSnapState]);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--card)] rounded-t-2xl border-t border-[var(--border)] md:hidden motion-reduce:transition-none"
      style={{
        height: '100dvh',
        transform: SNAP_TRANSLATE[sheetSnapState],
        transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
      }}
      data-testid="mobile-sheet"
      data-sheet-snap={sheetSnapState}
    >
      {/* Tab strip — 60px, toggle button + label */}
      <div
        className="flex items-center px-4 gap-2"
        style={{ height: 60 }}
        data-testid="sheet-drag-handle"
      >
        <button
          className="min-w-[44px] h-11 flex items-center justify-center rounded-md text-[var(--muted-foreground)] active:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
          onClick={() => setSheetSnapState(sheetSnapState === 'collapsed' ? 'full' : 'collapsed')}
          aria-label={sheetSnapState === 'collapsed' ? 'Open panel' : 'Close panel'}
        >
          {sheetSnapState === 'collapsed'
            ? <ChevronUp size={20} />
            : <ChevronDown size={20} />
          }
        </button>
        <span className="text-sm font-medium text-[var(--foreground)]">
          {selectedNodeId ? 'Cell Settings' : 'Canvas Settings'}
        </span>
      </div>

      {/* Sheet content — scrollable */}
      <div
        className="overflow-y-auto"
        style={{
          height: 'calc(100dvh - 60px - max(calc(env(safe-area-inset-top) + 56px), 72px))',
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
