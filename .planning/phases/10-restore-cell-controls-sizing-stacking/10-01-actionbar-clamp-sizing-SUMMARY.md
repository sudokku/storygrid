---
phase: 10-restore-cell-controls-sizing-stacking
plan: 01
subsystem: grid/action-bar
tags: [cell-controls, sizing, viewport-stable, clamp, regression-fix]
requirements_completed: [CELL-02]
gap_closure: true
dependency-graph:
  requires:
    - "src/Grid/ActionBar.tsx (existing component)"
    - "lucide-react (style prop pass-through to svg)"
  provides:
    - "Viewport-stable 28–36px ActionBar buttons via clamp(28px, 2.2vw, 36px)"
    - "Proportional icon sizing via clamp(16px, 1.4vw, 20px)"
  affects:
    - "src/Grid/__tests__/ActionBar.test.tsx (Test 2 updated)"
tech-stack:
  added: []
  patterns:
    - "Inline React.CSSProperties style with clamp() for viewport-responsive sizing"
    - "lucide-react icons styled via `style` prop (not `size`) to support CSS functions"
key-files:
  created: []
  modified:
    - src/Grid/ActionBar.tsx
    - src/Grid/__tests__/ActionBar.test.tsx
decisions:
  - "clamp() via inline style (not Tailwind arbitrary values) — lucide's size prop only accepts numbers, so inline style is the cleanest cross-browser path"
  - "btnClass kept as a string without size classes — template-literal concatenations (e.g. `${btnClass} cursor-grab`) remain untouched"
  - "ActionBar.test.tsx Test 2 rewritten: jsdom CSSOM strips clamp() expressions; test now asserts the absence of fixed w-16/h-16/w-8/h-8 classes and delegates clamp() verification to plan 10-01's grep acceptance criteria"
metrics:
  duration: 4min
  tasks: 1
  files: 2
  completed: 2026-04-08
---

# Phase 10 Plan 01: ActionBar clamp() Sizing Summary

Re-lands the Phase 7 CELL-02 viewport-stable ActionBar button sizing (`clamp(28px, 2.2vw, 36px)`) that was reverted in commit 1476df2 during an abandoned portal experiment.

## What Changed

- **src/Grid/ActionBar.tsx**
  - Removed `const ICON_SIZE = 32` and the `w-16 h-16` Tailwind size classes from `btnClass`
  - Added `btnStyle: React.CSSProperties` with `width/height: 'clamp(28px, 2.2vw, 36px)'`
  - Added `iconStyle: React.CSSProperties` with `width/height: 'clamp(16px, 1.4vw, 20px)'`
  - Applied `style={btnStyle}` to all 7 button sites (drag handle, upload, split H, split V, toggle fit, clear media, remove cell)
  - Replaced `size={ICON_SIZE}` with `style={iconStyle}` on all lucide icons (`GripVertical`, `Upload`, `SplitSquareHorizontal`, `SplitSquareVertical`, `Minimize2`, `Maximize2`, `ImageOff`, `Trash2` — 8 icon invocations since the fit-toggle ternary renders two distinct icon variants)
  - No dependency, import, or handler changes

- **src/Grid/__tests__/ActionBar.test.tsx**
  - Test 2 rewritten to match the re-landed clamp() shape: asserts fixed `w-16`/`h-16`/`w-8`/`h-8` classes are absent (the stale test asserted their presence per the reverted behavior)

## Viewport Math

- At 1024px viewport: 2.2vw = 22.5px → clamped up to 28px floor
- At 3840px viewport: 2.2vw = 84.5px → clamped down to 36px ceiling
- Icons track proportionally: 16px at 1024px, 20px at 3840px

## Verification

- `grep -c "clamp(28px, 2.2vw, 36px)" src/Grid/ActionBar.tsx` → 2
- `grep -c "clamp(16px, 1.4vw, 20px)" src/Grid/ActionBar.tsx` → 2
- `grep "w-16 h-16" src/Grid/ActionBar.tsx` → no matches
- `grep "ICON_SIZE" src/Grid/ActionBar.tsx` → no matches
- `grep -c "style={btnStyle}" src/Grid/ActionBar.tsx` → 7 (exact per plan)
- `grep -c "style={iconStyle}" src/Grid/ActionBar.tsx` → 8 (7 sites, +1 for the fit-toggle ternary rendering both Minimize2 and Maximize2)
- `npx tsc --noEmit` → exit 0
- `npm test -- --run` → 489 passed, 2 skipped (43 test files, all green)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated ActionBar.test.tsx Test 2 to match re-landed behavior**

- **Found during:** Task 1 verification (`npm test -- --run`)
- **Issue:** `ActionBar.test.tsx` Test 2 (from plan 07-01) asserted `btn.className` contains `w-16` and `h-16`. That assertion was written for the reverted-state code (commit 1476df2); re-landing clamp() sizing legitimately removes those classes.
- **Fix:** Rewrote Test 2 to assert the fixed size classes are absent. jsdom's CSSOM strips `clamp()` values during inline-style parsing, so a direct computed-style check is not possible in jsdom; clamp() presence is verified via the plan's source-level grep criteria instead (matching the pattern in `LeafNode.test.tsx` Test 3 which has the same jsdom limitation).
- **Files modified:** `src/Grid/__tests__/ActionBar.test.tsx`
- **Commit:** d499339

### Acceptance Criterion Note

The plan specified `grep -c "style={iconStyle}" ... returns exactly 7`. The file contains **8** matches because the fit-toggle tooltip (site #5) renders either `<Minimize2 style={iconStyle} />` or `<Maximize2 style={iconStyle} />` via a ternary — two distinct icon JSX elements at a single site. The spirit of the criterion ("every lucide icon has iconStyle") is satisfied; this is an inherent property of the ternary pattern in the existing ActionBar.tsx, not a deviation from intent.

## Known Stubs

None.

## Self-Check: PASSED

- `src/Grid/ActionBar.tsx` — modified, grep criteria satisfied
- `src/Grid/__tests__/ActionBar.test.tsx` — modified
- Commit `d499339` — found in `git log`
- Full test suite: 489 passed / 2 skipped / 0 failed
