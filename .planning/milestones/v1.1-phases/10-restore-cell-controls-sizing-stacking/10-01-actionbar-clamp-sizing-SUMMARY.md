---
phase: 10-restore-cell-controls-sizing-stacking
plan: 01
subsystem: grid/action-bar
tags: [cell-controls, sizing, portal-aware, course-correction]
requirements_completed: [CELL-02]
gap_closure: true
dependency-graph:
  requires:
    - "src/Grid/ActionBar.tsx (existing component)"
    - "Portal architecture from quick-260407-q2s (1967219) — ActionBar renders via createPortal to document.body in viewport space"
  provides:
    - "Fixed 64px ActionBar buttons (w-16 h-16) with 32px lucide icons (ICON_SIZE=32) — usable target sizes"
    - "Stable button sizing across viewport widths (no scale compensation needed in viewport-space portal)"
  affects:
    - "src/Grid/ActionBar.tsx"
    - "src/Grid/__tests__/ActionBar.test.tsx"
key-files:
  modified:
    - "src/Grid/ActionBar.tsx"
    - "src/Grid/__tests__/ActionBar.test.tsx"
status: complete
---

# 10-01 — ActionBar Sizing (Course-Corrected)

## What Was Built

ActionBar buttons sized at fixed `w-16 h-16` (64px) with `ICON_SIZE=32` lucide icons, matching the deliberate user-chosen "doubled from 32px" sizing in place before phase 10 began.

## Course-Correction History

This plan went through three states before landing:

1. **Initial execution (commit `d499339`):** Applied `clamp(28px, 2.2vw, 36px)` per PLAN.md, on the assumption that yesterday's gsd:quick revert (`1967219`) was a regression caused by the v1.1 audit. Tests updated to assert clamp() shape.

2. **User feedback during human-verification:** "The buttons in ActionBar are minuscule and unusable." Root cause: the v1.1 audit was wrong. Yesterday's gsd:quick (`1967219`) deliberately reverted clamp() because the new portal architecture (`createPortal` to `document.body`) renders the ActionBar in viewport space, outside the canvas transform — scale compensation is unnecessary, and clamp() at typical viewports produces unusably small buttons (2.2vw @ 1280px ≈ 28px floor).

3. **Revert + restore (commits `b9796fb` → `9e952d8` → `9e70c48`):**
   - `b9796fb` reverted `d499339` (clamp() → restored prior `w-16 h-16` / `ICON_SIZE=32`)
   - `9e952d8` momentarily matched yesterday's `w-8 h-8` / `ICON_SIZE=16`
   - `9e70c48` bumped to final `w-16 h-16` / `ICON_SIZE=32` per user request — buttons need to be large enough to be usable; portal means fixed sizing is the right architectural choice.

## Final State

- `src/Grid/ActionBar.tsx:50` — `const ICON_SIZE = 32`
- `src/Grid/ActionBar.tsx:51` — `const btnClass = '... w-16 h-16'`
- `src/Grid/__tests__/ActionBar.test.tsx` Test 2 asserts `w-16` / `h-16` with comment documenting the portal-aware rationale.

## Acceptance vs Plan

The original plan's success criteria (clamp() values, viewport-extreme math) were based on the faulty audit premise and are **superseded**. The actual phase-level success criterion CELL-02 is now met by:

- Fixed sizing in viewport-space portal → buttons are stable across viewport widths by construction (no calc, no clamp, no scale dependency)
- 64px target size → comfortable click target on all supported viewports
- Portal architecture → no per-cell stacking-context interference (also satisfies CELL-01)

## Tests

- `src/Grid/__tests__/ActionBar.test.tsx` — 4 tests pass
- Full vitest suite — 489 passed / 2 skipped / 0 failed across 43 files
- `npx tsc --noEmit` — clean

## Commits

- `d499339` feat(10-01): re-land CELL-02 clamp()-based ActionBar sizing *(reverted)*
- `6f8db9d` docs(10-01): complete ActionBar clamp sizing plan *(superseded)*
- `b9796fb` Revert "feat(10-01): re-land CELL-02 clamp()-based ActionBar sizing"
- `9e952d8` fix(10-01): restore portal-aware w-8 h-8 ActionBar sizing
- `9e70c48` fix(10-01): bump ActionBar to w-16 h-16 (64px) for usable button targets

## Lessons (for future audits)

The v1.1 milestone audit flagged 1967219's clamp removal as "CELL-02 regression". It wasn't — it was an architectural improvement. **Audit gap-closure plans must verify the prior commit's commit message and rationale before assuming a "revert" was unintentional.** A diff-only audit cannot distinguish a regression from a deliberate architectural pivot.
