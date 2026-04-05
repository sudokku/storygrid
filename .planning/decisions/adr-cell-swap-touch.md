# ADR: Cell Swap Touch Support Deferred (D-16)

**Date:** 2026-04-03
**Status:** Deferred — MVP desktop-only
**Phase:** 05.1-mobile-first-ui

## Context

Phase 05.1 requirement D-16 states: "Cell swap works on touch." The CONTEXT.md note says:
"@dnd-kit drag handle for cell swap already supports touch sensors (dnd-kit v6). Ensure TouchSensor
is included in the DndContext sensor configuration."

During implementation verification, it was found that:

1. Cell swap is implemented via native HTML5 drag events (`ondragstart` sets `dataTransfer.text/cell-id`;
   `onDrop` reads and calls `swapCells`). This approach does not use @dnd-kit at all for swap.
2. Native HTML5 drag events (`dragstart`, `dragover`, `drop`) do not fire on iOS/Android touch screens.
3. No `DndContext` with sensor configuration exists in the codebase. A `DndContext` is present in
   `EditorShell.tsx` but it wraps the ActionBar `useDraggable` — not the full grid for cell-to-cell swap.

## Decision

Defer touch cell swap to post-MVP. The feature is explicitly scoped as desktop-only for v1.

## Rationale

Implementing @dnd-kit TouchSensor for cell swap requires:
- Replacing the native `ondragstart`/`onDrop` swap mechanism in `LeafNode.tsx` with `useDraggable` and `useDroppable`
- Configuring a `DndContext` with `useSensor(MouseSensor)` and `useSensor(TouchSensor)` wrapping the grid
- Ensuring the DndContext does not conflict with the existing `DndContext` in `EditorShell.tsx`
  (which is used for ActionBar drag positioning — a different interaction)

This is a non-trivial refactor. For MVP, mobile users can:
- Select cells by tapping
- Split cells via the bottom sheet Split H/V buttons
- Upload media by tapping empty cells
- Reposition images via pinch-to-zoom and pan mode

Cell swap between two filled cells is a power feature. The absence does not block core mobile use.

## Consequences

- Cell swap via drag works on desktop (mouse) only in v1
- Mobile users cannot swap cell images via drag in v1
- The native drag implementation in `LeafNode.tsx` remains unchanged

## Future Implementation Path

1. Replace `handleDragStart` / `handleDrop` swap logic in `LeafNode.tsx` with `useDraggable` / `useDroppable`
2. Add a separate `DndContext` with `[MouseSensor, TouchSensor]` wrapping `GridNode` (not EditorShell)
3. Verify the two DndContext instances (EditorShell's for ActionBar + GridNode's for swap) do not interfere
4. Test on iOS Safari and Android Chrome
