---
phase: 28
plan: 02
subsystem: dnd
tags: [hooks, dnd-kit, drag-preview, drop-zone-indicators, ghost-modifier]
dependency_graph:
  requires: [dragStore.ghostUrl, dragStore.sourceW, dragStore.sourceH, beginCellDrag-4arg]
  provides: [useCellDraggable, useCellDropTarget, DragPreviewPortal, grabOffsetModifier, DropZoneIndicators]
  affects:
    - src/dnd/useCellDraggable.ts
    - src/dnd/useCellDropTarget.ts
    - src/dnd/DragPreviewPortal.tsx
    - src/dnd/DropZoneIndicators.tsx
tech_stack:
  added: []
  patterns: [useDraggable-wrapper, useDroppable-wrapper, DragOverlay-ghost, dnd-kit-modifier, zustand-selector]
key_files:
  created: []
  modified:
    - src/dnd/useCellDraggable.ts
    - src/dnd/useCellDropTarget.ts
    - src/dnd/DragPreviewPortal.tsx
    - src/dnd/DropZoneIndicators.tsx
decisions:
  - grabOffsetModifier lives in DragPreviewPortal.tsx — single owner of overlay positioning (D-01)
  - isOver derived from dragStore.overId (not useDroppable's own isOver) for single truth source
  - opacity: 1 in ghost — GHOST-03 (80%) deferred to Phase 29 per CONTEXT.md domain block
  - dropAnimation={null} disables default dnd-kit drop animation until Phase 29 owns snap-back
  - iconSize = 32 / Math.max(canvasScale, 0.0001) guards against zero-canvasScale division
metrics:
  duration: ~7 minutes
  completed: "2026-04-18"
  tasks: 2
  files: 4
---

# Phase 28 Plan 02: DnD Hook and Component Implementations Summary

Replaced all four `src/dnd/` stubs with real implementations: `useCellDraggable` wrapping `@dnd-kit/core useDraggable`, `useCellDropTarget` wrapping `useDroppable` with dragStore-derived `isOver`, `DragPreviewPortal` rendering a `DragOverlay` ghost `<img>` with the GHOST-02 grab-offset modifier, and `DropZoneIndicators` rendering 5 lucide-react directional/swap icons with pointer-events-none.

## What Was Built

### Task 1: useCellDraggable and useCellDropTarget

**`src/dnd/useCellDraggable.ts`**
- Wraps `useDraggable({ id: leafId, data: { nodeId: leafId, kind: 'cell' } })` from `@dnd-kit/core`
- Returns `{ attributes, listeners, isDragging, setNodeRef }` typed to `UseCellDraggableResult`
- Intentionally thin — `beginCellDrag` (with ghost capture) is invoked from `CanvasWrapper.onDragStart` per PATTERNS.md
- PITFALL 1 header comment preserved (spread listeners LAST on JSX element)

**`src/dnd/useCellDropTarget.ts`**
- Wraps `useDroppable({ id: leafId, data: { nodeId: leafId, kind: 'cell' } })` from `@dnd-kit/core`
- Derives `isOver` from `useDragStore(s => s.overId === leafId && s.status === 'dragging')` — single source of truth
- No parallel `document.pointermove` listener (PITFALL 2 prevention)
- No `getBoundingClientRect` call (rect comes from dnd-kit's callback in CanvasWrapper)
- PITFALL 2 header comment preserved

### Task 2: DragPreviewPortal and DropZoneIndicators

**`src/dnd/DragPreviewPortal.tsx`**
- Imports and renders `<DragOverlay dropAnimation={null} modifiers={[grabOffsetModifier]}>` from `@dnd-kit/core`
- `grabOffsetModifier` (GHOST-02): custom `Modifier` that shifts the overlay transform so the pointer remains at its exact sub-pixel grab position within the ghost throughout the drag
  - Reads `activatorEvent` (original pointerdown) client coords across PointerEvent/MouseEvent/TouchEvent
  - Reads `draggingNodeRect` (source cell rect at drag-start)
  - Computes delta between grab point and rect centre; adds to `transform.{x,y}`
- Renders `<img src={ghostUrl} width={sourceW} height={sourceH}>` when `status === 'dragging' && ghostUrl`
- `opacity: 1` — GHOST-03 (80% opacity) is Phase 29's responsibility per CONTEXT.md domain block
- `dropAnimation={null}` — Phase 29 owns ESC snap-back animation
- `DragOverlay` portals to `document.body` automatically (GHOST-06 — no manual createPortal)

**`src/dnd/DropZoneIndicators.tsx`**
- Props: `{ cellId: string, canvasScale: number }`
- Reads `activeZone` from `useDragStore(s => s.overId === cellId ? s.activeZone : null)`
- Renders 5 sibling absolutely-positioned `pointer-events-none` overlays:
  - Top `h-[20%]`: `ArrowUp` — aria-label "Insert above"
  - Bottom `h-[20%]`: `ArrowDown` — aria-label "Insert below"
  - Left `w-[20%]`: `ArrowLeft` — aria-label "Insert to the left"
  - Right `w-[20%]`: `ArrowRight` — aria-label "Insert to the right"
  - Center `inset-[20%]`: `Maximize2` — aria-label "Swap with this cell"
- Active zone: `text-white`; inactive zones: `text-white/30`
- `iconSize = 32 / Math.max(canvasScale, 0.0001)` — scale-stable sizing, guarded against zero

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All four files are fully implemented. No hardcoded empty values or placeholder text that flows to UI rendering. Consumer wiring (LeafNode + CanvasWrapper) is Plan 03's responsibility.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

## Self-Check: PASSED

- `src/dnd/useCellDraggable.ts` exists and contains `useDraggable` import from `@dnd-kit/core`
- `src/dnd/useCellDropTarget.ts` exists and contains `useDroppable` import from `@dnd-kit/core`
- `src/dnd/DragPreviewPortal.tsx` exists and contains `DragOverlay`, `grabOffsetModifier`, `modifiers={[grabOffsetModifier]}`
- `src/dnd/DropZoneIndicators.tsx` exists and contains all 5 icon components and 5 `pointer-events-none` divs
- `npx tsc --noEmit` exits 0
- `npx vitest run src/dnd` passes: 69 tests (30 dragStore + 39 computeDropZone), same count as before
- Commits `92bbce4` (Task 1) and `7d57198` (Task 2) present in git log

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement useCellDraggable and useCellDropTarget hooks | 92bbce4 | src/dnd/useCellDraggable.ts, src/dnd/useCellDropTarget.ts |
| 2 | Implement DragPreviewPortal with grab-offset modifier and DropZoneIndicators | 7d57198 | src/dnd/DragPreviewPortal.tsx, src/dnd/DropZoneIndicators.tsx |
