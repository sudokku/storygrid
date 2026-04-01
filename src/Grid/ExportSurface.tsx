import React from 'react';
import { useGridStore } from '../store/gridStore';
import { ExportModeContext } from './ExportModeContext';
import { GridNodeComponent } from './GridNode';

interface ExportSurfaceProps {
  exportRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * ExportSurface — always-mounted, always-hidden 1080x1920 export container.
 * Positioned off-screen (left: -9999px) with visibility:hidden so it never
 * appears in the viewport but is always available for html-to-image capture.
 *
 * Wraps GridNodeComponent in ExportModeContext.Provider value={true} to
 * suppress interactive UI (ActionBar, Dividers, selection rings) in the
 * exported image.
 *
 * Per EXPO-07: always present in EditorShell DOM — never conditionally rendered.
 */
export function ExportSurface({ exportRef }: ExportSurfaceProps) {
  const rootId = useGridStore(s => s.root.id);
  return (
    <div
      ref={exportRef}
      style={{
        position: 'absolute',
        left: -9999,
        top: 0,
        width: 1080,
        height: 1920,
        visibility: 'hidden',
        overflow: 'hidden',
      }}
      aria-hidden="true"
      data-testid="export-surface"
    >
      <ExportModeContext.Provider value={true}>
        <GridNodeComponent id={rootId} />
      </ExportModeContext.Provider>
    </div>
  );
}
