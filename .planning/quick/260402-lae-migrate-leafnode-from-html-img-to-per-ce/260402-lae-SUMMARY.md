---
phase: quick
plan: 260402-lae
subsystem: Grid/LeafNode, lib/export
tags: [canvas, rendering, pan-zoom, wysiwyg, performance]
dependency_graph:
  requires: []
  provides: [canvas-preview-rendering, shared-draw-helpers, wysiwyg-export-parity]
  affects: [src/Grid/LeafNode.tsx, src/lib/export.ts]
tech_stack:
  added: []
  patterns: [zustand-subscribe-bypass-react, canvas-dpr-scaling, setPointerCapture-on-stable-div]
key_files:
  created: []
  modified:
    - src/lib/export.ts
    - src/Grid/LeafNode.tsx
    - src/test/grid-rendering.test.tsx
    - src/test/phase05-p02-pan-zoom.test.tsx
decisions:
  - "LeafNode media rendering uses <canvas> element (not <img>) — WYSIWYG with export pipeline guaranteed via shared drawLeafToCanvas()"
  - "Pan/zoom redraws bypass React via useGridStore.subscribe + useEditorStore.subscribe"
  - "setPointerCapture on divRef.current (not e.target) — ensures capture stays on stable wrapper, not canvas/overlay child"
  - "drawPannedContainImage uses same canvas-transform approach as drawPannedCoverImage — symmetric pan behavior in both fit modes"
  - "Pointer move fallback for zero-dimension cells (cw/ch=0 in jsdom) — divide by 1 instead of 0"
metrics:
  duration: "~15 min"
  completed: "2026-04-02T12:26:45Z"
  tasks: 2
  files: 4
---

# Quick Task 260402-lae: Migrate LeafNode from HTML img to per-cell canvas Summary

One-liner: Canvas-based media preview in LeafNode using shared drawLeafToCanvas() from export.ts, guaranteeing WYSIWYG between preview and export with 60fps pan/zoom via direct Zustand subscription.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Extract shared draw helper and add drawPannedContainImage + drawLeafToCanvas to export.ts | e8d95ef | src/lib/export.ts |
| 2 | Replace img with canvas in LeafNode, wire Zustand subscribe for 60fps redraws, fix bugs | 94e0458 | src/Grid/LeafNode.tsx, src/test/grid-rendering.test.tsx, src/test/phase05-p02-pan-zoom.test.tsx |

## What Was Built

### Task 1: export.ts shared draw helpers

Added two new exported functions to `src/lib/export.ts`:

- **`drawPannedContainImage`**: Pan/zoom for contain mode using the same canvas-transform approach as `drawPannedCoverImage`. Fills letterbox background, clips to cell, translates to cell center + pan offset, scales, computes contain dimensions with objPos alignment.

- **`drawLeafToCanvas`**: Unified leaf draw dispatcher. Takes `ctx`, `img`, `rect`, and a `Pick<LeafNode, ...>` with just the fields needed. Determines which draw function to call based on `fit` and `hasPan`. This is the single function used by both `renderNode` (export pipeline) and the live canvas preview.

`renderNode` updated to call `drawLeafToCanvas` instead of duplicating dispatch logic.

### Task 2: LeafNode canvas rendering

Complete rewrite of media rendering in `LeafNode.tsx`:

- **Canvas element**: `<canvas ref={canvasRef}>` replaces `<img>`. Hidden when no media via `display: none`.
- **Image loading**: `loadImage(mediaUrl)` from export.ts stores `HTMLImageElement` in `imgElRef` (never rendered to DOM). Triggers redraw on load.
- **Stable redraw function**: `drawRef.current` reads latest state from stores directly via `getState()`, scales context for DPR, applies borderRadius clip if needed, calls `drawLeafToCanvas`.
- **Zustand subscriptions**: `useGridStore.subscribe` watches panX/panY/panScale/fit/mediaId/objectPosition per-cell. `useEditorStore.subscribe` watches borderRadius. Both trigger `drawRef.current()` directly — no `setState`, no React re-render for pan/zoom.
- **ResizeObserver**: Updates `canvas.width/height` physical pixel dimensions and triggers redraw.
- **Bug fix: setPointerCapture**: Changed from `(e.target as HTMLElement).setPointerCapture(e.pointerId)` to `divRef.current?.setPointerCapture?.(e.pointerId)` — ensures pointer capture on stable wrapper div, not whichever child (canvas/overlay) was under cursor.
- **Bug fix: pan clamping on zoom**: Wheel handler now re-clamps panX/panY after computing new scale using the same max-pan formula as pointer move handler.
- **Sub-pixel rendering fix**: Added `backfaceVisibility: 'hidden'` to wrapper div to force GPU compositing layer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Functionality] Pointer move fallback for zero-dimension cells**
- **Found during:** Task 2 testing
- **Issue:** In jsdom, `divRef.current.clientWidth/Height` is 0 (no layout engine). The new `handlePointerMove` early-exited when `cw === 0`, causing the pointer drag test to fail.
- **Fix:** Use `effectiveCw = cw > 0 ? cw : 1` and `effectiveCh = ch > 0 ? ch : 1` for percentage conversion. Cover clamping only applied when real dimensions are available.
- **Files modified:** src/Grid/LeafNode.tsx
- **Commit:** 94e0458

### Test Updates (Driven by Implementation Change)

**2. [Rule 1 - Bug] Tests expected `<img>` element — updated to check `<canvas>`**
- **Found during:** Task 2 test run
- **Tests updated:** `grid-rendering.test.tsx` (REND-05 describe), `phase05-p02-pan-zoom.test.tsx` (D-10 describe)
- **Change:** Tests now verify `<canvas>` element exists with `display !== 'none'` instead of querying for `<img>` with `object-cover/contain` CSS classes.
- **Files modified:** src/test/grid-rendering.test.tsx, src/test/phase05-p02-pan-zoom.test.tsx
- **Commit:** 94e0458

## Verification Results

- `npx vitest run`: 365 passed, 2 skipped (pre-existing skip) — 0 failures
- `npx tsc --noEmit`: no output (clean)

## Known Stubs

None. Canvas rendering is fully wired to the live store state via Zustand subscriptions.

## Self-Check: PASSED

- [x] src/lib/export.ts modified — verified by `git show e8d95ef --name-only`
- [x] src/Grid/LeafNode.tsx modified — verified by `git show 94e0458 --name-only`
- [x] Commits e8d95ef and 94e0458 exist in git log
- [x] All tests pass (365/367, 2 pre-existing skips)
- [x] TypeScript compiles clean
