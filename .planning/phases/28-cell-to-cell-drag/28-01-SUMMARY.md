---
phase: 28
plan: 01
subsystem: dnd
tags: [drag-store, ghost, state-extension]
dependency_graph:
  requires: []
  provides: [dragStore.ghostUrl, dragStore.sourceW, dragStore.sourceH, beginCellDrag-4arg]
  affects: [src/dnd/dragStore.ts]
tech_stack:
  added: []
  patterns: [zustand-vanilla-store, tdd-red-green]
key_files:
  created: []
  modified:
    - src/dnd/dragStore.ts
    - src/dnd/dragStore.test.ts
decisions:
  - beginCellDrag now takes 4 args (sourceId, ghostUrl, sourceW, sourceH) — new contract Plan 02 depends on
  - end() resets all 8 fields via INITIAL_STATE spread (no explicit ghost field reset needed)
  - null ghostUrl accepted as valid (ghost capture may fail at runtime)
metrics:
  duration: ~5 minutes
  completed: "2026-04-18"
  tasks: 1
  files: 2
---

# Phase 28 Plan 01: dragStore Ghost Fields Summary

Extended `dragStore` with `ghostUrl`, `sourceW`, and `sourceH` to carry the ghost image dataURL and source-cell dimensions alongside existing drag state, enabling `DragPreviewPortal` (Plan 02) to render the ghost at correct dimensions in viewport space.

## What Was Built

- Added 3 fields to `DragState` type: `ghostUrl: string | null`, `sourceW: number`, `sourceH: number`
- Updated `INITIAL_STATE` constant with `ghostUrl: null`, `sourceW: 0`, `sourceH: 0`
- Updated `beginCellDrag` signature from 1-arg to 4-arg: `(sourceId, ghostUrl, sourceW, sourceH)`
- `setOver` unchanged — does not touch ghost fields
- `end()` unchanged in logic — INITIAL_STATE spread already picks up the 3 new fields
- Updated JSDoc header to document the new 8-field shape

## Tests

- Updated all existing `beginCellDrag` calls in the test file to the new 4-argument signature
- Added initial state assertions for the 3 new ghost fields to describe block 1
- Added new describe block "ghost field behavior" (9) with 4 tests covering:
  - `beginCellDrag` populates ghostUrl/sourceW/sourceH atomically
  - null ghostUrl + zero dimensions accepted
  - `end()` resets ghost fields to initial
  - `setOver` does not mutate ghost fields
- **Result: 30 tests total, all passing** (was 23 original + 7 initial-state extensions + new describe = 30)

## TDD Gate Compliance

- RED: Tests written with new 4-arg `beginCellDrag` calls + new ghost describe block — 2 tests failed, 28 passed
- GREEN: Store updated — 30 tests pass, `npx tsc --noEmit` exits 0

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend dragStore with ghost fields and update tests | 8fd67f6 | src/dnd/dragStore.ts, src/dnd/dragStore.test.ts |

## Known Stubs

None. This plan extends a store — no UI rendering or data wiring.

## Threat Flags

None. No new network endpoints, auth paths, file access, or schema changes at trust boundaries.

## Self-Check: PASSED

- `src/dnd/dragStore.ts` exists and contains `ghostUrl` (7+ matches), `sourceW` (7+ matches), `sourceH` (7+ matches)
- `src/dnd/dragStore.test.ts` exists with 30 tests
- Commit `8fd67f6` present in git log
- `npx tsc --noEmit` exits 0
- `npx vitest run src/dnd/dragStore.test.ts` exits 0, 30 tests passing
