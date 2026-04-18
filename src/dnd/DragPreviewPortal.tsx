/**
 * Ghost portal rendered into viewport space via @dnd-kit/core's DragOverlay
 * (REQ: GHOST-04, GHOST-05, GHOST-06).
 *
 * Renders the cell's canvas.toDataURL() snapshot as an <img> during drag.
 * Mounts outside the scaled canvas so there is no double-scale
 * (ARCHITECTURE.md §5; PITFALLS.md Pitfall 9 — never cloneNode on a canvas).
 *
 * GHOST-04 / GHOST-05: DragOverlay renders in viewport space via
 * createPortal(document.body) — outside the scaled canvas-surface. No scale
 * compensation is applied; dnd-kit's viewport-space transform is used as-is.
 * Any residual drift at non-1x canvasScale is absorbed by
 * MeasuringStrategy.Always on DndContext (gap-closure plan 28-12 — see
 * .planning/debug/touch-drag-unreliable.md for the misdiagnosis history).
 *
 * Gap-closure 28-15 (spec change): ghost dimensions are CAPPED at
 * GHOST_MAX_DIMENSION=200 on both axes with aspect ratio preserved via a
 * single uniform scale. This addresses the 28-UAT Gap 2 complaint
 * ("ghost too large — hides drop zones underneath on big cells"). See
 * .planning/phases/28-cell-to-cell-drag/28-UAT.md Gap 2 and the
 * ### Gap-Closure Plan 28-15 subsection in 28-VERIFICATION.md.
 *
 * Phase 27 ships this as a skeleton that renders null; Phase 28 wires it
 * to DragOverlay and the dragStore ghost-dataURL field.
 */

import { DragOverlay } from '@dnd-kit/core';
import { useDragStore } from './dragStore';

/**
 * Gap-closure 28-15: hard cap on ghost dimensions to prevent large source
 * cells from occluding drop zones + accent-ring indicators underneath the
 * ghost. 200px is roughly 1/4 of a typical mobile-viewport-width cell and
 * ~1/4 of a desktop canvas cell — visible enough to convey identity,
 * small enough to keep the target visuals visible. Retune here if UAT
 * re-confirmation prefers a different value. See 28-UAT.md Gap 2.
 */
export const GHOST_MAX_DIMENSION = 200;

/**
 * Pure helper — exported for unit testing. Returns ghost dimensions capped
 * to `max` on both axes with aspect ratio preserved via a single uniform
 * scale factor: scale = min(1, max/width, max/height).
 *
 *   - if both source axes fit inside the cap, scale = 1 → natural size.
 *   - otherwise the constraining axis hits the cap exactly and the other
 *     axis shrinks by the same factor.
 *
 * Examples (max=200):
 *   { width: 100, height: 150 } → { width: 100, height: 150 }  (scale=1)
 *   { width: 400, height: 800 } → { width: 100, height: 200 }  (scale=0.25)
 *   { width: 800, height: 100 } → { width: 200, height: 25 }   (scale=0.25)
 *   { width: 300, height: 300 } → { width: 200, height: 200 }  (scale=0.667)
 */
export function computeCappedGhostSize(
  sourceRect: { width: number; height: number },
  max: number,
): { width: number; height: number } {
  const scale = Math.min(1, max / sourceRect.width, max / sourceRect.height);
  return {
    width: sourceRect.width * scale,
    height: sourceRect.height * scale,
  };
}

export function DragPreviewPortal() {
  // Scoped primitive selectors — only re-render this portal when ghost state
  // changes (ARCHITECTURE.md §3). Avoid object-returning selectors that would
  // require useShallow.
  const status = useDragStore((s) => s.status);
  const ghostDataUrl = useDragStore((s) => s.ghostDataUrl);
  const sourceRect = useDragStore((s) => s.sourceRect);

  // Narrow sourceRect to non-null before destructuring width/height below.
  const active = status === 'dragging' && sourceRect !== null;

  // Gap-closure 28-15: compute capped dimensions once and reuse for both
  // branches (img for ghostDataUrl-present, div for D-10 empty-cell fallback).
  const capped = active
    ? computeCappedGhostSize(sourceRect, GHOST_MAX_DIMENSION)
    : null;

  return (
    <DragOverlay adjustScale={false}>
      {active && capped ? (
        ghostDataUrl ? (
          <img
            src={ghostDataUrl}
            style={{
              width: capped.width,
              height: capped.height,
              maxWidth: GHOST_MAX_DIMENSION,
              maxHeight: GHOST_MAX_DIMENSION,
              opacity: 0.8,
              display: 'block',
              objectFit: 'cover',
            }}
            alt=""
            draggable={false}
            data-testid="drag-ghost-img"
          />
        ) : (
          // D-10: empty-cell fallback — no canvas snapshot available, render a
          // dark div at source dims rather than a broken <img>. Cap applied
          // here too (gap-closure 28-15) so large empty cells also get a
          // sensible preview size.
          <div
            className="bg-[#1c1c1c]"
            style={{
              width: capped.width,
              height: capped.height,
              maxWidth: GHOST_MAX_DIMENSION,
              maxHeight: GHOST_MAX_DIMENSION,
              opacity: 0.8,
            }}
            data-testid="drag-ghost-fallback"
          />
        )
      ) : null}
    </DragOverlay>
  );
}
