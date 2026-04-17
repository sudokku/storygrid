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
 * canvasScale inside this function — `pointer.x - rect.left` is scale-
 * correct in viewport space throughout.
 *
 * Threshold formula (CANCEL-05): `Math.max(20, Math.min(w, h) * 0.2)`.
 *
 * Zone priority: top > bottom > left > right > center (edges beat center;
 * corners resolve to the top/bottom zone because Y-axis checks run first —
 * matches Phase 9 semantics preserved via STATE.md decision).
 *
 * Semantics at threshold boundaries are strict: `y < threshold` (NOT <=),
 * `y > h - threshold` (NOT >=). Pointer exactly at `y = threshold` resolves
 * to 'center', which means the center region is closed on its inner edges.
 */
import type { DropZone } from './dragStore';

export function computeDropZone(
  rect: DOMRect,
  pointer: { x: number; y: number },
): DropZone {
  const x = pointer.x - rect.left;
  const y = pointer.y - rect.top;
  const w = rect.width;
  const h = rect.height;
  const threshold = Math.max(20, Math.min(w, h) * 0.2);
  if (y < threshold) return 'top';
  if (y > h - threshold) return 'bottom';
  if (x < threshold) return 'left';
  if (x > w - threshold) return 'right';
  return 'center';
}
