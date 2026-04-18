---
phase: 27-dnd-foundation
plan: "03"
subsystem: dnd
tags: [zustand, drag-state, tdd, vanilla-store, dnd-02]
dependency_graph:
  requires: [27-01]
  provides: [dragStore-implementation]
  affects: [Phase 28 drag wiring]
tech_stack:
  added: []
  patterns: [vanilla-zustand-store, tdd-red-green]
key_files:
  created:
    - src/dnd/dragStore.test.ts
  modified:
    - src/dnd/dragStore.ts
decisions:
  - "JSDoc comment avoids keywords 'immer' and 'persist' so source-text assertions in describe blocks 6+7 pass without false positives"
  - "INITIAL_STATE typed with explicit `as const` / `as Type` casts to avoid TS widening on null fields spread into create()"
metrics:
  duration_seconds: 172
  completed_date: "2026-04-18"
  tasks_completed: 2
  files_modified: 2
---

# Phase 27 Plan 03: dragStore Vanilla Zustand Store Summary

**One-liner:** Vanilla Zustand store with 5 ephemeral drag fields + 3 actions, isolated from gridStore undo history per DND-02.

## What Was Built

`src/dnd/dragStore.ts` — 54-line real implementation replacing the Plan 01 throwing stub. Exports `useDragStore` (vanilla `create<DragState>` — no middleware), `DragKind`, `DropZone`, `DragStatus`, `DragState`.

`src/dnd/dragStore.test.ts` — 23 tests across 8 `describe` blocks:

1. `dragStore — initial state` (5 tests): all five fields at documented initial values
2. `dragStore — beginCellDrag` (3 tests): status/kind/sourceId transition, defensive reset of overId/activeZone, gridStore isolation spot-check
3. `dragStore — setOver` (4 tests): field updates, null clear, idempotency, pre-beginCellDrag call
4. `dragStore — end` (3 tests): full reset, from-idle no-op, double-call idempotency
5. `dragStore — cross-cycle isolation` (3 tests): 3-cycle and 100-cycle stress, partial-cycle (no end()) handling
6. `dragStore — no Immer middleware (DND-02 architecture assertion)` (1 test): file-read source text check
7. `dragStore — no persist middleware (ephemeral guarantee)` (1 test): file-read source text check
8. `dragStore — action references are stable across ticks` (3 tests): `===` reference equality for all 3 action functions

## TDD Gate Compliance

- **RED commit:** `77fc1d7` — `test(27-03): add failing tests for dragStore vanilla Zustand store`
  - Confirmed failure: `Error: dragStore: implementation lands in Phase 27 Plan 03` (suite-level, 0 tests collected)
- **GREEN commit:** `264ef1e` — `feat(27-03): implement dragStore vanilla Zustand store`
  - All 23 tests pass; 0 regressions introduced (pre-existing 9 failures in ActionBar/phase25/phase22 tests confirmed present on base commit)

## Verification Results

- `test -f src/dnd/dragStore.ts && test -f src/dnd/dragStore.test.ts` — PASS
- `grep -q "import { create } from 'zustand'" src/dnd/dragStore.ts` — PASS
- `grep -cE "from 'zustand/middleware/immer'|zustand/middleware/persist" src/dnd/dragStore.ts` returns `0` — PASS
- `grep -q "useDragStore" src/dnd/dragStore.ts` — PASS
- `npx vitest run src/dnd/dragStore.test.ts` — 23/23 tests pass
- `npx tsc --noEmit` — exits 0
- `grep -n "drag\|sourceId\|overId\|activeZone" src/store/gridStore.ts | wc -l` returns 3 (comment-only lines about filter effects drag, no drag state fields) — gridStore clean

## DND-02 Ephemeral-Store Guarantee

`grep zustand/middleware src/dnd/dragStore.ts` returns empty — DND-02 ephemeral-store guarantee holds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSDoc comment contained 'immer' and 'persist' keywords**
- **Found during:** GREEN phase (first test run)
- **Issue:** The plan's provided JSDoc snippet read "NO Immer middleware, NO persist middleware" — both words matched the case-insensitive `/immer/i` and `/persist/i` regexes in test describes 6+7, causing 2 failures despite no actual middleware imports.
- **Fix:** Rewrote JSDoc to "no middleware of any kind (no mutation tracking, no storage, no history)" — semantically equivalent, no false positives.
- **Files modified:** `src/dnd/dragStore.ts`
- **Commit:** `264ef1e` (included in GREEN commit)

## Known Stubs

None. The store is fully implemented with no placeholder values.

## Threat Flags

None. Store contains only `{leafId strings, zone literals}` — no new network endpoints, auth paths, or file access patterns.

## Self-Check: PASSED

- `src/dnd/dragStore.ts` — FOUND
- `src/dnd/dragStore.test.ts` — FOUND
- RED commit `77fc1d7` — FOUND
- GREEN commit `264ef1e` — FOUND
