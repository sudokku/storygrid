---
phase: 29-esc-cancel-visual-polish
plan: 02
subsystem: ui
tags: [tailwind, css, animations, drag-and-drop, accessibility]

# Dependency graph
requires: []
provides:
  - "--ghost-cap: 200px CSS variable in top-level :root for DragPreviewPortal ghost size cap"
  - "animate-cell-wobble Tailwind utility class (150ms ±1.5deg rotation wobble)"
  - "animate-drop-flash Tailwind utility class (700ms box-shadow ring fade)"
  - "prefers-reduced-motion guards suppressing both new animation classes"
affects:
  - 29-03-PLAN (DragPreviewPortal uses max-w-[var(--ghost-cap)] max-h-[var(--ghost-cap)])
  - 29-04-PLAN (LeafNode uses animate-cell-wobble and animate-drop-flash)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tailwind theme.extend.animation + theme.extend.keyframes for custom animation utilities"
    - "@keyframes defined in index.css mirrored in tailwind.config.js for JIT utility generation"
    - "prefers-reduced-motion guard extends existing block (no duplicate media query)"

key-files:
  created: []
  modified:
    - tailwind.config.js
    - src/index.css

key-decisions:
  - "Used var(--primary) for drop-flash box-shadow (not var(--ring)) — higher contrast on dark canvas cells; --primary is oklch(0.922 0 0) in dark mode vs --ring oklch(0.556 0 0)"
  - "Extended existing prefers-reduced-motion block instead of adding a new one — single media query per spec"

patterns-established:
  - "CSS contract pattern: define CSS variable in index.css :root, reference in component via Tailwind arbitrary value syntax"
  - "Animation contract pattern: @keyframes in index.css + matching keyframes/animation in tailwind.config.js + prefers-reduced-motion guard in same CSS file"

requirements-completed: [CANCEL-02, GHOST-03, GHOST-04]

# Metrics
duration: 1min
completed: 2026-04-19
---

# Phase 29 Plan 02: CSS Animation Contract Summary

**--ghost-cap CSS variable (200px) + animate-cell-wobble (150ms ±1.5deg) + animate-drop-flash (700ms box-shadow ring) registered as Tailwind utilities with prefers-reduced-motion guards**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-19T00:43:17Z
- **Completed:** 2026-04-19T00:44:06Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `--ghost-cap: 200px` to top-level `:root` block in `src/index.css` — referenced by DragPreviewPortal via `max-w-[var(--ghost-cap)]`
- Registered `animate-cell-wobble` and `animate-drop-flash` as Tailwind utility classes via `theme.extend.animation` and `theme.extend.keyframes` in `tailwind.config.js`
- Defined matching `@keyframes cell-wobble` and `@keyframes drop-flash` in `src/index.css` following the existing `drag-hold-pulse` pattern
- Extended existing `prefers-reduced-motion` block to suppress both new animation classes — no duplicate media query

## Task Commits

Each task was committed atomically:

1. **Task 1: Add animation extensions to tailwind.config.js** - `fc83be1` (chore)
2. **Task 2: Add --ghost-cap variable and @keyframes to index.css** - `4476a1d` (chore)

## Files Created/Modified
- `tailwind.config.js` - Added `animation` and `keyframes` keys to `theme.extend` for cell-wobble and drop-flash utilities
- `src/index.css` - Added `--ghost-cap: 200px` to `:root`, two new `@keyframes` blocks, and reduced-motion suppression rules

## Decisions Made
- Used `var(--primary)` for `drop-flash` box-shadow instead of `var(--ring)` — primary token is `oklch(0.922 0 0)` in dark mode (high contrast on dark canvas cells), ring is `oklch(0.556 0 0)` (medium gray, lower contrast)
- Extended the single existing `prefers-reduced-motion` block rather than creating a second one — keeps CSS organized with a single motion-preference control point

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CSS contract fully established: `--ghost-cap`, `animate-cell-wobble`, and `animate-drop-flash` are all available
- Plan 03 (DragPreviewPortal) can reference `max-w-[var(--ghost-cap)]` and `max-h-[var(--ghost-cap)]` immediately
- Plan 04 (LeafNode) can apply `animate-cell-wobble` and `animate-drop-flash` classes immediately
- TypeScript check passes (`npx tsc --noEmit` exits 0) — no regressions

---
*Phase: 29-esc-cancel-visual-polish*
*Completed: 2026-04-19*
