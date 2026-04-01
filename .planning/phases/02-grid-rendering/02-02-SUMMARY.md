---
phase: 02-grid-rendering
plan: 02
subsystem: grid-rendering
tags: [grid, components, divider, leaf, action-bar, flex-layout, pointer-events, react-memo]
dependency_graph:
  requires: [02-01]
  provides: [GridNodeComponent, ContainerNodeComponent, Divider, LeafNodeComponent, ActionBar]
  affects: [src/Grid, src/test]
tech_stack:
  added: []
  patterns: [React.memo per-node selectors, pointer-capture drag, local-state live preview, single store commit on pointerup, flex-ratio sizing]
key_files:
  created:
    - src/Grid/GridNode.tsx
    - src/Grid/ContainerNode.tsx
    - src/Grid/Divider.tsx
    - src/Grid/LeafNode.tsx
    - src/Grid/ActionBar.tsx
  modified:
    - src/Grid/index.ts
    - src/test/grid-rendering.test.tsx
    - src/test/divider.test.tsx
decisions:
  - "base-ui TooltipTrigger uses render prop (not asChild) — plan used radix-style asChild but installed component is base-ui"
  - "img alt='' has presentation ARIA role in testing-library — tests use querySelector instead of getByRole('img')"
metrics:
  duration: 8min
  completed: 2026-04-01
  tasks_completed: 2
  files_changed: 7
---

# Phase 02 Plan 02: Grid Components Summary

Five interconnected Grid components rendering the tree as a visible, interactive flex layout with draggable dividers and cell actions.

## What Was Built

**GridNode dispatcher** — `React.memo` component subscribing only to `findNode(state.root, id)?.type`. Dispatches to `ContainerNodeComponent` or `LeafNodeComponent`. Returns null for missing nodes. Primitive string selector ensures stable re-render only on node type change (REND-01, REND-09).

**ContainerNode** — `React.memo` component rendering a flex row or column based on `direction`. Uses `localSizes` React state for live divider drag preview — Divider writes to this during `pointermove`, ContainerNode re-renders with no store writes. Inline `style={{ flex: activeSizes[i] }}` drives child sizing. `min-h-0 min-w-0` on child wrappers fixes Safari 15 flex overflow (REND-02).

**Divider** — `React.memo` with pointer-capture drag. Stores drag start position and sizes in a ref. On `pointermove`, computes new weight distribution and calls `onLocalSizesChange` (no store write). On `pointerup`, computes final delta from `lastSizesRef` and calls `resize()` exactly once. 8px invisible hit area, 2px visible line on canvas hover (`group-hover`), pill grab handle on divider hover. `cursor-row-resize` for horizontal dividers, `cursor-col-resize` for vertical dividers (REND-03).

**LeafNode** — `React.memo` with three states: empty (dashed `border-[#333333]`), filled (`<img>` with `object-fit` from `leaf.fit`), selected (`ring-2 ring-[#3b82f6] ring-inset`). Uses `isolation: isolate` for Safari stacking context fix. ActionBar fades in/out on hover with 150ms transition and `pointer-events-none` when hidden (REND-04, REND-05, REND-06, REND-10).

**ActionBar** — `React.memo` floating bar with 4 icon-only buttons wrapped in base-ui Tooltips. Split H, Split V, Remove (red), Toggle Fit. `bg-black/70 backdrop-blur-sm` background. Each button 32×32px (REND-06).

## Tests Added

- `divider.test.tsx`: 7 tests — setPointerCapture, pointermove calls onLocalSizesChange (no store write), pointerup calls resize() with correct args, cursor class per direction, grab handle CSS present
- `grid-rendering.test.tsx`: 18 tests — dispatcher, flex-row/col, divider count, empty state, filled state (cover/contain), selection ring, safe zone, React.memo verification, isolate class

Total: 104 tests passing (was 79 before this plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Detail] base-ui TooltipTrigger uses render prop not asChild**
- **Found during:** Task 2 ActionBar implementation
- **Issue:** Plan specified `<TooltipTrigger asChild><button .../></TooltipTrigger>` (radix-ui pattern). The installed tooltip.tsx wraps `@base-ui/react/tooltip` which uses `render` prop instead of `asChild`
- **Fix:** Used `<TooltipTrigger render={<button .../>}>` pattern matching base-ui API
- **Files modified:** src/Grid/ActionBar.tsx

**2. [Rule 1 - Bug] img alt="" has presentation ARIA role**
- **Found during:** Task 2 test writing
- **Issue:** `<img alt="">` gets implicit ARIA role of "presentation", not "img". `screen.getByRole('img')` fails because testing-library respects this
- **Fix:** Tests use `leafEl.querySelector('img')` instead of `screen.getByRole('img')` for filled-media assertions
- **Files modified:** src/test/grid-rendering.test.tsx

## Known Stubs

None — all components are fully wired to the store.

## Self-Check: PASSED
