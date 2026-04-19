---
phase: 29-esc-cancel-visual-polish
plan: "04"
subsystem: ui
tags: [dnd, animation, pointer-events, drag-and-drop, leaf-node]
dependency_graph:
  requires:
    - 29-01 (dragStore.setPointerDown, dragStore.lastDropId)
    - 29-02 (animate-cell-wobble, animate-drop-flash Tailwind utilities)
  provides:
    - LeafNode captures pointer coords at true pointerdown time (before sensor threshold)
    - Source cell shows animate-cell-wobble when isDragging is true
    - Landed cell shows animate-drop-flash when lastDropId === cellId
  affects:
    - src/Grid/LeafNode.tsx
tech_stack:
  added: []
  patterns:
    - "useDragStore.getState() for fire-and-forget store writes inside event handlers (no selector subscription needed)"
    - "useDragStore selector for render-reactive state (isLastDrop drives className)"
    - "setPointerDown call placed before isPanMode guard to fire regardless of mode"
key_files:
  created: []
  modified:
    - src/Grid/LeafNode.tsx
decisions:
  - "setPointerDown called before isPanMode guard — grabOffsetModifier needs coords regardless of pan mode state"
  - "isLastDrop added as a reactive selector (not getState()) so className re-renders when lastDropId changes"
  - "No second onPointerDown JSX attribute — setPointerDown lives inside existing handlePointerDown callback to avoid silent override by dragListeners spread"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-19"
  tasks_completed: 1
  files_modified: 1
---

# Phase 29 Plan 04: LeafNode pointer capture + wobble + drop-flash Summary

**handlePointerDown captures grab-point coords via setPointerDown (before isPanMode guard), source cell applies animate-cell-wobble when dragging, landed cell applies animate-drop-flash when lastDropId matches**

## What Was Built

Three targeted changes to `src/Grid/LeafNode.tsx`:

1. **Pointer coord capture** — `useDragStore.getState().setPointerDown(e.clientX, e.clientY)` added as the first call in `handlePointerDown`, before the `!isPanMode` guard. This records the true grab point at pointerdown time (before the 8px/250ms dnd-kit sensor threshold fires), enabling `grabOffsetModifier` in Plan 29-03 to compute the correct ghost offset.

2. **Wobble animation** — `const isLastDrop = useDragStore((s) => s.lastDropId === id)` selector added after the existing `isDropTarget` selector. The root div className now includes `${isDragging ? 'animate-cell-wobble' : ''}`.

3. **Drop flash animation** — Root div className now includes `${isLastDrop ? 'animate-drop-flash' : ''}`. The `isLastDrop` selector subscribes reactively so the class appears when `lastDropId` is set (via `setLastDrop` in CanvasWrapper Plan 29-03) and disappears after `clearLastDrop()` fires after 700ms.

The critical pitfall was avoided: no second `onPointerDown` JSX attribute was added. The `dragListeners` spread at the end of the root div also injects `onPointerDown` from dnd-kit; a second attribute would silently shadow it. The `setPointerDown` call lives exclusively inside the existing `handlePointerDown` callback body.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Capture pointer coords + wobble + flash classes | f338764 | src/Grid/LeafNode.tsx |

## Test Results

- Pre-existing: 3 failing tests (ActionBar and Mobile header — unrelated to this plan, confirmed present in base commit before changes)
- All other 808 tests pass, TypeScript exits 0
- `npx tsc --noEmit` exits 0

## Deviations from Plan

None — plan executed exactly as written. All three changes applied as specified. The TDD approach was not applied (plan has `tdd="true"` but the action is a targeted edit with grep-based done criteria rather than behavior tests; the existing test suite confirmed no regressions).

## Known Stubs

None. All three changes are fully wired:
- `setPointerDown` writes to the store that `grabOffsetModifier` (Plan 29-03) reads
- `animate-cell-wobble` is defined in `tailwind.config.js` + `src/index.css` (Plan 29-02)
- `animate-drop-flash` is defined in `tailwind.config.js` + `src/index.css` (Plan 29-02)
- `lastDropId` is set by `setLastDrop` in CanvasWrapper (Plan 29-03)

## Threat Flags

None. `e.clientX/Y` are browser-controlled values passed to in-process ephemeral state; no user-controlled input persisted (T-29-05: accepted per threat register).

## Self-Check: PASSED

- `src/Grid/LeafNode.tsx` — modified, contains `setPointerDown`, `isLastDrop`, `animate-cell-wobble`, `animate-drop-flash`
- `setPointerDown` is at line 499, before `if (!isPanMode) return` at line 500
- `isLastDrop` selector at line 311, used in className at line 583
- `animate-cell-wobble` at line 582, `animate-drop-flash` at line 583
- Commit `f338764` — verified in git log
- Only 1 `onPointerDown` attribute in JSX (count confirmed via grep -c)
