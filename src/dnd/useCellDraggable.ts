/**
 * Hook: marks a leaf cell as a drag source (REQ: DRAG-07, GHOST-01).
 *
 * ───────────────────────────────────────────────────────────────────────
 * PITFALL 1 — SPREAD LISTENERS LAST ON THE JSX ELEMENT.
 * ───────────────────────────────────────────────────────────────────────
 * React writes props in the order they appear in JSX. If this component
 * returns `{...listeners}` and the consumer places it BEFORE explicit
 * handlers like `onPointerDown`, the explicit handler silently overwrites
 * the dnd-kit listener and drag never fires. Phase 25's "drag fires once
 * in 10 times" symptom was exactly this (PITFALLS.md Root Cause).
 *
 * Correct:   <div onPointerDown={handlePan} {...listeners} />   ← spread LAST
 * Incorrect: <div {...listeners} onPointerDown={handlePan} />   ← spread first = BROKEN
 *
 * When this hook ships its real implementation in Phase 28, the returned
 * `listeners` object MUST be documented at its call site with this rule.
 *
 * Implementation: Phase 28 — wires useDraggable from @dnd-kit/core and
 * captures `canvas.toDataURL()` ghost snapshot on drag-start.
 */

export type UseCellDraggableResult = {
  // Phase 28 fills this in against the @dnd-kit/core useDraggable return type.
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown>;
  isDragging: boolean;
  setNodeRef: (node: HTMLElement | null) => void;
};

export function useCellDraggable(_leafId: string): UseCellDraggableResult {
  throw new Error('useCellDraggable: implementation lands in Phase 28');
}
