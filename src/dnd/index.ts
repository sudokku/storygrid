// Public API barrel for the v1.5 DnD module (REQ: DND-03).
// All DnD consumers import from 'src/dnd' — never directly from sub-files —
// so the adapter implementation can be swapped without churning call sites.

export { useDragStore } from './dragStore';
export type { DragKind, DropZone, DragStatus } from './dragStore';
export { computeDropZone } from './computeDropZone';
export { useCellDraggable } from './useCellDraggable';
export { useCellDropTarget } from './useCellDropTarget';
export { DragPreviewPortal } from './DragPreviewPortal';
export { DropZoneIndicators } from './DropZoneIndicators';
