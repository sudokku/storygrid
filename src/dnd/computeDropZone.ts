/**
 * Pure drop-zone resolver (REQ: DROP-06, CANCEL-05).
 *
 * Per-axis threshold aligned with DropZoneIndicators.tsx band geometry:
 *   yThreshold = max(20, h * 0.2)   — matches height: 20% top/bottom bands
 *   xThreshold = max(20, w * 0.2)   — matches width: 20% left/right bands
 *
 * Rationale: `DropZoneIndicators` renders edge bands at 20% of each axis
 * independently. Under the earlier shorter-axis formula
 * (threshold = max(20, min(w,h) * 0.2)), a non-square cell (e.g. 100w × 300h)
 * created a dead-band where the user aimed at a visible edge arrow (inside
 * the 60px-tall visible top band) but compute returned 'center' (threshold
 * was 20px). Gap 2 from 28-HUMAN-UAT ("extend zones very buggy"). Fixed by
 * aligning compute to the per-axis indicator geometry — the indicators are
 * the visual truth the user aims at.
 *
 * CRITICAL (ARCHITECTURE.md Anti-Pattern 3): `getBoundingClientRect()` already
 * accounts for ancestor `transform: scale()`. Do NOT divide by canvasScale
 * inside this function — `pointer.x - rect.left` is scale-correct in viewport
 * space throughout.
 *
 * Zone priority: top > bottom > left > right > center (edges beat center;
 * corners resolve to top/bottom because Y-axis checks run first — matches
 * Phase 9 semantics preserved via STATE.md decision).
 *
 * Strict semantics at threshold boundaries: `y < yThreshold` (NOT <=),
 * `y > h - yThreshold` (NOT >=). Pointer exactly at `y = yThreshold` resolves
 * to 'center' — center is closed on its inner edges.
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
  // Per-axis thresholds aligned with DropZoneIndicators.tsx band geometry:
  //   top/bottom bands: height: 20%  → yThreshold = h * 0.2
  //   left/right bands: width: 20%   → xThreshold = w * 0.2
  // 20px floor preserves degenerate-small-cell behavior (CANCEL-05 compatible).
  const yThreshold = Math.max(20, h * 0.2);
  const xThreshold = Math.max(20, w * 0.2);
  // Zone priority (unchanged): top > bottom > left > right > center.
  // Strict-less-than / strict-greater-than preserved so center is closed on its inner edges.
  if (y < yThreshold) return 'top';
  if (y > h - yThreshold) return 'bottom';
  if (x < xThreshold) return 'left';
  if (x > w - xThreshold) return 'right';
  return 'center';
}
