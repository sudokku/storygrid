/**
 * Pure drop-zone resolver (REQ: DROP-06, CANCEL-05).
 *
 * Given a cell's viewport-space rect and a pointer position (also in
 * viewport space), returns which of the 5 zones the pointer is inside.
 * Zones fully tile the cell — no dead space (CANCEL-05). Pointer at the
 * exact center resolves to 'center'.
 *
 * CRITICAL (ARCHITECTURE.md Anti-Pattern 3): `getBoundingClientRect()`
 * already accounts for ancestor `transform: scale()`. Do NOT divide by
 * canvasScale inside this function — pointer.x - rect.left is scale-
 * correct in viewport space throughout.
 *
 * Threshold formula (CANCEL-05): Math.max(20, Math.min(w, h) * 0.2).
 *
 * Implementation: Plan 02 (27-02-PLAN.md) — RED→GREEN via
 * computeDropZone.test.ts (5-zone table at scales 0.2/0.5/1.0, boundary,
 * property-based no-dead-space).
 */
import type { DropZone } from './dragStore';

export function computeDropZone(
  _rect: DOMRect,
  _pointer: { x: number; y: number },
): DropZone {
  throw new Error('computeDropZone: implementation lands in Phase 27 Plan 02');
}
