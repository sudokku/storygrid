// Public API barrel for the v1.5 DnD module (REQ: DND-03).
// All DnD consumers import from 'src/dnd' — never directly from sub-files —
// so the adapter implementation can be swapped without churning call sites.

export { useDragStore } from './dragStore';
export type { DragKind, DropZone, DragStatus, DragState } from './dragStore';
export { computeDropZone } from './computeDropZone';
export { useCellDraggable } from './useCellDraggable';
export { useCellDropTarget } from './useCellDropTarget';
export { DragPreviewPortal } from './DragPreviewPortal';
export { DropZoneIndicators } from './DropZoneIndicators';
// Phase 28 Plan 10b — barrel completion (Rule 3 fix): PointerSensorMouse /
// PointerSensorTouch must be accessible via the public barrel so consumers
// (CanvasWrapper, tests) can import the sensor classes from `src/dnd` without
// reaching into the adapter sub-path. They already exist in
// `./adapter/dndkit`; Plan 07 added them but forgot to re-export.
export { PointerSensorMouse, PointerSensorTouch } from './adapter/dndkit';
