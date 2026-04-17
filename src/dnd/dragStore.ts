/**
 * Ephemeral drag state store (REQ: DND-02).
 *
 * Vanilla Zustand — plain create() with no middleware stack. Pointer-tick
 * writes (60 Hz during an active drag in Phase 28) are isolated from
 * gridStore's undo history (PITFALLS.md Pitfall 11; ARCHITECTURE.md §3).
 * The architectural absence of history / draft / storage middleware is
 * enforced by dragStore.test.ts via source-file negative assertions.
 *
 * Shape (7 fields + 4 actions):
 *   status       : 'idle' | 'dragging'
 *   kind         : 'cell' | null
 *   sourceId     : string | null          (leaf id of the cell being dragged)
 *   overId       : string | null          (leaf id the pointer is currently over)
 *   activeZone   : DropZone | null        (which of the 5 zones the pointer hit)
 *   ghostDataUrl : string | null          (Phase 28 / D-06 — canvas.toDataURL snapshot)
 *   sourceRect   : { width, height, left, top } | null
 *                                         (Phase 28 / D-06 — source cell viewport rect)
 *
 * Actions:
 *   beginCellDrag(sourceId)   status->'dragging', kind='cell', sourceId set,
 *                             overId+activeZone reset to null (defensive clean start).
 *                             Does NOT touch ghostDataUrl / sourceRect — the adapter
 *                             writes those via setGhost immediately after (D-06).
 *   setOver(overId, zone)     overId+activeZone updated; status/kind/sourceId
 *                             untouched; idempotent.
 *   setGhost(ghost, rect)     Phase 28 (D-06) — atomically sets ghostDataUrl + sourceRect.
 *                             Called by the dnd-kit adapter in onDragStart after
 *                             canvas.toDataURL(). Passing (null, null) clears both.
 *   end()                     all 7 fields reset to initial; safe from any status.
 */
import { create } from 'zustand';

export type DragKind = 'cell' | null;
export type DropZone = 'center' | 'top' | 'bottom' | 'left' | 'right';
export type DragStatus = 'idle' | 'dragging';

export type DragState = {
  status: DragStatus;
  kind: DragKind;
  sourceId: string | null;
  overId: string | null;
  activeZone: DropZone | null;
  ghostDataUrl: string | null;
  sourceRect: { width: number; height: number; left: number; top: number } | null;
  beginCellDrag: (sourceId: string) => void;
  setOver: (overId: string | null, zone: DropZone | null) => void;
  setGhost: (ghostDataUrl: string | null, sourceRect: DragState['sourceRect']) => void;
  end: () => void;
};

const INITIAL_STATE = {
  status: 'idle' as const,
  kind: null,
  sourceId: null,
  overId: null,
  activeZone: null,
  ghostDataUrl: null,
  sourceRect: null,
};

export const useDragStore = create<DragState>((set) => ({
  ...INITIAL_STATE,
  beginCellDrag: (sourceId) =>
    set({ status: 'dragging', kind: 'cell', sourceId, overId: null, activeZone: null }),
  setOver: (overId, activeZone) => set({ overId, activeZone }),
  setGhost: (ghostDataUrl, sourceRect) => set({ ghostDataUrl, sourceRect }),
  end: () => set({ ...INITIAL_STATE }),
}));
