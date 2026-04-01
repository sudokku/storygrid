---
phase: 05-polish-ux
plan: "03"
subsystem: grid-interaction
tags: [pan-zoom, cell-swap, dnd-kit, pointer-events, interaction]
dependency_graph:
  requires: ["05-01", "05-02"]
  provides: ["pan-mode-interaction", "cell-swap-drag"]
  affects: ["src/Grid/LeafNode.tsx", "src/Grid/ActionBar.tsx", "src/Editor/EditorShell.tsx", "src/Grid/CanvasWrapper.tsx"]
tech_stack:
  added: []
  patterns: ["useDraggable/@dnd-kit/core for drag handle", "useDroppable/@dnd-kit/core for drop targets", "pointer capture for pan drag", "DndContext wrapping canvas area"]
key_files:
  created:
    - src/test/phase05-p02-pan-zoom.test.tsx
    - src/test/phase05-p02-cell-swap.test.ts
  modified:
    - src/Grid/LeafNode.tsx
    - src/Grid/ActionBar.tsx
    - src/Editor/EditorShell.tsx
    - src/Grid/CanvasWrapper.tsx
decisions:
  - "setPointerCapture/releasePointerCapture wrapped in existence checks — jsdom lacks these APIs; guards prevent test errors while browser behavior is preserved"
  - "useDraggable disabled=!hasMedia to prevent drag when no media present"
  - "DndContext wraps the flex-1 content div below Toolbar (not the full shell) — Toolbar does not need drag awareness"
metrics:
  duration: "8min"
  completed_date: "2026-04-01"
  tasks: 2
  files: 6
requirements_satisfied:
  - POLH-06
  - POLH-07
---

# Phase 05 Plan 03: Pan/Zoom and Cell Swap Summary

**One-liner:** Pan/zoom image positioning via double-click + pointer drag + wheel zoom, and cell content swap via @dnd-kit drag handle dropped on another cell.

## What Was Built

### Task 1: Pan/Zoom Interaction on LeafNode (POLH-06)

**LeafNode.tsx** — Full pan mode implementation per D-08 through D-12:

- `handleDoubleClick`: enters pan mode on double-click of selected+filled cell; sets `panModeNodeId` in editorStore
- `handlePointerDown/Move/Up`: captures pointer, tracks start position via `panStartRef`, computes delta × 0.15 sensitivity, clamps to [-100, +100], calls `updateCell` with new `panX`/`panY`
- `handleWheel`: adjusts `panScale` ±0.1 per scroll tick, clamped to [1.0, 3.0], calls `updateCell`
- Ring styling: amber `ring-[#f59e0b]` for active pan cell, blue `ring-[#3b82f6]` for selected (non-pan), dashed for empty
- Dim overlay `bg-black/40` on cells where `panModeNodeId !== null && panModeNodeId !== id`
- CSS `transform: translate(panX%, panY%) scale(panScale)` on img when any value differs from defaults
- ActionBar wrapper toggled to `opacity-0 pointer-events-none` when `isPanMode` (regardless of hover)

**CanvasWrapper.tsx** — `handleBgClick` now also calls `setPanModeNodeId(null)` to exit pan mode on canvas background click.

**Escape key** (in EditorShell, already implemented in 05-02) exits pan mode by checking `panModeNodeId` first.

### Task 2: Cell Swap via @dnd-kit Drag Handle (POLH-07)

**ActionBar.tsx** — Added `useDraggable` hook with `id: cell-drag-${nodeId}` and `data: { nodeId }`. Renders a `GripVertical` drag handle button as the first button when `hasMedia=true`. Button has `data-testid={drag-handle-${nodeId}}` and `aria-label="Drag to swap"`.

**LeafNode.tsx** — Added `useDroppable` hook with `id: cell-drop-${id}` and `data: { nodeId: id }`. Ref attached to container div. Shows `ring-2 ring-[#3b82f6]` highlight overlay when `isOver`.

**EditorShell.tsx** — Wraps the content area in `<DndContext onDragEnd={handleDragEnd}>`. `handleDragEnd` extracts `fromId` from `event.active.data.current?.nodeId` and `toId` from `event.over?.data.current?.nodeId`, calls `swapCells(fromId, toId)` when both differ.

**gridStore.ts** — `swapCells` was already implemented in Plan 05-01 (via `swapLeafContent`); no changes needed.

## Tests Added

- `src/test/phase05-p02-pan-zoom.test.tsx` — 19 tests covering double-click entry, amber ring, dim overlay, ActionBar hidden in pan mode, CSS transform, pointer drag, wheel zoom, clamping
- `src/test/phase05-p02-cell-swap.test.ts` — 8 tests covering store swap action, undo, drag handle render/hide, aria-label

**Final test count:** 375 tests, all passing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] jsdom lacks setPointerCapture/releasePointerCapture**
- **Found during:** Task 1 — RED phase tests threw `TypeError: e.target.setPointerCapture is not a function`
- **Issue:** jsdom test environment doesn't implement the PointerCapture API; calling it unconditionally crashed tests
- **Fix:** Added existence guards `if (target.setPointerCapture)` and `if (target.releasePointerCapture)` — browser behavior unchanged, tests no longer throw
- **Files modified:** `src/Grid/LeafNode.tsx`
- **Commit:** 27646a2

## Known Stubs

None — all features are fully wired to store state and produce observable behavior in both UI and tests.

## Self-Check: PASSED

- `src/test/phase05-p02-pan-zoom.test.tsx` — FOUND
- `src/test/phase05-p02-cell-swap.test.ts` — FOUND
- `src/Grid/LeafNode.tsx` — FOUND (contains handleDoubleClick, panModeNodeId, setPointerCapture guard, handleWheel, ring-[#f59e0b], bg-black/40, !isPanMode)
- `src/Grid/ActionBar.tsx` — FOUND (contains useDraggable, GripVertical, setActivatorNodeRef, drag-handle testid)
- `src/Grid/CanvasWrapper.tsx` — FOUND (handleBgClick calls setPanModeNodeId(null))
- `src/Editor/EditorShell.tsx` — FOUND (DndContext, handleDragEnd, swapCells)
- Commit 27646a2 (Task 1) — FOUND
- Commit 23fea54 (Task 2) — FOUND
