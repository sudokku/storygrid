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
// Phase 28 gap-closure 28-11 — barrel exports the new MouseSensor/TouchSensor
// subclasses. Old PointerSensorMouse/PointerSensorTouch names removed (they
// caused listener-key collision under useSyntheticListeners — see
// .planning/debug/desktop-drag-dead.md).
export { CellDragMouseSensor, CellDragTouchSensor } from './adapter/dndkit';
