/**
 * Ghost portal rendered into viewport space via @dnd-kit/core's DragOverlay
 * (REQ: GHOST-01, GHOST-04, GHOST-05, GHOST-06).
 *
 * Renders the cell's canvas.toDataURL() snapshot as an <img> during drag.
 * Mounts outside the scaled canvas so there is no double-scale
 * (ARCHITECTURE.md §5; PITFALLS.md Pitfall 9 — never cloneNode on a canvas).
 *
 * Phase 27 ships this as a skeleton that renders null; Phase 28 wires it
 * to DragOverlay and the dragStore ghost-dataURL field.
 */

import { DragOverlay } from '@dnd-kit/core';
import type { Modifier } from '@dnd-kit/core';
import { useDragStore } from './dragStore';

/**
 * GHOST-02: grab-point offset modifier.
 *
 * D-01/D-02: reads pointer coords stored at true onPointerDown time from
 * dragStore instead of activatorEvent. Using activatorEvent coords would give
 * the position after the 8px/250ms sensor threshold fires — too late.
 * pointerDownX/Y are set in LeafNode's handlePointerDown before the sensor
 * activates, preserving the true grab-point for the entire drag.
 *
 * Guard: keyboard-initiated drags fire no pointer event — coords stay 0
 * and the transform is returned unchanged (overlay stays centred, which is
 * correct for keyboard nav).
 *
 * Signature: Modifier = (args: ModifierArguments<object>) => Transform
 */
export const grabOffsetModifier: Modifier = ({
  transform,
  draggingNodeRect,
}) => {
  if (!draggingNodeRect) return transform;
  // D-01/D-02: read pointer coords stored at true onPointerDown time.
  // Using activatorEvent coords would give the position after the 8px/250ms
  // sensor threshold fires — too late. pointerDownX/Y are set in LeafNode's
  // handlePointerDown before the sensor activates.
  const { pointerDownX, pointerDownY, sourceW, sourceH } = useDragStore.getState();
  // Guard: keyboard-initiated drags fire no pointer event → coords stay 0.
  if (pointerDownX === 0 && pointerDownY === 0) return transform;

  const offsetX = pointerDownX - draggingNodeRect.left;
  const offsetY = pointerDownY - draggingNodeRect.top;

  // Ghost is CSS-capped at --ghost-cap (200px). Compute scale so the grab
  // fraction maps to ghost-space rather than source-rect-space. Without this,
  // clicks near the bottom-right of large cells shift proportionally further off
  // because the unscaled offset overshoots the smaller ghost dimensions.
  const CAP = 200;
  const ghostScale =
    sourceW > 0 && sourceH > 0 ? Math.min(CAP / sourceW, CAP / sourceH, 1) : 1;
  const ghostW = sourceW * ghostScale;
  const ghostH = sourceH * ghostScale;
  const ghostOffsetX =
    draggingNodeRect.width > 0 ? (offsetX / draggingNodeRect.width) * ghostW : offsetX;
  const ghostOffsetY =
    draggingNodeRect.height > 0 ? (offsetY / draggingNodeRect.height) * ghostH : offsetY;

  // Delta from ghost centre to the grab point (DragOverlay anchors at centre).
  const centreDeltaX = ghostOffsetX - ghostW / 2;
  const centreDeltaY = ghostOffsetY - ghostH / 2;

  return {
    ...transform,
    x: transform.x + centreDeltaX,
    y: transform.y + centreDeltaY,
  };
};

export function DragPreviewPortal() {
  const ghostUrl = useDragStore((s) => s.ghostUrl);
  const sourceW = useDragStore((s) => s.sourceW);
  const sourceH = useDragStore((s) => s.sourceH);
  const isDragging = useDragStore((s) => s.status === 'dragging');

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Replicate grabOffsetModifier's scale so ghost renders at identical dimensions.
  // Without this, Tailwind axis caps (max-w/max-h) could clip each axis independently,
  // making the rendered ghost differ from the modifier's ghostW/ghostH — causing a shift.
  const CAP = 200;
  const ghostScale =
    sourceW > 0 && sourceH > 0 ? Math.min(CAP / sourceW, CAP / sourceH, 1) : 1;
  const ghostW = sourceW * ghostScale;
  const ghostH = sourceH * ghostScale;

  return (
    <DragOverlay
      dropAnimation={prefersReducedMotion ? null : { duration: 200, easing: 'ease-in' }}
      modifiers={[grabOffsetModifier]}
    >
      {isDragging && ghostUrl ? (
        <img
          src={ghostUrl}
          width={sourceW}
          height={sourceH}
          style={{
            // D-05: 20% opacity so drop-zone indicators show through the ghost.
            opacity: 0.2,
            display: 'block',
            pointerEvents: 'none',
            width: `${ghostW}px`,
            height: `${ghostH}px`,
          }}
          alt=""
          draggable={false}
        />
      ) : null}
    </DragOverlay>
  );
}
