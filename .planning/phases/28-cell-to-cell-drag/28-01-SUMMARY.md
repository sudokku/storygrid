---
phase: 28-cell-to-cell-drag
plan: 01
subsystem: dnd
tags: [zustand, dragstore, ghost, phase-28, vanilla-zustand]

# Dependency graph
requires:
  - phase: 27-dnd-foundation
    provides: "vanilla Zustand dragStore with 5 fields + 3 actions, middleware-absence invariant enforced by source-readback tests"
provides:
  - "dragStore.ghostDataUrl: string | null field for canvas.toDataURL snapshot storage"
  - "dragStore.sourceRect: { width, height, left, top } | null field for source-cell viewport rect"
  - "dragStore.setGhost(ghost, rect) action — atomic write of both ghost fields"
  - "end() automatically resets ghostDataUrl + sourceRect alongside existing 5 fields (via INITIAL_STATE spread)"
  - "Preserved vanilla-Zustand invariant — no immer/persist imports introduced"
affects:
  - 28-03 (useCellDraggable body) — reads setGhost via useDragStore.getState()
  - 28-04 (useCellDropTarget body) — reads ghost state
  - 28-05 (DragPreviewPortal component) — subscribes to ghostDataUrl + sourceRect
  - 28-07 (adapter dndkit.ts — onDragStart) — calls setGhost after canvas.toDataURL
  - 28-08 (CanvasWrapper DndContext mount) — wires setGhost into dnd-kit callbacks

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive DragState extension — new fields added to type + INITIAL_STATE; existing actions untouched"
    - "Atomic two-field setter (setGhost) writing both ghostDataUrl + sourceRect in a single set() call"
    - "end() resets new fields automatically via INITIAL_STATE spread — no per-field reset code"
    - "Defensive decoupling — beginCellDrag does NOT touch ghost fields; adapter writes them separately in onDragStart (D-06)"

key-files:
  created: []
  modified:
    - "src/dnd/dragStore.ts — extended DragState (5 → 7 fields, 3 → 4 actions), extended INITIAL_STATE, new setGhost action, updated header doc block"
    - "src/dnd/dragStore.test.ts — added 6 specs under new 'setGhost action (Phase 28 / D-06)' describe; added 2 initial-state specs for new fields; extended INITIAL fixture"

key-decisions:
  - "Leave barrel src/dnd/index.ts unchanged — new rect shape inline in DragState per PATTERNS §dragStore"
  - "beginCellDrag intentionally does NOT reset ghostDataUrl/sourceRect — adapter sets them immediately after via setGhost (defensive decoupling per CONTEXT D-06)"
  - "No REFACTOR commit — GREEN implementation is minimal and idiomatic; no code-smell surface"

patterns-established:
  - "Pattern: Additive vanilla-Zustand extension. Add field to DragState + INITIAL_STATE + (optionally) new setter action that calls set({...}). end() covers resets automatically."
  - "Pattern: Middleware-absence invariant preserved under extension. Tests source-readback for zustand/middleware/immer and zustand/middleware/persist strings; extension must avoid both."

requirements-completed: [DND-04, GHOST-01, GHOST-04]

# Metrics
duration: 5min
completed: 2026-04-17
---

# Phase 28 Plan 01: Extend dragStore with ghost fields + setGhost action Summary

**Added `ghostDataUrl`, `sourceRect` fields and `setGhost` action to the Phase 27 vanilla dragStore so Wave 2/3 adapter + DragPreviewPortal can write the drag snapshot imperatively on drag start, with end()-reset coverage and middleware-absence invariant preserved.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-17T12:00:00Z (approx)
- **Completed:** 2026-04-17T12:05:26Z
- **Tasks:** 1/1
- **Files modified:** 2

## Accomplishments

- `DragState` type extended from 5 fields + 3 actions → 7 fields + 4 actions (additive; zero changes to existing surface)
- `setGhost(ghostDataUrl, sourceRect)` action writes both fields atomically in one `set()` call
- `INITIAL_STATE` now includes `ghostDataUrl: null` and `sourceRect: null` — `end()` resets both automatically via spread
- 6 new unit tests under `setGhost action (Phase 28 / D-06)` describe + 2 new initial-state assertions
- Phase 27's existing 24 dragStore tests all still pass (no regressions)
- Middleware-absence invariant preserved — `grep immer|persist src/dnd/dragStore.ts` returns 0 matches
- `npx tsc --noEmit` clean; barrel `src/dnd/index.ts` continues to compile unchanged

## Task Commits

Task 1 was executed as a TDD cycle (test → feat; no refactor needed):

1. **Task 1 RED (failing tests):** `e643e93` — `test(28-01): add failing tests for dragStore ghost fields + setGhost action`
2. **Task 1 GREEN (implementation):** `e2166a0` — `feat(28-01): extend dragStore with ghostDataUrl, sourceRect, setGhost action`

_REFACTOR skipped — implementation is minimal (type addition + INITIAL_STATE addition + one-line action); no code-smell surface to clean up._

## Files Created/Modified

- `src/dnd/dragStore.ts` — extended `DragState` with `ghostDataUrl`, `sourceRect`, `setGhost`; extended `INITIAL_STATE` with two null fields; added `setGhost` to the `create<DragState>()` body; updated header doc comment from "Shape (5 fields + 3 actions)" to "Shape (7 fields + 4 actions)" and documented the new action under Actions.
- `src/dnd/dragStore.test.ts` — added `ghostDataUrl: null` and `sourceRect: null` to the `INITIAL` fixture used in `beforeEach` reset; added 2 new specs to the "initial state" describe; added new `describe('setGhost action (Phase 28 / D-06)')` block with 6 specs covering atomic set, (null,null) clear, end()-reset coverage, beginCellDrag decoupling, setGhost ref stability, and middleware-absence readback.

## Decisions Made

1. **Barrel `src/dnd/index.ts` left unchanged.** The new `sourceRect` shape is inline on `DragState` per PATTERNS §dragStore ("inline type is acceptable"). Promoting it to a named export would bloat the public API without benefit — adapter + portal will read via `useDragStore.getState().sourceRect` and typescript infers the shape.
2. **`beginCellDrag` intentionally does NOT reset `ghostDataUrl`/`sourceRect`.** Per CONTEXT D-06, the adapter writes ghost fields via `setGhost` immediately after calling `beginCellDrag`. Clearing them inside `beginCellDrag` would create a brief flash of `null` ghost in DragPreviewPortal. Test `beginCellDrag does NOT clear ghostDataUrl or sourceRect (defensive decoupling)` locks this invariant.
3. **No REFACTOR commit.** TDD plan-level gate allows skipping REFACTOR when no cleanup is warranted; implementation is already minimal.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Wave 2 (useCellDraggable + useCellDropTarget hook bodies) unblocked — can now read/write ghost state via `useDragStore`.
- Wave 3 (DragPreviewPortal component body) unblocked — can now subscribe to `ghostDataUrl` + `sourceRect` via scoped Zustand selectors.
- Wave 3 adapter (`src/dnd/adapter/dndkit.ts` Plan 07) will call `useDragStore.getState().setGhost(canvas.toDataURL(), rect)` inside `onDragStart`.
- Middleware-absence invariant holds — Phase 27's source-readback test still passes; future extensions must continue to avoid `zustand/middleware/immer` and `zustand/middleware/persist`.

## TDD Gate Compliance

- **RED gate:** ✓ Commit `e643e93` (`test(28-01)`) — 4 new setGhost specs failed as expected before implementation.
- **GREEN gate:** ✓ Commit `e2166a0` (`feat(28-01)`) — all 32 dragStore tests pass after implementation.
- **REFACTOR gate:** skipped (no cleanup warranted — see Decision 3).

## Self-Check: PASSED

- File `src/dnd/dragStore.ts` — FOUND (git log shows commit `e2166a0` touched it)
- File `src/dnd/dragStore.test.ts` — FOUND (git log shows commit `e643e93` touched it)
- Commit `e643e93` — FOUND in git log (`test(28-01): add failing tests...`)
- Commit `e2166a0` — FOUND in git log (`feat(28-01): extend dragStore...`)
- Acceptance criteria:
  - `ghostDataUrl` string count: **7** (≥5 required) ✓
  - `setGhost` present: **4 occurrences** ✓
  - `npm run test -- --run src/dnd/dragStore.test.ts`: **32/32 passed** ✓
  - Phase 27's existing 24 tests: all still pass (no regressions) ✓
  - `grep -c 'immer\|persist' src/dnd/dragStore.ts`: **0** ✓
  - `npx tsc --noEmit`: exit **0** ✓

---
*Phase: 28-cell-to-cell-drag*
*Plan: 01*
*Completed: 2026-04-17*
