---
phase: 27-dnd-foundation
plan: 04
subsystem: testing / regression-lockdown
tags: [dnd, tests, regression, gridStore, moveCell, DND-05, CANCEL-06, pitfall-11]

# Dependency graph
requires:
  - phase: 27-dnd-foundation
    plan: "01"
    provides: "src/dnd/ module boundary + skeleton files (computeDropZone, dragStore, hooks, portal, indicators)"
  - phase: 27-dnd-foundation
    plan: "02"
    provides: "computeDropZone pure 5-zone resolver implementation + tests"
  - phase: 27-dnd-foundation
    plan: "03"
    provides: "dragStore vanilla Zustand store implementation + tests"
provides:
  - "src/store/__tests__/moveCell-noop-guards.test.ts — CI-enforced regression lock on moveCell's four no-op guards"
  - "DND-05 byte-identical assertion on src/store/gridStore.ts (git diff --stat empty vs Phase 27 worktree base)"
  - "CANCEL-06 behavioral lock: each no-op guard path asserts (history.length, historyIndex, tree JSON, selectedNodeId) all unchanged"
  - "DND-05 scope-purity assertion: gridStore.ts declares zero drag-state identifiers (sourceId / overId / activeZone) at state-shape level"
  - "Phase 28 precondition: drag-cancel (CANCEL-03) and drop-on-origin (CANCEL-04) can safely rely on moveCell's no-op semantics"
affects:
  - "28 (Cell-to-Cell Drag) — cancellation paths depend on guards returning early without snapshot push; regression caught immediately by CI"
  - "29 (ESC-Cancel + Visual Polish) — ESC-cancel commits no-op moveCell; this test locks the contract"
  - "any future PR that edits src/store/gridStore.ts lines 473-494 — fails the new test if guards are altered"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Characterization / lock-in testing: test that passes immediately on current behavior and fails the instant the protected surface regresses (not RED → GREEN)"
    - "Source-text scope assertion via fs.readFile + regex: a test reads its dependency's source file at runtime and asserts forbidden identifiers do not appear — enforces module-boundary invariants in CI"
    - "Parameterized guard tests: for-loop over SELF_EDGES generates 5 it() blocks from one assertion body — compact coverage of edge-variant symmetry"
    - "Positive-control test alongside no-op tests — proves the harness detects real mutations, so no-op assertions cannot silently lie"

key-files:
  created:
    - "src/store/__tests__/moveCell-noop-guards.test.ts (266 lines, 7 it() declarations → 11 runtime tests with edge-variant expansion)"
  modified: []

key-decisions:
  - "Place the new file under src/store/__tests__/ (not co-located with gridStore.ts) — matches the regression-focused scope of overlayStore.test.ts / stickerRegistry.test.ts and avoids bloating the already-large gridStore.test.ts"
  - "Split source code's two early-return statements into FIVE distinct test scenarios (Guard 1, 2a, 2b, 3a, 3b) — each failure condition (source|target × not-found|not-leaf) gets its own it() rather than relying on a single OR-guard test"
  - "Parameterize Guard 1 over all 5 edges ('center', 'top', 'right', 'bottom', 'left') — each edge MUST no-op symmetrically; regression that breaks one edge's self-move path is caught"
  - "Prime useEditorStore.selectedNodeId to a known value inside each guard test BEFORE calling moveCell — detects accidental setSelectedNode(null) side-effect from structural moves if the structural branch is taken instead of the no-op path"
  - "Guard 3b fixture built via useGridStore.getState().split(firstLeaf, 'horizontal') — cross-direction split (root is vertical) triggers splitNode Case C, wrapping the leaf in a new inner container whose id serves as the target for the guard-3b scenario. Reuses actual store code instead of hand-crafting a fixture — more realistic and cheaper to maintain"
  - "DND-05 scope assertion uses regex `\\b{name}\\s*[:=]` against gridStore.ts source — matches property-declaration-level appearances (`sourceId:` or `sourceId =`), tolerating existing `// D-04` / local variable `src` / argument `fromId` text. Implements the plan's scope-purity requirement without brittle substring scans"

patterns-established:
  - "Source-file readback scope assertion: tests that enforce 'module X must not mention identifier Y' by reading X's source at runtime. Reusable whenever a module boundary must be mechanically enforced beyond what TypeScript's type system can express"
  - "Snapshot helper returning a plain object with rootJSON + historyLength + historyIndex + selectedNodeId — one-call before/after comparison primitive for any no-op action test"

metrics:
  commits:
    - hash: "b0d3444"
      subject: "test(27-04): lock moveCell no-op guards against future drift"
      files: 1
      insertions: 266
  tests:
    new_it_declarations: 7
    runtime_tests_added: 11
    pass_rate: "11/11"
    pre-existing_regressions_observed_not_caused: 9
  duration_minutes: "~4"
  completed_at: "2026-04-17"
---

# Phase 27 Plan 04: moveCell No-Op Guards Regression Lock Summary

Characterization test suite at `src/store/__tests__/moveCell-noop-guards.test.ts` locks the contract of `gridStore.moveCell`'s four no-op early-return guards (lines 476, 478, 480 in current source — within the protected 473-494 region).

## What Was Built

A single test file (266 lines, 7 `it()` declarations, 11 runtime tests after edge-variant expansion) with one top-level describe: `gridStore.moveCell — no-op guards (DND-05 / CANCEL-06)`. Every guard path is tested individually; the harness is proved correct by an accompanying positive-control test; module-boundary purity is enforced by a source-file readback regex.

## Evidence

### `git diff --stat src/store/gridStore.ts` (must be empty — DND-05)

```
(empty output — no bytes changed)
```

Verified against the Phase 27 worktree base commit `cbfe5235a8df5acb2527251b7c2a26ae13ad101b`. `git diff --quiet src/store/gridStore.ts` exits 0.

### `it()` block names in the new test file

Line 101 (inside `for (const edge of SELF_EDGES)` → expands to 5 runtime tests):
- ``Guard 1 (fromId===toId, edge='${edge}'): is a no-op that pushes no snapshot and does not mutate tree``
  (instantiated for each of `center`, `top`, `right`, `bottom`, `left`)

Line 119: `Guard 2a (!src — source id not in tree): is a no-op that pushes no snapshot and does not mutate tree`

Line 142: `Guard 2b (src.type !== "leaf" — source id is a container): is a no-op that pushes no snapshot and does not mutate tree`

Line 162: `Guard 3a (!tgt — target id not in tree): is a no-op that pushes no snapshot and does not mutate tree`

Line 186: `Guard 3b (tgt.type !== "leaf" — target id is a container): is a no-op that pushes no snapshot and does not mutate tree`

Line 223: `positive control: a valid commit (different leaves, edge=center) pushes exactly one snapshot and mutates tree`

Line 252: `DND-05 scope: gridStore.ts declares no drag-state fields (sourceId / overId / activeZone)`

### REQ-IDs addressed

- **DND-05** — "`gridStore.moveCell` (lines 473-494) and existing tree primitives remain unchanged." Locked by (a) the scope-purity source-text assertion in this file, (b) `git diff --stat` on `src/store/gridStore.ts` being empty at commit time, and (c) the guard-behavior tests implicitly asserting the implementation has not drifted.
- **CANCEL-06** — "`gridStore.moveCell`'s existing early-return no-op guards (lines 473-494) remain unchanged." Locked by the 5 guard-scenario tests asserting each failure condition pushes NO snapshot, mutates NO tree, and clears NO selection.

### Test run results

```
$ npx vitest run src/store/__tests__/moveCell-noop-guards.test.ts
 Test Files  1 passed (1)
      Tests  11 passed (11)
```

All 11 runtime tests pass on first run (this is a lock-in, not a RED → GREEN cycle — the guards already behave correctly).

### Full suite run

```
 Test Files  5 failed | 61 passed (66)
      Tests  9 failed | 797 passed | 2 skipped | 4 todo (812)
```

The 9 failures in 5 files are **pre-existing and explicitly deferred** — documented in `.planning/phases/27-dnd-foundation/deferred-items.md`. They are in Phase 25 touch-DnD / ActionBar code that Phase 28 will REMOVE wholesale as part of DND-04 ("Phase 25 `@dnd-kit` wiring removed in SAME phase as new engine"). Baseline verification: same 9 failures observed when my new test file is temporarily removed — confirmed not introduced by this plan.

### Phase 27 wrap-up sanity

- `src/dnd/`: 8 source files + 2 test files (10 total) — matches plan expectation
  ```
  adapter/ (dndkit.ts)
  computeDropZone.ts + computeDropZone.test.ts
  dragStore.ts + dragStore.test.ts
  DragPreviewPortal.tsx
  DropZoneIndicators.tsx
  index.ts
  useCellDraggable.ts
  useCellDropTarget.ts
  ```
- `@dnd-kit/modifiers`: `^9.0.0` present in `package.json`
- `moveCell` guard lines still intact:
  - Line 476: `if (fromId === toId) return;`
  - Line 478: `if (!src || src.type !== 'leaf') return;`
  - Line 480: `if (!tgt || tgt.type !== 'leaf') return;`

## Deviations from Plan

**None.** Plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed. No authentication gates. No checkpoints.

The plan anticipated that either framing (4-guard or 5-scenario) would be accepted by the orchestrator; Plan 04 went with the fuller 5-scenario count per the plan's explicit guidance, and parameterized Guard 1 over all 5 edges to produce 11 runtime tests from 7 it-declarations.

## Final Assertion

**Phase 27 complete — src/dnd/ module exists with computeDropZone + dragStore tested in isolation; gridStore.moveCell guards locked against future drift; zero UI impact.**

Phase 28 may now proceed confidently: its drag-cancel (CANCEL-03), drop-on-origin (CANCEL-04), and wholesale Phase 25 removal (DND-04) all rely on `moveCell`'s no-op semantics and `gridStore.ts`'s scope purity — both of which are now CI-enforced.

## Self-Check: PASSED

- `src/store/__tests__/moveCell-noop-guards.test.ts` — FOUND (committed at b0d3444)
- `git diff --quiet src/store/gridStore.ts` — exit 0 (UNCHANGED)
- Commit `b0d3444` — FOUND in `git log --oneline`
- 11/11 tests in the new file pass
- Full suite: 797 passed; 9 pre-existing failures pre-documented in deferred-items.md
