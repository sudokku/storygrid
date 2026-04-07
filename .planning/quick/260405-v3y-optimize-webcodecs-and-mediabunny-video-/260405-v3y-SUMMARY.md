---
phase: quick-260405-v3y
plan: 01
subsystem: video-export
tags: [performance, webcodecs, mediabunny, canvas]
dependency_graph:
  requires: [quick-260405-s9u, quick-260405-uiy]
  provides: [optimized-video-export-pipeline]
  affects: [src/lib/videoExport.ts, src/lib/export.ts]
tech_stack:
  added: []
  patterns: [canvas-context-reuse, persistent-image-cache, hardware-accelerated-encoding]
key_files:
  created: []
  modified:
    - src/lib/export.ts
    - src/lib/videoExport.ts
decisions:
  - renderGridIntoContext extracted from renderGridToCanvas to enable context reuse without breaking image export callers
  - QUALITY_HIGH preset replaced with explicit 6Mbps bitrate for predictable encoding behavior
  - FPS and FRAME_DURATION_SEC promoted to module level so seekAllVideosTo can reference them
metrics:
  duration: 102s
  completed: "2026-04-05"
  tasks_completed: 2
  files_modified: 2
---

# Phase quick-260405-v3y Plan 01: Optimize WebCodecs + Mediabunny Video Export Summary

**One-liner:** Four-optimization video export pipeline: hardware-accelerated H.264/VP9 encoding, canvas context reuse, persistent image cache, and tighter seek parameters.

## What Was Built

### Task 1: renderGridIntoContext added to export.ts (commit: 0b6fdcf)

Extracted rendering logic from `renderGridToCanvas` into a new exported function `renderGridIntoContext` that accepts an existing `CanvasRenderingContext2D` and an optional pre-existing `imageCache`. The function paints the background (solid or gradient) and calls `renderNode` using the provided ctx and cache.

`renderGridToCanvas` now delegates entirely to `renderGridIntoContext`, preserving backward compatibility for image export while enabling video export to render directly into the stable canvas context without any intermediate allocation.

### Task 2: Video export pipeline optimized in videoExport.ts (commit: 03b9cef)

Applied all four optimizations from the research document:

**A. Hardware acceleration (Priority 1):**
- `CanvasSource` now configured with `hardwareAcceleration: 'prefer-hardware'`
- `latencyMode: 'quality'` and `keyFrameInterval: 2` added
- `QUALITY_HIGH` import removed; explicit `6_000_000` (6 Mbps) bitrate used instead

**B. Eliminate per-frame canvas allocation (Priority 2):**
- Frame loop now calls `renderGridIntoContext(stableCtx, ...)` directly
- No `frameCanvas` created, no `stableCtx.drawImage(frameCanvas, 0, 0)` copy needed
- `imageCache` created once before the loop and passed to every frame render

**C. Reduce seek timeout (Priority 3):**
- Safety timeout reduced from 500ms to 100ms in `seekAllVideosTo`

**D. Tighten seek skip threshold (Priority 4):**
- `FPS` and `FRAME_DURATION_SEC` promoted to module level
- Skip threshold changed from hardcoded `0.01` to `FRAME_DURATION_SEC * 0.5` (0.0167s at 30fps)

## Verification

- `npx vitest run`: 399 passed, 2 skipped — no regressions
- `npx tsc --noEmit`: no type errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- src/lib/export.ts: modified (renderGridIntoContext added, renderGridToCanvas refactored)
- src/lib/videoExport.ts: modified (all four optimizations applied)
- Commits: 0b6fdcf (Task 1), 03b9cef (Task 2)
