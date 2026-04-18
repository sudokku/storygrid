---
phase: 28-cell-to-cell-drag
plan: 14
subsystem: ui
tags: [react, dnd-kit, drag-and-drop, touch-events, testing]

# Dependency graph
requires:
  - phase: 28-cell-to-cell-drag
    provides: "28-11 (CellDragMouseSensor + CellDragTouchSensor subclasses), 28-12 (scaleCompensationModifier removal + MeasuringStrategy.Always + per-axis thresholds), 28-13 (drag-over overlay)"
provides:
  - "Continuous zone-compute pipeline: onDragMove fires on every pointer-move tick during an active drag (deps [scrollAdjustedTranslate.x, scrollAdjustedTranslate.y] per @dnd-kit/core/dist/core.esm.js:3210-3243), replacing the stale-at-entry zone captured by onDragOver"
  - "Input-type-agnostic pointer derivation: active.rect.current.initial + delta works identically for Mouse, Touch, and Pen inputs — no activatorEvent cast required"
  - "Exported _testComputeZoneFromDragMove helper enabling unit testing of the zone-compute logic without simulating the full dnd-kit lifecycle (Pitfall 11 compliance)"
  - "5-test integration regression block + 3-test NaN-input unit regression block locking both DEFECT 1 (missing onDragMove) and DEFECT 2 (PointerEvent cast on TouchEvent)"
affects: [28-15, 29-drop-zone-emphasis, real-device-uat-reconfirmation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Use onDragMove (not onDragOver) for continuous pointer-move computations during an active drag"
    - "Input-type-agnostic pointer derivation from active.rect.current.initial + delta (never cast activatorEvent to PointerEvent)"
    - "Extract pure helpers from dnd-kit callbacks as exported `_test*` named functions to enable unit testing without simulating the dnd-kit lifecycle"

key-files:
  created: []
  modified:
    - src/Grid/CanvasWrapper.tsx
    - src/dnd/__tests__/CanvasWrapper.integration.test.tsx
    - src/dnd/computeDropZone.test.ts
    - .planning/phases/28-cell-to-cell-drag/28-VERIFICATION.md

key-decisions:
  - "handleDragMove is the authoritative continuous zone-compute site; handleDragOver is now a narrow null-over/self-over clearer only"
  - "Pointer derivation via active.rect.current.initial + delta is input-type-agnostic and does NOT read activatorEvent — preferred over the type-branching alternative (branch on TouchEvent instanceof) because it removes the type dispatch entirely"
  - "_testComputeZoneFromDragMove is an exported test-only helper (underscore prefix convention) to enable unit testing without simulating the full dnd-kit lifecycle (Pitfall 11)"
  - "computeDropZone is NOT modified — NaN-fallthrough is correct per its contract and the fix is at the producer (CanvasWrapper), not the consumer"

patterns-established:
  - "dnd-kit onDragOver fires on droppable enter/leave only (deps [overId]); onDragMove fires on every pointer-move tick (deps [scrollAdjustedTranslate.x, scrollAdjustedTranslate.y])"
  - "activatorEvent type is input-specific (MouseEvent for MouseSensor, TouchEvent for TouchSensor) — never cast to PointerEvent blindly. Prefer input-agnostic derivations like active.rect.current.initial + delta"
  - "Test-only exports use `_test*` prefix + inline comment signaling 'do not import in production code'"

requirements-completed:
  - DROP-04
  - DROP-07
  - CROSS-01
  - DRAG-03
  - DRAG-04

# Metrics
duration: ~18min
completed: 2026-04-18
---

# Phase 28 Plan 14: handleDragMove refresh + input-agnostic pointer Summary

**28-UAT Gap 1 'insert (edge-drop) broken on desktop + touch' closed. Two independent defects fixed in CanvasWrapper.tsx: (a) handleDragOver was the sole zone-compute site but fires only on droppable enter/leave — a new handleDragMove is now registered on DndContext for continuous zone refresh; (b) pointer derivation was cast through PointerEvent.clientX which yielded undefined on TouchEvent — pointer is now derived from active.rect.current.initial + delta (input-type-agnostic). Integration test + NaN unit test added as regression locks.**

## Performance

- **Duration:** ~18 minutes
- **Started:** 2026-04-18T03:43:00Z
- **Completed:** 2026-04-18T04:01:00Z
- **Tasks:** 2 (TDD cycle for Task 1 → 3 commits; docs for Task 2 → 1 commit)
- **Files modified:** 4

## Accomplishments

- Registered `onDragMove={handleDragMove}` on `<DndContext>` so zone-compute fires on every pointer-move tick (not just droppable enter/leave) — closes the stale-entry-zone defect on desktop AND touch.
- Replaced `(activatorEvent as PointerEvent).clientX` cast with `active.rect.current.initial + delta` pointer derivation — input-type-agnostic, eliminates the NaN-on-TouchEvent path that made edge-drops physically unreachable on touch.
- Reduced `handleDragOver` to its narrow null-over / self-over clearing role (no pointer derivation, no `computeDropZone` call).
- Extracted `_testComputeZoneFromDragMove` as an exported pure helper so both the production `handleDragMove` callback and the new test suite share one implementation.
- Added 5-test integration describe block covering: edge-zone resolution, stale-zone regression across 3 ticks, input-type agnosticism, null-over, self-over.
- Added 3-test NaN-input unit describe block documenting the fallthrough behavior that amplified DEFECT 2 on touch — regression lock at the isolation level.
- Updated `28-VERIFICATION.md` truth row 5 evidence and appended a `### Gap-Closure Plan 28-14` subsection under the existing `## Gap-Closure Updates` umbrella documenting root causes, fixes, artifact changes, non-scope, grep gates, and post-fix UAT mapping for plans 28-11 + 28-12 + 28-13 + 28-14.

## Task Commits

TDD cycle — Task 1 split into RED + GREEN commits:

1. **Task 1 RED: Tests for handleDragMove + NaN regression lock** — `047a7dc` (test)
2. **Task 1 GREEN: onDragMove registration + input-agnostic pointer** — `17978f7` (fix)
3. **Task 2: VERIFICATION.md updates** — `af1188a` (docs)

Each commit is atomic; GREEN was verified by running the integration suite (17/17 passed) after the CanvasWrapper changes landed.

## Files Created/Modified

- `src/Grid/CanvasWrapper.tsx` — Added `DragMoveEvent` type import; added exported pure helper `_testComputeZoneFromDragMove` with input-type-agnostic pointer derivation; reduced `handleDragOver` to null-over/self-over clearing only; added new `handleDragMove` callback that invokes the helper and writes to the dragStore; registered `onDragMove={handleDragMove}` on `<DndContext>`.
- `src/dnd/__tests__/CanvasWrapper.integration.test.tsx` — Imported `_testComputeZoneFromDragMove` from `../../Grid/CanvasWrapper`; appended 5-test describe block exercising the helper through edge-zone / stale-zone / input-agnostic / null-over / self-over scenarios.
- `src/dnd/computeDropZone.test.ts` — Appended 3-test describe block pinning the NaN-input fallthrough behavior that amplified DEFECT 2 (regression lock at the isolation level).
- `.planning/phases/28-cell-to-cell-drag/28-VERIFICATION.md` — Updated truth row 5 evidence to reflect `onDragMove` as the compute site and `active.rect.current.initial + delta` as the pointer derivation; appended `### Gap-Closure Plan 28-14` subsection under the `## Gap-Closure Updates` umbrella.

## Decisions Made

- **handleDragMove owns continuous zone-compute; handleDragOver is a narrow clearer.** `onDragOver` fires only on droppable enter/leave per @dnd-kit/core/dist/core.esm.js:3286 (deps `[overId]`), so it cannot be the continuous compute site. `onDragMove` (deps `[scrollAdjustedTranslate.x, scrollAdjustedTranslate.y]` per core.esm.js:3210-3243) is the correct hook. handleDragOver retained for null-over / self-over CLEARING only — handleDragMove's null-over branch also clears, so the store stays consistent either way.
- **Pointer derivation via `active.rect.current.initial + delta` over type-branching on activatorEvent.** The alternative (branch on `activatorEvent instanceof TouchEvent` and read `touches[0].clientX`) also works but requires type dispatch. dnd-kit normalizes `delta` across input types, so anchoring at the source cell's captured rect and adding delta yields the viewport-space pointer position with zero type branching. Preferred for its simplicity and alignment with dnd-kit's own abstractions.
- **`_testComputeZoneFromDragMove` exported from production file with underscore prefix.** Pitfall 11 forbids simulating the full dnd-kit lifecycle in jsdom; the alternative (mock `@dnd-kit/core` at the module level) is more invasive. Extracting the pointer-derivation + zone-compute logic into an exported pure helper that the real callback and the test both consume is the cleanest pattern and matches how `computeDropZone` is structured (exported pure function). Underscore prefix + inline JSDoc signals "test-only".
- **`computeDropZone` source unchanged; NaN-fallthrough documented at isolation level.** The fix is strictly at the producer (CanvasWrapper). Making computeDropZone NaN-safe or NaN-throwing would mask the real defect at the producer. The 3-test NaN-input describe block pins the existing fallthrough behavior so a future "fix" that silently changes it would trip the test.

## Deviations from Plan

None — plan executed exactly as written. The plan offered an "alternative derivation" route (type-branching on `activatorEvent instanceof TouchEvent`) and the preferred route (`active.rect.current.initial + delta`). I selected the preferred route as explicitly recommended in the plan.

## Issues Encountered

None. The RED → GREEN cycle worked as expected:
- RED: 5/5 new integration tests failed with `TypeError: _testComputeZoneFromDragMove is not a function` — exactly the expected failure mode before the helper was exported. NaN-input unit tests (3/3) passed on first run since they document the existing pure-function behavior.
- GREEN: After adding the exported helper, registering `onDragMove`, and reducing `handleDragOver`, all 5 integration tests passed. Full test suite: 73 files, 903 passed (2 skipped, 4 todo). `tsc --noEmit` clean. `npm run build` exits 0.

Pre-existing React `act(...)` warnings surface during the integration test run (DragPreviewPortal-related); these are not caused by this plan and were already present before the changes.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 28-15 (ghost size cap) is the last remaining gap from 28-UAT Gap 1. Once 28-15 lands, real-device UAT re-confirmation (D-31) is required to flip Tests 1 + 2 from `issue (major)` to `pass` in the human-verification record.
- All automated gates pass for this plan: TypeScript clean, build clean, 903 tests green.
- Grep gates verified post-28-14:
  - `grep -c 'onDragMove={handleDragMove}' src/Grid/CanvasWrapper.tsx` = 1
  - `grep -c '_testComputeZoneFromDragMove' src/Grid/CanvasWrapper.tsx` = 3 (export + internal call + JSDoc reference)
  - `grep -c '(activatorEvent as PointerEvent)' src/Grid/CanvasWrapper.tsx` = 0
  - `grep -c 'active.rect.current.initial' src/Grid/CanvasWrapper.tsx` = 4
  - `grep -c 'NaN inputs (gap-closure 28-14' src/dnd/computeDropZone.test.ts` = 1
  - `grep -c 'Insert edge-drop regression lock (gap-closure 28-14' src/dnd/__tests__/CanvasWrapper.integration.test.tsx` = 1

---

## Self-Check: PASSED

- src/Grid/CanvasWrapper.tsx — FOUND
- src/dnd/__tests__/CanvasWrapper.integration.test.tsx — FOUND
- src/dnd/computeDropZone.test.ts — FOUND
- .planning/phases/28-cell-to-cell-drag/28-VERIFICATION.md — FOUND
- Commit 047a7dc — FOUND
- Commit 17978f7 — FOUND
- Commit af1188a — FOUND

---
*Phase: 28-cell-to-cell-drag*
*Completed: 2026-04-18*
