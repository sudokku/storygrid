/**
 * Ephemeral drag state store (REQ: DND-02).
 *
 * Vanilla Zustand — no middleware of any kind (no mutation tracking, no
 * storage, no history). Pointer-tick writes (60 Hz during an active drag
 * in Phase 28) are isolated from gridStore's undo history
 * (PITFALLS.md Pitfall 11).
 *
 * Shape (8 fields + 3 actions):
 *   status     : 'idle' | 'dragging'
 *   kind       : 'cell' | null
 *   sourceId   : string | null         (leaf id of the cell being dragged)
 *   overId     : string | null         (leaf id the pointer is currently over)
 *   activeZone : DropZone | null       (which of the 5 zones the pointer hit)
 *   ghostUrl   : string | null         (canvas.toDataURL() of source cell artwork)
 *   sourceW    : number                (source cell width in canvas pixels)
 *   sourceH    : number                (source cell height in canvas pixels)
 *
 * Actions:
 *   beginCellDrag(sourceId, ghostUrl, sourceW, sourceH)
 *                            status→'dragging', kind='cell', all 8 fields set
 *                            atomically; overId+activeZone reset to null (defensive)
 *   setOver(overId, zone)    overId+activeZone updated; status/kind/sourceId/
 *                            ghostUrl/sourceW/sourceH untouched; idempotent
 *   end()                    all 8 fields reset to initial; safe from any status
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
  ghostUrl: string | null;
  sourceW: number;
  sourceH: number;
  beginCellDrag: (sourceId: string, ghostUrl: string | null, sourceW: number, sourceH: number) => void;
  setOver: (overId: string | null, zone: DropZone | null) => void;
  end: () => void;
};

const INITIAL_STATE = {
  status: 'idle' as const,
  kind: null as DragKind,
  sourceId: null as string | null,
  overId: null as string | null,
  activeZone: null as DropZone | null,
  ghostUrl: null as string | null,
  sourceW: 0,
  sourceH: 0,
};

export const useDragStore = create<DragState>((set) => ({
  ...INITIAL_STATE,
  beginCellDrag: (sourceId, ghostUrl, sourceW, sourceH) =>
    set({ status: 'dragging', kind: 'cell', sourceId, overId: null, activeZone: null, ghostUrl, sourceW, sourceH }),
  setOver: (overId, activeZone) => set({ overId, activeZone }),
  end: () => set({ ...INITIAL_STATE }),
}));
