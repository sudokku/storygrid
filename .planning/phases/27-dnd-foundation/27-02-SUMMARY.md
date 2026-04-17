---
phase: 27-dnd-foundation
plan: "02"
subsystem: dnd
tags: [dnd, drop-zone, tdd, pure-function, v1.5]
one_liner: "Pure scale-agnostic computeDropZone(rect, pointer) → 5-zone resolver with 39-test unit suite (DROP-06, CANCEL-05)"
dependency-graph:
  requires:
    - src/dnd/dragStore.ts (DropZone type, from Plan 01 skeleton)
    - @dnd-kit/modifiers package installed (from Plan 01 — no direct dep in this plan)
  provides:
    - computeDropZone(rect, pointer): DropZone
    - Vitest suite covering 5-zone lookup at canvas scales 0.2/0.5/1.0
    - Boundary-pixel transition coverage (strict </>)
    - Property-based no-dead-space proof (CANCEL-05)
  affects:
    - Phase 28 useCellDropTarget will call this on every onDragOver tick (DROP-06)
tech-stack:
  added: []
  patterns:
    - TDD RED → GREEN cycle enforced via plan-level `type: tdd` frontmatter
    - Pure-function design (referentially transparent; no side effects)
    - Viewport-space math (no canvasScale division — ARCHITECTURE.md Anti-Pattern 3)
key-files:
  created:
    - src/dnd/computeDropZone.test.ts
  modified:
    - src/dnd/computeDropZone.ts
decisions:
  - "[Phase 27-02]: Threshold formula kept verbatim from Phase 9 LeafNode math (Math.max(20, Math.min(w, h) * 0.2)) — preserves parity with the proven in-tree resolver while relocating to a pure function"
  - "[Phase 27-02]: Strict `<` / `>` threshold comparisons (NOT `<=` / `>=`) so points exactly on the inner threshold line resolve to center — test suite locks this boundary semantics explicitly"
  - "[Phase 27-02]: Zone priority top > bottom > left > right > center — Y-axis checks run before X-axis, so corners resolve to top/bottom (Phase 9 semantic)"
  - "[Phase 27-02]: Degenerate small cell (20x20) test — verifies deterministic return even when threshold floor collapses the center region"
  - "[Phase 27-02]: No REFACTOR pass — function is 9 lines; plan explicitly noted 'None expected'"
metrics:
  duration: "6m"
  tasks_completed: 2
  files_changed: 2
  tests_added: 39
  lines_added: 294
  lines_removed: 8
  completed_date: "2026-04-17"
---

# Phase 27 Plan 02: computeDropZone 5-zone Resolver Summary

## Summary

Replaced the Plan 01 skeleton in `src/dnd/computeDropZone.ts` with the real
implementation of `computeDropZone(rect, pointer)` — a pure, scale-agnostic
function that maps a viewport-space rect + pointer to one of
`'center' | 'top' | 'bottom' | 'left' | 'right'`. Backed it with an
exhaustive 39-test Vitest suite proving 5-zone tiling at three representative
canvas scales, exact boundary-pixel semantics, non-origin rect support, and
a property-based no-dead-space sweep (CANCEL-05's "zones fully tile each
cell" proof).

This is the load-bearing pure function for the entire v1.5 DnD engine —
Phase 28's `useCellDropTarget` will call it on every `onDragOver` tick
(DROP-06).

## Files

### Created

- **`src/dnd/computeDropZone.test.ts`** (273 lines)
  - 8 top-level `describe` blocks
  - 39 individual `it` tests
  - 35 `expect()` assertion call sites (property sweep loops drive the true
    assertion count far higher — each of the three scale sweeps validates
    thousands of (x, y) samples)
  - Local `makeRect()` helper for DOMRect-shaped literals (jsdom's DOMRect
    ctor is fiddly per plan note)

### Modified

- **`src/dnd/computeDropZone.ts`** (40 lines total; function body is 9 lines)
  - Skeleton `throw new Error(...)` replaced with real implementation
  - Header JSDoc expanded to document zone priority, boundary semantics,
    and ARCHITECTURE.md Anti-Pattern 3 (no canvasScale division)

## Test Coverage

| Describe | Tests | Purpose |
|----------|-------|---------|
| Zone lookup at canvasScale 1.0 | 8 | Cell 300×600, threshold=60 — center, 4 edges, strict boundary at y=threshold |
| Zone lookup at canvasScale 0.5 | 5 | Cell 150×300, threshold=30 — center + 4 edges |
| Zone lookup at canvasScale 0.2 | 5 | Cell 60×120, threshold=20 (floor active) — center + 4 edges |
| Boundary pixel transitions (±1px around threshold) | 6 | Verifies strict `<` / `>` semantics at y=59,60,61 and y=539,540,541 |
| Rect not at origin | 5 | rect.left=100, rect.top=200 — all 5 zones via relative-coord translation |
| CANCEL-05 no-dead-space property sweep | 4 | 3 scales + corner samples; step=5px sweep asserts every sample returns a valid zone and is deterministic |
| Degenerate small cell (20×20) | 2 | Threshold floor collapses center — function still deterministic + total across 20×20 integer grid |
| Exact geometric center | 4 | 100×100, 200×400, 800×1600, 300×600 cell sizes — center pointer → 'center' |
| **Total** | **39** | |

## RED / GREEN Commits

| Phase | Commit | Message |
|-------|--------|---------|
| RED | `454fee5` | `test(27-02): add failing tests for computeDropZone 5-zone resolver` |
| GREEN | `e34f576` | `feat(27-02): implement computeDropZone pure 5-zone resolver` |

RED confirmed: all 39 tests failed with the Plan 01 skeleton's
`Error: computeDropZone: implementation lands in Phase 27 Plan 02`.

GREEN confirmed: all 39 tests pass against the real implementation in
`155ms`. `npx tsc --noEmit` exits 0.

## REQ-IDs Satisfied

- **DROP-06** — `computeDropZone` is a pure function callable on every
  pointermove tick. No internal state, no caching, no side effects;
  guaranteed O(1) per call. Phase 28 will invoke it inside
  `useCellDropTarget`'s `onDragOver` handler.
- **CANCEL-05** — The property-based sweep (`describe #6`) proves every
  integer-ish pointer across three canvas scales resolves to exactly one
  of the 5 zones. Threshold formula `Math.max(20, Math.min(w, h) * 0.2)`
  guarantees no dead-space region exists for cells where
  `min(w, h) >= 100 px`; the 20px floor + degenerate-cell test cover the
  edge case where a cell collapses below that size.

## Deviations from Plan

None. Plan executed exactly as written — RED → GREEN in two commits; no
REFACTOR pass (plan noted "None expected" for this <10-line function).

One procedural note: a git stash operation during mid-verification
accidentally introduced unintended scratch modifications to
`src/dnd/dragStore.ts` (Plan 03's territory). Reverted via
`git checkout -- src/dnd/dragStore.ts` before the GREEN commit. Final
`git diff af361ac..HEAD` shows only the two in-scope files modified:
`src/dnd/computeDropZone.ts` and `src/dnd/computeDropZone.test.ts`.

## Deferred Issues

Pre-existing Phase 25 / ActionBar test failures (9 tests across 5 files)
exist at the Plan 02 base commit `af361ac`. Verified baseline — NOT caused
by this plan. Logged in
`.planning/phases/27-dnd-foundation/deferred-items.md`. These tests
exercise code that Phase 28 (DND-04) will remove wholesale when the
Phase 25 `@dnd-kit` wiring is replaced with the v1.5 engine.

## Verification Results

- [x] `test -f src/dnd/computeDropZone.ts` — FOUND
- [x] `test -f src/dnd/computeDropZone.test.ts` — FOUND
- [x] `npx vitest run src/dnd/computeDropZone.test.ts` — 39/39 passed, 155ms
- [x] `npx tsc --noEmit` — exit 0
- [x] `grep -c "Math.max(20, Math.min(w, h) \* 0.2)" src/dnd/computeDropZone.ts` → 2 (header doc + impl — both required)
- [x] `canvasScale` appears only in header comment (line 11), NOT in function body
- [x] `gridStore.ts` lines 473-494 unchanged — no modification to gridStore at all (git diff is empty)
- [x] Only files modified end-to-end: `src/dnd/computeDropZone.{ts,test.ts}`
- [x] Zero regressions introduced (baseline 9 failures unchanged)

## Self-Check: PASSED

- FOUND: src/dnd/computeDropZone.ts (40 lines; real implementation, no throw)
- FOUND: src/dnd/computeDropZone.test.ts (273 lines; 8 describes, 39 tests)
- FOUND commit 454fee5 (RED — `test(27-02): add failing tests for computeDropZone 5-zone resolver`)
- FOUND commit e34f576 (GREEN — `feat(27-02): implement computeDropZone pure 5-zone resolver`)

## TDD Gate Compliance

- [x] RED gate — `test(27-02): ...` at `454fee5`, tests failed as expected
- [x] GREEN gate — `feat(27-02): ...` at `e34f576`, tests all pass
- [x] REFACTOR gate — intentionally skipped per plan ("None expected")
