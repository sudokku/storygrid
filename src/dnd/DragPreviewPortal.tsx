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
import { useDragStore } from './dragStore';
import { scaleCompensationModifier } from './adapter/dndkit';

export function DragPreviewPortal() {
  // Scoped primitive selectors — only re-render this portal when ghost state
  // changes (ARCHITECTURE.md §3). Avoid object-returning selectors that would
  // require useShallow.
  const status = useDragStore((s) => s.status);
  const ghostDataUrl = useDragStore((s) => s.ghostDataUrl);
  const sourceRect = useDragStore((s) => s.sourceRect);

  // Narrow sourceRect to non-null before destructuring width/height below.
  const active = status === 'dragging' && sourceRect !== null;

  return (
    <DragOverlay adjustScale={false} modifiers={[scaleCompensationModifier]}>
      {active ? (
        ghostDataUrl ? (
          <img
            src={ghostDataUrl}
            style={{
              width: sourceRect.width,
              height: sourceRect.height,
              opacity: 0.8,
              display: 'block',
            }}
            alt=""
            draggable={false}
            data-testid="drag-ghost-img"
          />
        ) : (
          // D-10: empty-cell fallback — no canvas snapshot available, render a
          // dark div at source dims rather than a broken <img>.
          <div
            className="bg-[#1c1c1c]"
            style={{
              width: sourceRect.width,
              height: sourceRect.height,
              opacity: 0.8,
            }}
            data-testid="drag-ghost-fallback"
          />
        )
      ) : null}
    </DragOverlay>
  );
}
