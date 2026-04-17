/**
 * Ephemeral drag state store (REQ: DND-02).
 *
 * This is a VANILLA Zustand store — no Immer middleware, no persist, no
 * history — so 60 Hz pointer-tick writes never enter gridStore's undo
 * history (PITFALLS.md Pitfall 11; ARCHITECTURE.md §3).
 *
 * Implementation: Plan 03 (27-03-PLAN.md) — RED→GREEN via dragStore.test.ts.
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

// Plan 03 replaces this stub with the real store. Until then, attempting
// to use the store throws to prevent accidental consumption from Phase 28
// work that forks ahead of Plan 03.
export const useDragStore = create<DragState>(() => {
  throw new Error('dragStore: implementation lands in Phase 27 Plan 03');
});
