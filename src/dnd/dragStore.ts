/**
 * Ephemeral drag state store (REQ: DND-02).
 *
 * Vanilla Zustand — no middleware of any kind (no mutation tracking, no
 * storage, no history). Pointer-tick writes (60 Hz during an active drag
 * in Phase 28) are isolated from gridStore's undo history
 * (PITFALLS.md Pitfall 11).
 *
 * Shape (12 fields + 6 actions):
 *   status           : 'idle' | 'dragging'
 *   kind             : 'cell' | null
 *   sourceId         : string | null         (leaf id of the cell being dragged)
 *   overId           : string | null         (leaf id the pointer is currently over)
 *   activeZone       : DropZone | null       (which of the 5 zones the pointer hit)
 *   ghostUrl         : string | null         (canvas.toDataURL() of source cell artwork)
 *   sourceW          : number                (source cell width in canvas pixels)
 *   sourceH          : number                (source cell height in canvas pixels)
 *   pointerDownX     : number               (pointer clientX at onPointerDown; 0 if not set)
 *   pointerDownY     : number               (pointer clientY at onPointerDown; 0 if not set)
 *   lastDropId       : string | null       (cell id of the last successful drop; drives flash)
 *   prevSheetSnapState: 'collapsed' | 'full' | null  (saved before collapse on drag start; restored on end)
 *
 * Actions:
 *   beginCellDrag(sourceId, ghostUrl, sourceW, sourceH)
 *                            Saves editorStore.sheetSnapState to prevSheetSnapState,
 *                            collapses the sheet (CROSS-08b), then sets status→'dragging',
 *                            kind='cell', all 8 fields atomically; overId+activeZone reset
 *                            to null (defensive).
 *   setOver(overId, zone)    overId+activeZone updated; status/kind/sourceId/
 *                            ghostUrl/sourceW/sourceH untouched; idempotent
 *   end()                    Reads prevSheetSnapState BEFORE reset (Pitfall 2), restores
 *                            editorStore.sheetSnapState if non-null, then resets all 12
 *                            fields to initial; safe from any status
 *   setPointerDown(x, y)     pointerDownX/Y updated; used by grabOffsetModifier
 *   setLastDrop(id)          lastDropId set; triggers drop-flash on that cell
 *   clearLastDrop()          lastDropId reset to null; called after 700ms timeout
 */
import { create } from 'zustand';
import { useEditorStore } from '../store/editorStore';

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
  pointerDownX: number;
  pointerDownY: number;
  lastDropId: string | null;
  prevSheetSnapState: 'collapsed' | 'full' | null;
  beginCellDrag: (sourceId: string, ghostUrl: string | null, sourceW: number, sourceH: number) => void;
  setOver: (overId: string | null, zone: DropZone | null) => void;
  end: () => void;
  setPointerDown: (x: number, y: number) => void;
  setLastDrop: (id: string) => void;
  clearLastDrop: () => void;
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
  pointerDownX: 0,
  pointerDownY: 0,
  lastDropId: null as string | null,
  prevSheetSnapState: null as 'collapsed' | 'full' | null,
};

export const useDragStore = create<DragState>((set) => ({
  ...INITIAL_STATE,
  beginCellDrag: (sourceId, ghostUrl, sourceW, sourceH) => {
    // CROSS-08: save current sheet snap state before collapsing (D-01)
    const prevSnap = useEditorStore.getState().sheetSnapState;
    useEditorStore.getState().setSheetSnapState('collapsed');
    set({
      status: 'dragging',
      kind: 'cell',
      sourceId,
      overId: null,
      activeZone: null,
      ghostUrl,
      sourceW,
      sourceH,
      prevSheetSnapState: prevSnap,
    });
  },
  setOver: (overId, activeZone) => set({ overId, activeZone }),
  end: () => {
    // CROSS-08: restore sheet snap state before resetting (Pitfall 2: read BEFORE set)
    const { prevSheetSnapState } = useDragStore.getState();
    if (prevSheetSnapState !== null) {
      useEditorStore.getState().setSheetSnapState(prevSheetSnapState);
    }
    set({ ...INITIAL_STATE });
  },
  setPointerDown: (x, y) => set({ pointerDownX: x, pointerDownY: y }),
  setLastDrop: (id) => set({ lastDropId: id }),
  clearLastDrop: () => set({ lastDropId: null }),
}));
