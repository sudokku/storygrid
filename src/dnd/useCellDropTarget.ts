/**
 * Hook: marks a leaf cell as a drop target (REQ: DROP-01, DROP-04, DROP-06).
 *
 * In Phase 28 this hook uses `useDroppable` from @dnd-kit/core and — inside
 * the onDragOver callback — calls `computeDropZone(element.getBoundingClientRect(),
 * pointer)` then `useDragStore.getState().setOver(leafId, zone)`.
 *
 * IMPORTANT (PITFALLS.md Pitfall 2): Pointer coords come ONLY from dnd-kit's
 * callback argument. Do NOT attach a document-level pointermove listener
 * and do NOT derive coords from a parallel source — Phase 25's 5-zone
 * flakiness was caused by two event sources dispatched out-of-order by one
 * frame. Single event source = single truth.
 *
 * Implementation: Phase 28.
 */

import { useDroppable } from '@dnd-kit/core';
import { useDragStore } from './dragStore';

export type UseCellDropTargetResult = {
  isOver: boolean;
  setNodeRef: (node: HTMLElement | null) => void;
};

export function useCellDropTarget(leafId: string): UseCellDropTargetResult {
  const { setNodeRef } = useDroppable({
    id: leafId,
    data: { nodeId: leafId, kind: 'cell' },
  });
  // PITFALL 2 prevention: derive isOver from the single dragStore source,
  // NOT from useDroppable's own isOver flag (which is fine but we want a
  // single source of truth so all consumers read the same value).
  const isOver = useDragStore((s) => s.overId === leafId && s.status === 'dragging');
  return { setNodeRef, isOver };
}
