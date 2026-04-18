---
phase: 28-cell-to-cell-drag
plan: 15
subsystem: ui
tags: [react, dnd-kit, dragoverlay, aspect-ratio, css-cap, zustand, tdd]

# Dependency graph
requires:
  - phase: 28-cell-to-cell-drag
    provides: DragPreviewPortal ghost rendering (GHOST-04/05/06), dragStore.sourceRect schema, vi.mock('@dnd-kit/core') DragOverlay pass-through test pattern
  - phase: 28-cell-to-cell-drag (plans 28-11, 28-12, 28-13, 28-14)
    provides: MeasuringStrategy.Always, drag-over accent overlay, handleDragMove, input-agnostic pointer derivation — all preserved; 28-15 only touches DragPreviewPortal ghost dimensions
provides:
  - GHOST_MAX_DIMENSION named constant export (200px default)
  - computeCappedGhostSize(sourceRect, max) pure helper with aspect-ratio-preserving uniform scale
  - Capped ghost dimensions on both <img> and D-10 fallback <div> branches
  - Defensive maxWidth/maxHeight CSS ceiling alongside JS scale
  - objectFit: 'cover' on the ghost <img> for cross-browser aspect robustness
  - 14 new tests (7 pure-math + 7 consumer) + updated GHOST-05 test
affects: [Phase 29 (may retune GHOST_MAX_DIMENSION if UAT re-confirmation requests a different size), v1.5 milestone closeout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Aspect-ratio-preserving 2D cap via single uniform scale factor: scale = min(1, max/w, max/h) applied to both axes — reusable for any 2D dimension pair (gallery thumbnails, preview images, exported frames)"
    - "Named constant + exported pure helper for unit-testable render-adjacent math (same pattern as computeDropZone + _testComputeZoneFromDragMove)"
    - "CSS max-* as belt-and-suspenders defensive layer alongside JS-computed dimensions"

key-files:
  created: []
  modified:
    - src/dnd/DragPreviewPortal.tsx
    - src/dnd/__tests__/DragPreviewPortal.test.tsx
    - .planning/phases/28-cell-to-cell-drag/28-VERIFICATION.md

key-decisions:
  - "200px cap chosen as the user's '3/4 smaller' / 'fixed preset' interpretation (~1/4 of a typical 400-800px source cell). Named constant for trivial retuning after UAT re-confirmation."
  - "Aspect preservation via single uniform scale min(1, max/w, max/h) — simple, exact, aspect-preserving by construction. Preferred over per-axis clamp which would distort."
  - "computeCappedGhostSize exported as named pure function so tests cover the scale math directly, decoupled from the React render. Same pattern as computeDropZone + _testComputeZoneFromDragMove."
  - "CSS maxWidth/maxHeight added as belt-and-suspenders ceiling alongside the JS scale — defensive against hypothetical sourceRect mutation mid-render."
  - "objectFit: 'cover' added to <img> for Safari aspect-edge-case robustness. Snapshot is a full-rect capture so 'cover' and 'contain' are visually identical at matching aspect."
  - "D-10 empty-cell fallback <div> gets the same cap so large empty cells also preview sensibly. No branch divergence in cap behavior."
  - "Existing GHOST-05 test assertions updated for the cap (200x300 fixture → expect width = 200*(200/300)px ≈ 133.33, height = 200px) and test renamed to '(GHOST-05 + GHOST-04 cap)' so lineage is visible in test output. Preferred over changing the fixture to a sub-cap value because 200x300 exercises a realistic 'height-axis hits cap' case in the default GHOST-05 lane."

patterns-established:
  - "Aspect-ratio-preserving 2D cap: uniform scale = min(1, max/w, max/h) on both axes. Ship-safe for any 2D dimension pair."
  - "Render-adjacent pure math extracted as exported named helper for direct unit testing."
  - "CSS max-* ceiling + JS scale = defensive redundancy against mid-render mutation."

requirements-completed:
  - GHOST-04
  - GHOST-05

# Metrics
duration: ~20min
completed: 2026-04-18
---

# Phase 28 Plan 15: Ghost Size Cap Gap-Closure Summary

**Ghost dimensions capped at GHOST_MAX_DIMENSION=200 on both axes via aspect-preserving uniform scale (min(1, max/w, max/h)); applied to both snapshot <img> and D-10 fallback <div>; closes 28-UAT Gap 2 'ghost too large on big source cells'.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-18T00:45 UTC (approx)
- **Completed:** 2026-04-18T01:08 UTC
- **Tasks:** 2 (1 TDD task with RED+GREEN + 1 docs task)
- **Files modified:** 3

## Accomplishments

- Exported `GHOST_MAX_DIMENSION = 200` named constant + `computeCappedGhostSize(sourceRect, max)` pure helper in `src/dnd/DragPreviewPortal.tsx`.
- Both ghost render branches (snapshot `<img>` with `ghostDataUrl`, and D-10 empty-cell fallback `<div>`) now consume the capped dims. Aspect ratio exact in both via uniform scale.
- Defensive CSS ceiling `maxWidth: 200, maxHeight: 200` on both branches — belt-and-suspenders against hypothetical sourceRect mid-render mutation.
- `objectFit: 'cover'` added to the `<img>` style for cross-browser aspect robustness (Safari edge cases with width+height overrides).
- Test coverage: 14 new tests (7 pure-helper math tests covering natural/exact-at-cap/square-cap/portrait-cap/wide-cap/custom-cap, and 7 consumer render tests covering small/square/portrait/wide sources on `<img>`, D-10 fallback cap, defensive `maxWidth`/`maxHeight`, and `objectFit: 'cover'`). Existing GHOST-05 test updated + renamed to reflect the cap.
- 28-VERIFICATION.md: GHOST-04 row evidence updated; `### Gap-Closure Plan 28-15` subsection appended under `## Gap-Closure Updates` umbrella AFTER the 28-14 subsection, with worked-examples table, artifact status table, explicit non-scope list, grep gates, and post-fix UAT mapping for all 5 gap-closure plans.

## Task Commits

Each task was committed atomically (TDD cycle for task 1):

1. **Task 1 (RED): GHOST-04 size cap + computeCappedGhostSize coverage** — `a6642dc` (test)
2. **Task 1 (GREEN): cap DragPreviewPortal ghost at 200x200 with aspect preserved** — `a3d4eda` (feat)
3. **Task 2: document ghost size cap gap closure + update GHOST-04 evidence** — `02f0fbe` (docs)

_TDD task produced two commits (RED test → GREEN feat)._

## Files Created/Modified

- `src/dnd/DragPreviewPortal.tsx` — added `GHOST_MAX_DIMENSION` constant + `computeCappedGhostSize` pure helper; restructured JSX to narrow `capped` to non-null in the dragging branch; both `<img>` and `<div>` branches now use `capped.width` / `capped.height` + `maxWidth`/`maxHeight` ceiling; `<img>` gains `objectFit: 'cover'`.
- `src/dnd/__tests__/DragPreviewPortal.test.tsx` — import `computeCappedGhostSize` and `GHOST_MAX_DIMENSION` from `../DragPreviewPortal`; updated GHOST-05 test's assertions + name for the cap applied to the 200x300 fixture; appended two new describe blocks: `computeCappedGhostSize (gap-closure 28-15 pure helper)` (7 tests) and `GHOST-04 size cap (gap-closure 28-15)` (7 tests).
- `.planning/phases/28-cell-to-cell-drag/28-VERIFICATION.md` — GHOST-04 row in Requirements Coverage: Plans column appended with `28-15`, Evidence cell rewritten; appended `### Gap-Closure Plan 28-15 — ghost size cap (max 200x200 with aspect preservation)` as child of `## Gap-Closure Updates` umbrella, AFTER the 28-14 subsection. 28-11/12/13/14 subsections untouched.

## Decisions Made

See `key-decisions` in frontmatter for the full list. Briefly:

- **200px cap.** Interpreted user's imprecise "3/4 smaller" / "fixed preset" language as ~1/4 of a typical 400-800px cell. Named constant for trivial retuning.
- **Uniform-scale aspect preservation.** `scale = min(1, max/w, max/h)` is exact, simple, aspect-preserving by construction.
- **Exported named helper.** Decouples math from React render for direct unit testing (same pattern as `computeDropZone`).
- **CSS + JS defense-in-depth.** `maxWidth`/`maxHeight` as belt-and-suspenders alongside JS scale.
- **Same cap on D-10 fallback.** No branch divergence in cap behavior — large empty cells also preview sensibly.
- **GHOST-05 test: update assertions (not fixture).** Keeps realistic "exceeds cap on one axis" coverage in the default lane.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1 / Rule 2 / Rule 3 auto-fixes were needed; the plan's spec matched the target behavior and test fixtures lined up on the first GREEN run.

**Note (not a deviation):** The plan's final automated-verification bash command for Task 2 contained a check for the literal heading `### Gap-Closure Plan 28-11`. The 28-11 gap-closure subsection is historically named `### SC-3 Gate — Relaxation Note (gap-closure 28-11)` (from the earlier gap-closure plan). All 5 gap-closure plan sections (28-11 / 28-12 / 28-13 / 28-14 / 28-15) are present under the `## Gap-Closure Updates` umbrella. The plan's verification script had a typo in the expected heading literal; a relaxed local verification confirmed all content checks (`## Gap-Closure Updates`, `### Gap-Closure Plan 28-15`, `GHOST_MAX_DIMENSION`, `computeCappedGhostSize`, `aspect ratio`, all 4 prior gap-closure sections including 28-11) pass.

## Issues Encountered

None. TDD cycle ran cleanly: 14 tests failed on RED as expected (import-resolution + dimension + cap + objectFit assertions), all 21 tests (including previously-passing ones) pass on GREEN. Full test suite 917 pass (+14 from this plan); `tsc --noEmit` clean; `npm run build` exits 0.

Pre-existing `act(...)` warnings on `DragPreviewPortal` tests are the same structural warnings emitted before this plan (they relate to `rerender` + store `setState` and are unrelated to the 28-15 cap code path). Not introduced by this plan; no regression.

## Grep Gate Verification

All grep gates from the plan's verification section pass:

| Gate | Expected | Actual |
|------|----------|--------|
| `grep -c 'GHOST_MAX_DIMENSION' src/dnd/DragPreviewPortal.tsx` | >= 4 | 7 |
| `grep -c 'computeCappedGhostSize' src/dnd/DragPreviewPortal.tsx` | >= 2 | 2 |
| `grep -c 'width: sourceRect.width,' src/dnd/DragPreviewPortal.tsx` | == 0 | 0 |
| `grep -c 'objectFit' src/dnd/DragPreviewPortal.tsx` | >= 1 | 1 |
| `grep -c 'GHOST-04 size cap (gap-closure 28-15' src/dnd/__tests__/DragPreviewPortal.test.tsx` | == 1 | 1 |
| `grep -c 'computeCappedGhostSize (gap-closure 28-15 pure helper' src/dnd/__tests__/DragPreviewPortal.test.tsx` | == 1 | 1 |

Note: the plan's gate for `width: sourceRect.width` (without trailing comma) would literally also match the helper's internal `width: sourceRect.width * scale` on line 61 (intentional — the helper needs to multiply source dims by the scale). The practical intent of the gate — that no uncapped render-site `width: sourceRect.width,` property assignment remains — is met (0 matches for the comma-suffixed literal).

## User Setup Required

None — no external service configuration. Pure client-side CSS + math change.

## Follow-Ups

- Real-device UAT re-confirmation per D-31 after all 5 gap-closure plans (28-11 + 28-12 + 28-13 + 28-14 + 28-15) land. Expected outcomes per the verification table:
  - Test 1 (desktop drag) → pass on both sub-items (28-14 closes insert; 28-15 closes ghost size).
  - Test 2 (touch drag) → pass on all sub-items (28-12 closes ghost 1:1; 28-14 closes edge insert on touch; 28-15 closes ghost size). Per-zone icon emphasis remains deferred to Phase 29 per D-15.
  - Test 3 (file drop) → pass (untouched).
  - Test 4 (ghost + zone visuals) → pass cleanly (28-12 ghost 1:1 + 28-13 accent outline + 28-15 ghost size cap).
- If UAT finds 200px too small / too large, retune `GHOST_MAX_DIMENSION` — single-constant change, no algorithmic update needed.
- `isSelected` / `isPanMode` ring occlusion on media cells remains as a non-UAT follow-up under the 28-13 section (unrelated to 28-15 scope).

## Next Phase Readiness

Phase 28 v1.5 gap-closure work is complete pending UAT re-confirmation. All 5 UAT gap-closure plans (28-11 / 28-12 / 28-13 / 28-14 / 28-15) have landed:

- 28-11 — desktop mouse drag sensor collision fixed (MouseSensor + TouchSensor subclasses).
- 28-12 — ghost 1:1 speed (scaleCompensationModifier removed; MeasuringStrategy.Always + per-axis thresholds).
- 28-13 — drag-over accent ring as dedicated overlay (visible on media cells).
- 28-14 — insert edge-drop commits (onDragMove registered; input-agnostic pointer derivation).
- 28-15 — ghost size capped at 200x200 with aspect preserved.

Nothing else from 28-UAT remains open. DROP-02 / DROP-03 per-zone icon emphasis is a Phase 29 design scope per D-15 (not a defect).

## Self-Check: PASSED

- `src/dnd/DragPreviewPortal.tsx` — FOUND (modified; `GHOST_MAX_DIMENSION` + `computeCappedGhostSize` exported; both render branches use capped dims; `objectFit: 'cover'` added).
- `src/dnd/__tests__/DragPreviewPortal.test.tsx` — FOUND (modified; 2 new describe blocks with 14 tests; GHOST-05 test updated + renamed).
- `.planning/phases/28-cell-to-cell-drag/28-VERIFICATION.md` — FOUND (modified; GHOST-04 row evidence updated; `### Gap-Closure Plan 28-15` subsection present under `## Gap-Closure Updates` umbrella after 28-14).
- Commit `a6642dc` — FOUND (test — RED).
- Commit `a3d4eda` — FOUND (feat — GREEN).
- Commit `02f0fbe` — FOUND (docs).

---
*Phase: 28-cell-to-cell-drag*
*Plan: 15*
*Completed: 2026-04-18*
