---
phase: 07-cell-controls-display-polish
plan: 01
subsystem: ui
tags: [react, tailwind, clamp, resize-observer, overflow, canvas, leafnode, actionbar]

# Dependency graph
requires:
  - phase: 06-video-support-v2
    provides: LeafNode canvas rendering pipeline, ContainerNode flex layout
  - phase: 02-grid-rendering
    provides: ResizeObserver polyfill in test setup, canvasScale in editorStore
provides:
  - ActionBar buttons sized via clamp(28px, 2.2vw, 36px) — physically stable across screen sizes
  - LeafNode root overflow-visible with canvas clipped by inner overflow-hidden wrapper
  - Empty placeholder icon and label scaled via clamp(); label hidden below 80px cell height
  - isTooSmall state driven by ResizeObserver contentRect.height
affects:
  - phase 07-02 (cell controls continue; uses same LeafNode and ActionBar)
  - any future phase modifying LeafNode or ActionBar sizing

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "clamp() for viewport-relative CSS sizing without media queries"
    - "overflow-visible root + overflow-hidden inner wrapper to isolate canvas clipping from control overflow"
    - "ResizeObserver integrated into existing useLayoutEffect callback to avoid duplicate observers"
    - "isTooSmall state from ResizeObserver.contentRect.height for conditional CSS class"
    - "jsdom strips clamp() from style — test via absence of old fixed classes, not positive clamp() assertion"

key-files:
  created:
    - src/Grid/__tests__/ActionBar.test.tsx
    - src/Grid/__tests__/LeafNode.test.tsx
  modified:
    - src/Grid/ActionBar.tsx
    - src/Grid/LeafNode.tsx
    - src/Grid/ContainerNode.tsx

key-decisions:
  - "ICON_SIZE kept at 16 in ActionBar — scale(1/canvasScale) transform on parent handles physical stability (D-05)"
  - "borderRadius moved from root div style to canvas wrapper div style — rounded corner clipping now correct"
  - "ContainerNode child wrapper overflow-hidden removed — was re-clipping ActionBar that overflows cell root"
  - "jsdom strips clamp() from element.style.width — test uses absence-of-old-class pattern (no w-8 h-8)"
  - "isTooSmall integrated into existing useLayoutEffect ResizeObserver (not a separate observer)"

patterns-established:
  - "Pattern: overflow-visible cell root + overflow-hidden canvas wrapper — use for any future cell-level floating controls"
  - "Pattern: clamp() inline style for viewport-responsive sizing — keeps implementation in component, no CSS file needed"

requirements-completed: [CELL-01, CELL-02, CELL-03]

# Metrics
duration: 7min
completed: 2026-04-07
---

# Phase 07 Plan 01: Cell Controls & Display Polish — ActionBar Clamp Sizing + LeafNode Overflow Isolation Summary

**ActionBar buttons use clamp(28px, 2.2vw, 36px) inline style; LeafNode root is overflow-visible with canvas clipped via inner overflow-hidden wrapper; empty placeholder scales via clamp() and hides label below 80px via ResizeObserver-driven isTooSmall state**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-07T05:52:15Z
- **Completed:** 2026-04-07T05:59:04Z
- **Tasks:** 2
- **Files modified:** 5 (ActionBar.tsx, LeafNode.tsx, ContainerNode.tsx, ActionBar.test.tsx, LeafNode.test.tsx)

## Accomplishments
- CELL-02: ActionBar buttons replaced fixed w-8 h-8 with BTN_SIZE constant `clamp(28px, 2.2vw, 36px)` applied as inline style to all 7 buttons
- CELL-01: LeafNode root changed from overflow-hidden to overflow-visible; canvas wrapped in inner overflow-hidden div so media clips correctly while ActionBar can overflow cell bounds
- CELL-03: Empty cell ImageIcon uses clamp(20px, 1.6vw, 32px) inline style; label uses Tailwind arbitrary value text-[clamp(10px,0.7vw,14px)]; label hidden via isTooSmall state when cell height < 80px
- borderRadius moved from root div style to canvas wrapper div — rounded corners clip media correctly in the new structure
- ContainerNode child wrapper overflow-hidden removed — it was re-clipping the ActionBar that overflows the cell root

## Task Commits

Each task was committed atomically:

1. **Task 1: ActionBar clamp-based sizing (CELL-02)** - `f7357a4` (feat)
2. **Task 2: LeafNode overflow isolation + empty cell scaling (CELL-01, CELL-03)** - `de72570` (feat)

## Files Created/Modified
- `src/Grid/ActionBar.tsx` — BTN_SIZE constant + inline style on all 7 buttons; w-8 h-8 removed
- `src/Grid/LeafNode.tsx` — overflow-visible root, canvas wrapper, clamp placeholder, isTooSmall ResizeObserver
- `src/Grid/ContainerNode.tsx` — removed overflow-hidden from child wrapper div
- `src/Grid/__tests__/ActionBar.test.tsx` — 4 behavior tests (flex/gap preserved, no fixed size, aria-labels, all 7 buttons)
- `src/Grid/__tests__/LeafNode.test.tsx` — 7 behavior tests (overflow-visible, canvas wrapper, clamp icon, clamp label, isTooSmall hide, isTooSmall show, ancestor overflow check)

## Decisions Made

- **ICON_SIZE kept at 16:** Per D-05, logical (unscaled) icon size stays constant; `scale(1/canvasScale)` transform in ActionBar wrapper handles physical pixel stability across zoom levels. Not changing icon size simplifies the implementation.
- **borderRadius moved to canvas wrapper:** The inner overflow-hidden wrapper must respect borderRadius to clip media to rounded corners. Removed from root div (overflow-visible with no clipping); kept only backfaceVisibility on root.
- **ContainerNode overflow-hidden removed:** The container child wrapper's `overflow-hidden` was the direct parent of leaf cells and was clipping the ActionBar. Since media clipping is now handled by the inner canvas wrapper in LeafNode, the container wrapper no longer needs overflow-hidden.
- **jsdom clamp() test strategy:** jsdom strips `clamp()` function values from `element.style.width/height`. Tests verify absence of old fixed `w-8 h-8` classes rather than positive assertion on clamp value. Acceptance criteria verified by grep.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed overflow-hidden from ContainerNode child wrapper**
- **Found during:** Task 2 (LeafNode overflow isolation)
- **Issue:** ContainerNode child wrapper `<div className="min-h-0 min-w-0 overflow-hidden">` is the direct DOM parent of leaf cells. With LeafNode root changed to overflow-visible, the ActionBar would still be clipped by this ancestor.
- **Fix:** Removed overflow-hidden from the class (kept min-h-0 min-w-0 for flex sizing). Canvas media clipping is preserved via LeafNode's inner overflow-hidden div.
- **Files modified:** src/Grid/ContainerNode.tsx
- **Verification:** Full test suite 418/420 pass; build succeeds
- **Committed in:** de72570 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** The plan documented this as a possible finding ("verify no intermediate parents re-clip"). The fix was required for CELL-01 correctness. No scope creep.

## Issues Encountered

- jsdom does not support `clamp()` in inline styles (strips to empty string). Had to adapt Test 2 in ActionBar tests to check absence of old fixed classes instead of presence of clamp value. The grep-based acceptance criteria still validates the clamp constant is correctly defined and applied.

## Known Stubs

None — all changes are structural CSS/layout. No placeholder data or empty data sources.

## Next Phase Readiness
- CELL-01, CELL-02, CELL-03 resolved — ActionBar overflow and sizing issues fixed
- Ready for 07-02 (video thumbnail extraction + sidebar display, safe zone overlay)
- Canvas clipping infrastructure is now properly isolated; any future floating controls can use the overflow-visible root pattern

---
*Phase: 07-cell-controls-display-polish*
*Completed: 2026-04-07*
