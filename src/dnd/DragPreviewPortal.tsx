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
 * By default @dnd-kit centres the DragOverlay on the original drag node — the
 * overlay's top-left coincides with the source rect's top-left and the overlay
 * is then translated by `transform.{x,y}` (which is the pointer delta from the
 * activator event). That centres the overlay on the source rect, NOT on the
 * grab point. The result: when the user grabs a cell near its corner, the
 * ghost "snaps" so the corner is no longer under the pointer.
 *
 * To preserve the grab-point offset, we shift the transform by the delta
 * between (a) where the pointer was when the drag started (activatorEvent
 * client coords) and (b) the centre of the source rect. The overlay then
 * sits so the pointer stays on the same sub-pixel position within the ghost
 * for the entire drag.
 *
 * Signature: Modifier = (args: ModifierArguments<object>) => Transform
 */
export const grabOffsetModifier: Modifier = ({
  transform,
  activatorEvent,
  draggingNodeRect,
}) => {
  if (!activatorEvent || !draggingNodeRect) return transform;
  const ev = activatorEvent as PointerEvent | MouseEvent | TouchEvent;
  // Resolve client coords across pointer/mouse/touch events.
  let clientX: number | undefined;
  let clientY: number | undefined;
  if ('clientX' in ev && typeof ev.clientX === 'number') {
    clientX = ev.clientX;
    clientY = (ev as PointerEvent).clientY;
  } else if ('touches' in ev && ev.touches.length > 0) {
    clientX = ev.touches[0].clientX;
    clientY = ev.touches[0].clientY;
  }
  if (clientX === undefined || clientY === undefined) return transform;

  // Offset of the pointer within the source rect at drag-start.
  const offsetX = clientX - draggingNodeRect.left;
  const offsetY = clientY - draggingNodeRect.top;
  // Delta between grab point and rect centre (which is where the overlay is
  // anchored by default).
  const centreDeltaX = offsetX - draggingNodeRect.width / 2;
  const centreDeltaY = offsetY - draggingNodeRect.height / 2;

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

  return (
    <DragOverlay dropAnimation={null} modifiers={[grabOffsetModifier]}>
      {isDragging && ghostUrl ? (
        <img
          src={ghostUrl}
          width={sourceW}
          height={sourceH}
          style={{
            // Phase 28 keeps ghost fully opaque. GHOST-03 (80% opacity) is owned by Phase 29.
            opacity: 1,
            display: 'block',
            pointerEvents: 'none',
            width: `${sourceW}px`,
            height: `${sourceH}px`,
          }}
          alt=""
          draggable={false}
        />
      ) : null}
    </DragOverlay>
  );
}
