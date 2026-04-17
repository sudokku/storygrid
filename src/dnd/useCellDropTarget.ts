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

export type UseCellDropTargetResult = {
  isOver: boolean;
  setNodeRef: (node: HTMLElement | null) => void;
};

export function useCellDropTarget(_leafId: string): UseCellDropTargetResult {
  throw new Error('useCellDropTarget: implementation lands in Phase 28');
}
