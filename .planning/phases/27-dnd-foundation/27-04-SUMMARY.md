---
phase: 27-dnd-foundation
plan: "04"
subsystem: store/testing
tags: [regression-tests, moveCell, no-op-guards, DND-05, CANCEL-06]
dependency_graph:
  requires: [27-01, 27-02, 27-03]
  provides: [moveCell-noop-guard-lock]
  affects: [src/store/__tests__/moveCell-noop-guards.test.ts]
tech_stack:
  added: []
  patterns: [characterization-test, lock-in-test, scope-assertion]
key_files:
  created:
    - src/store/__tests__/moveCell-noop-guards.test.ts
  modified: []
decisions:
  - "process.cwd() used instead of import.meta.url for readFile path — Vitest resolves import.meta.url to /src/... (not real FS path) in jsdom environment"
  - "split() is the correct gridStore action name (not splitCell) — used in Guard 3b fixture setup"
  - "5 guard scenarios tested (not 4) — 2a/2b and 3a/3b split into separate it() blocks for maximum diagnostic precision"
metrics:
  duration: "5min"
  completed: "2026-04-18"
  tasks: 1
  files: 1
requirements:
  - DND-05
  - CANCEL-06
---

# Phase 27 Plan 04: moveCell No-Op Guard Regression Tests Summary

**One-liner:** Lock-in regression tests for all five moveCell no-op guard branches using characterization tests that assert history immutability and tree immutability on each early-return path (DND-05 / CANCEL-06).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add regression test file locking moveCell no-op guard behavior | 51f6102 | src/store/__tests__/moveCell-noop-guards.test.ts |

## DND-05 Byte-Identical Assertion

`git diff --stat src/store/gridStore.ts` output: **(empty — no changes)**

Lines 473-494 confirmed unchanged. Guards at lines 476, 478, 480 verified via grep:
- Line 476: `if (fromId === toId) return;`
- Line 478: `if (!src || src.type !== 'leaf') return;`
- Line 480: `if (!tgt || tgt.type !== 'leaf') return;`

## Test File: it() Names

All 11 `it()` blocks in `src/store/__tests__/moveCell-noop-guards.test.ts`:

1. `Guard 1 — fromId === toId > center edge: is a no-op that pushes no snapshot and does not mutate tree`
2. `Guard 1 — fromId === toId > top edge: is a no-op that pushes no snapshot and does not mutate tree`
3. `Guard 1 — fromId === toId > right edge: is a no-op that pushes no snapshot and does not mutate tree`
4. `Guard 1 — fromId === toId > bottom edge: is a no-op that pushes no snapshot and does not mutate tree`
5. `Guard 1 — fromId === toId > left edge: is a no-op that pushes no snapshot and does not mutate tree`
6. `Guard 2a — source id not in tree: is a no-op that pushes no snapshot and does not mutate tree`
7. `Guard 2b — source is a container: is a no-op that pushes no snapshot and does not mutate tree`
8. `Guard 3a — target id not in tree: is a no-op that pushes no snapshot and does not mutate tree`
9. `Guard 3b — target is a container: is a no-op that pushes no snapshot and does not mutate tree`
10. `Positive control — valid different leaves: pushes exactly one snapshot and mutates tree`
11. `DND-05 scope assertion — gridStore has no drag field names (sourceId, overId, activeZone)`

All 11 tests: GREEN.

## REQ-IDs Addressed

| REQ-ID | Evidence |
|--------|----------|
| DND-05 | `git diff src/store/gridStore.ts` empty; scope assertion test confirms no drag fields at state level; guards at lines 476/478/480 verified byte-identical |
| CANCEL-06 | Tests 1-9 explicitly assert `history.length` unchanged on every no-op path, locking against Pitfall 11 (aborted drag pollutes undo history) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `import.meta.url` resolves incorrectly in Vitest jsdom environment**
- **Found during:** Task 1, DND-05 scope test
- **Issue:** `new URL('../gridStore.ts', import.meta.url).pathname` resolved to `/src/store/gridStore.ts` (no FS root prefix) causing ENOENT
- **Fix:** Replaced with `process.cwd() + '/src/store/gridStore.ts'` which resolves to the correct absolute path
- **Files modified:** src/store/__tests__/moveCell-noop-guards.test.ts
- **Commit:** 51f6102

**2. [Rule 1 - Bug] Incorrect store action name `splitCell` (does not exist)**
- **Found during:** Task 1, Guard 3b fixture setup
- **Issue:** Plan referenced `splitCell` but the actual store action is `split`
- **Fix:** Changed to `useGridStore.getState().split(sourceId, 'horizontal')`
- **Files modified:** src/store/__tests__/moveCell-noop-guards.test.ts
- **Commit:** 51f6102

## Full Suite Result

- New tests: 11 passed / 0 failed
- Pre-existing failures: 9 (in phase25-touch-dnd, action-bar, phase05-p02-cell-swap, ActionBar, phase22-mobile-header) — confirmed identical before and after Plan 04 changes
- Zero regressions introduced by this plan

## Final Assertion

Phase 27 complete — `src/dnd/` module exists with `computeDropZone` + `dragStore` tested in isolation; `gridStore.moveCell` guards locked against future drift via 11 CI-enforced regression tests; zero UI impact. `ls src/dnd/ | wc -l` returns 10 (8 source + 2 test files).

## Self-Check: PASSED

- `src/store/__tests__/moveCell-noop-guards.test.ts` exists: FOUND
- Commit 51f6102 exists: FOUND
- `git diff src/store/gridStore.ts` empty: CONFIRMED
- `npx vitest run src/store/__tests__/moveCell-noop-guards.test.ts`: 11 passed
