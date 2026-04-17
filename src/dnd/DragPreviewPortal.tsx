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

export function DragPreviewPortal(): null {
  return null;
}
