---
phase: 29-esc-cancel-visual-polish
plan: "01"
subsystem: dnd
tags: [store, zustand, drag-and-drop, tdd]
dependency_graph:
  requires: []
  provides: [dragStore.pointerDownX, dragStore.pointerDownY, dragStore.lastDropId, dragStore.setPointerDown, dragStore.setLastDrop, dragStore.clearLastDrop]
  affects: [src/dnd/DragPreviewPortal.tsx, src/Grid/CanvasWrapper.tsx, src/Grid/LeafNode.tsx]
tech_stack:
  added: []
  patterns: [vanilla-zustand-set, tdd-red-green]
key_files:
  created: []
  modified:
    - src/dnd/dragStore.ts
    - src/dnd/dragStore.test.ts
decisions:
  - "New fields added to INITIAL_STATE so end() resets them automatically via spread — no change to end() implementation needed"
  - "pointerDownX/Y stored at onPointerDown time (before sensor threshold delay) to preserve true grab-point for grabOffsetModifier"
  - "lastDropId drives the 700ms drop-flash animation; clearLastDrop() is called via setTimeout in CanvasWrapper (Plan 29-03)"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-19"
  tasks_completed: 2
  files_modified: 2
---

# Phase 29 Plan 01: Extend dragStore — pointer-down and drop-flash fields Summary

Expanded the ephemeral `dragStore` with three new fields (`pointerDownX`, `pointerDownY`, `lastDropId`) and three new actions (`setPointerDown`, `setLastDrop`, `clearLastDrop`) that Phase 29 consumer files depend on.

## What Was Built

The store contract is now complete for all Phase 29 consumers:

- `DragPreviewPortal.tsx` can read `pointerDownX/Y` from `useDragStore.getState()` inside `grabOffsetModifier` to apply the correct grab-offset (Plan 29-02)
- `CanvasWrapper.tsx` can call `setLastDrop(toId)` before `end()` in `handleDragEnd` to trigger the flash (Plan 29-03)
- `LeafNode.tsx` can subscribe to `lastDropId === id` selector to conditionally apply `animate-drop-flash` (Plan 29-03)

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Add failing tests for new fields/actions | 6ff7883 | src/dnd/dragStore.test.ts |
| GREEN | Implement new fields and actions in dragStore | acfe2a1 | src/dnd/dragStore.ts |

## Test Results

- 37 tests pass (30 original + 7 new)
- 0 failures
- TypeScript: `npx tsc --noEmit` exits 0

## Deviations from Plan

None — plan executed exactly as written. The TDD RED/GREEN cycle was followed: failing tests committed first, then implementation to make them pass.

## TDD Gate Compliance

- RED gate: commit `6ff7883` — `test(29-01): add failing tests for pointerDown fields + lastDropId / drop flash (RED)`
- GREEN gate: commit `acfe2a1` — `feat(29-01): extend dragStore with pointerDownX/Y, lastDropId fields and setPointerDown/setLastDrop/clearLastDrop actions (GREEN)`
- REFACTOR gate: not needed — implementation is minimal and clean

## Known Stubs

None. This plan only modifies a Zustand store — no UI rendering, no placeholder values.

## Threat Flags

None. All store writes are local in-process ephemeral state. `pointerDownX/Y` are client-side pointer coordinates reset by `end()` on drag cancel/end (T-29-01: accepted per threat register).

## Self-Check: PASSED

- `src/dnd/dragStore.ts` — modified, contains `pointerDownX`, `pointerDownY`, `lastDropId`
- `src/dnd/dragStore.test.ts` — modified, contains sections 10 and 11
- Commit `6ff7883` — verified in git log
- Commit `acfe2a1` — verified in git log
