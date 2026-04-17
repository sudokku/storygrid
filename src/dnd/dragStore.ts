/**
 * Ephemeral drag state store (REQ: DND-02).
 *
 * Vanilla Zustand — plain create() with no middleware stack. Pointer-tick
 * writes (60 Hz during an active drag in Phase 28) are isolated from
 * gridStore's undo history (PITFALLS.md Pitfall 11; ARCHITECTURE.md §3).
 * The architectural absence of history / draft / storage middleware is
 * enforced by dragStore.test.ts via source-file negative assertions.
 *
 * Shape (5 fields + 3 actions):
 *   status     : 'idle' | 'dragging'
 *   kind       : 'cell' | null
 *   sourceId   : string | null         (leaf id of the cell being dragged)
 *   overId     : string | null         (leaf id the pointer is currently over)
 *   activeZone : DropZone | null       (which of the 5 zones the pointer hit)
 *
 * Actions:
 *   beginCellDrag(sourceId)  status->'dragging', kind='cell', sourceId set,
 *                            overId+activeZone reset to null (defensive clean start)
 *   setOver(overId, zone)    overId+activeZone updated; status/kind/sourceId
 *                            untouched; idempotent
 *   end()                    all 5 fields reset to initial; safe from any status
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
  beginCellDrag: (sourceId: string) => void;
  setOver: (overId: string | null, zone: DropZone | null) => void;
  end: () => void;
};

const INITIAL_STATE = {
  status: 'idle' as const,
  kind: null,
  sourceId: null,
  overId: null,
  activeZone: null,
};

export const useDragStore = create<DragState>((set) => ({
  ...INITIAL_STATE,
  beginCellDrag: (sourceId) =>
    set({ status: 'dragging', kind: 'cell', sourceId, overId: null, activeZone: null }),
  setOver: (overId, activeZone) => set({ overId, activeZone }),
  end: () => set({ ...INITIAL_STATE }),
}));
