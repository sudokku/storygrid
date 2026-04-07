import { useLayoutEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '../store/editorStore';
import { useGridStore } from '../store/gridStore';
import { findNode } from '../lib/tree';
import { getCellElement } from '../lib/cellRegistry';
import { ActionBar } from '../Grid/ActionBar';
import type { LeafNode } from '../types';

/**
 * GlobalActionBar — single portal-mounted ActionBar.
 *
 * Driven by `hoveredNodeId` from the editor store (hover-only per locked D-01,
 * no selection fallback). Renders into `document.body` to escape every
 * stacking context, transform containing block, and overflow:hidden ancestor
 * in the grid tree in one move.
 *
 * Position is computed via `getBoundingClientRect()` on the cell element looked
 * up from the `cellRegistry`, and recalculated on:
 *   - cell resize (ResizeObserver)
 *   - window scroll / resize
 *   - any gridStore update (divider drag, split, merge, media change)
 *   - any editorStore update (zoom, pan mode, hovered-id change)
 */
export function GlobalActionBar() {
  const hoveredNodeId = useEditorStore(s => s.hoveredNodeId);
  const panModeNodeId = useEditorStore(s => s.panModeNodeId);

  // Hover-only per locked D-01 — no `selectedNodeId` fallback.
  const activeId = hoveredNodeId;
  const suppressed = activeId != null && panModeNodeId === activeId;

  const node = useGridStore(s => (activeId ? findNode(s.root, activeId) : null));

  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!activeId || suppressed) {
      setRect(null);
      return;
    }
    const el = getCellElement(activeId);
    if (!el) {
      setRect(null);
      return;
    }

    const update = () => setRect(el.getBoundingClientRect());
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('scroll', update, true); // capture phase for nested scrollers
    window.addEventListener('resize', update);

    // Recompute on any grid mutation (divider drag, split/merge, media change)
    const unsubGrid = useGridStore.subscribe(update);
    // Recompute on any editor state change (zoom, canvasScale, etc.)
    const unsubEditor = useEditorStore.subscribe(update);

    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      unsubGrid();
      unsubEditor();
    };
  }, [activeId, suppressed]);

  const handleUploadClick = useCallback(() => {
    if (!activeId) return;
    const el = getCellElement(activeId);
    const input = el?.querySelector<HTMLInputElement>('input[type=file]');
    input?.click();
  }, [activeId]);

  if (!rect || !node || node.type !== 'leaf' || suppressed) return null;

  const leaf = node as LeafNode;

  return createPortal(
    <div
      className="hidden md:block pointer-events-auto"
      style={{
        position: 'fixed',
        top: Math.max(8, rect.top - 44),
        left: rect.left + rect.width / 2,
        transform: 'translateX(-50%)',
        zIndex: 1000,
      }}
      onPointerEnter={() => useEditorStore.getState().setHoveredNode(activeId)}
    >
      <ActionBar
        nodeId={activeId!}
        fit={leaf.fit}
        hasMedia={!!leaf.mediaId}
        onUploadClick={handleUploadClick}
      />
    </div>,
    document.body
  );
}
