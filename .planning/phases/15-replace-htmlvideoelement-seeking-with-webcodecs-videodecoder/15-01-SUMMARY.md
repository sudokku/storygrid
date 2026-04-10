---
phase: 15-replace-htmlvideoelement-seeking-with-webcodecs-videodecoder
plan: "01"
subsystem: export
tags: [webcodecs, mediabunny, canvas, types, tests]
dependency_graph:
  requires: []
  provides:
    - DrawableSource union type in export.ts
    - CanvasImageSource parameter on renderGridIntoContext / renderGridToCanvas / renderNode
    - VideoFrame + OffscreenCanvas branches in getSourceDimensions
    - videoExport-mediabunny.test.ts test stubs for Plan 02
  affects:
    - src/lib/export.ts
    - src/lib/videoExport.ts (caller — backward-compatible, no source change needed)
    - src/test/videoExport-audio.test.ts
    - src/test/videoExport-mediabunny.test.ts
tech_stack:
  added: []
  patterns:
    - CanvasImageSource as the canonical video-source type in the render pipeline
    - typeof-guard pattern for VideoFrame/OffscreenCanvas in non-browser environments
key_files:
  created:
    - src/test/videoExport-mediabunny.test.ts
  modified:
    - src/lib/export.ts
    - src/test/videoExport-audio.test.ts
decisions:
  - DrawableSource union type introduced for getSourceDimensions; draw helpers use native CanvasImageSource (which is broader) — minimal churn in callers
  - typeof guards added for VideoFrame and OffscreenCanvas to prevent ReferenceError in jsdom/Vitest environments
  - HTMLVideoElement IS CanvasImageSource — existing videoExport.ts caller (passing Map<string, HTMLVideoElement>) remains type-compatible without source change
metrics:
  duration: "~8 min"
  completed: "2026-04-11"
  tasks: 2
  files: 3
---

# Phase 15 Plan 01: Export.ts CanvasImageSource Foundation Summary

CanvasImageSource type foundation for the Mediabunny VideoSampleSink decode pipeline: extended `getSourceDimensions` to handle `VideoFrame`/`OffscreenCanvas`, widened draw-helper signatures to `CanvasImageSource`, renamed `videoElements` parameter to `videoFrameMap` throughout the render pipeline, fixed audio test file, and created decode-pipeline test stubs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend export.ts types for CanvasImageSource | 5cdd26b | src/lib/export.ts |
| 2 | Fix videoExport-audio.test.ts and create videoExport-mediabunny.test.ts stubs | ef0e2bf | src/test/videoExport-audio.test.ts, src/test/videoExport-mediabunny.test.ts |

## What Was Built

### Task 1 — export.ts CanvasImageSource extension

- Added `DrawableSource` exported union type: `HTMLImageElement | HTMLVideoElement | ImageBitmap | VideoFrame | OffscreenCanvas`
- Extended `getSourceDimensions` parameter from the old three-type union to `DrawableSource`, adding:
  - `VideoFrame` branch: returns `{ w: src.displayWidth, h: src.displayHeight }` (with `typeof VideoFrame !== 'undefined'` guard)
  - `OffscreenCanvas` branch: returns `{ w: src.width, h: src.height }` (with `typeof OffscreenCanvas !== 'undefined'` guard)
- Changed `drawCoverImage`, `drawContainImage`, `drawPannedCoverImage`, `drawPannedContainImage`, `drawLeafToCanvas` img parameter to `CanvasImageSource` (native browser type — broader than the old union, covers VideoFrame and OffscreenCanvas)
- Renamed `videoElements?: Map<string, HTMLVideoElement>` to `videoFrameMap?: Map<string, CanvasImageSource>` in `renderNode`, `renderGridIntoContext`, and `renderGridToCanvas`
- Updated `renderNode` video branch: `videoFrameMap?.has(leaf.mediaId)` → `const source = videoFrameMap.get(leaf.mediaId)!` → `drawLeafToCanvas(ctx, source, rect, leaf)`

Backward compatibility: `HTMLVideoElement` is a `CanvasImageSource`, so `videoExport.ts` (which passes `Map<string, HTMLVideoElement>`) remains type-compatible with zero source changes.

### Task 2 — Test file cleanup and stubs

**videoExport-audio.test.ts:**
- Removed `buildExportVideoElements` import (function deleted in Plan 02)
- Removed `makeVideoEl` helper (no longer used)
- Removed entire `describe('buildExportVideoElements — conditional muted', ...)` block (6 tests testing a deleted function)
- Retained all `hasAudioEnabledVideoLeaf` describe blocks and `makeLeaf` helper unchanged

**videoExport-mediabunny.test.ts (new):**
- `MockVideoSample` interface and `makeSample` factory for unit testing without live Mediabunny
- `findSampleForTime` describe with 6 `it.todo` stubs (Plan 02 will implement)
- `decodeVideoToSamples` describe with 4 `it.todo` stubs (Plan 02 will implement)
- `computeLoopedTime — seconds sanity` describe with 5 passing tests confirming seconds-only operation (no `* 1_000_000` conversion needed — `VideoSample.timestamp` is in seconds per mediabunny.d.ts line 3023)

## Verification

- `npx tsc --noEmit` exits 0 — no type errors
- `npx vitest run src/test/videoExport-audio.test.ts src/test/videoExport-mediabunny.test.ts` — 16 passed, 10 todo
- `npx vitest run` full suite — 626 passed / 2 skipped / 10 todo

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None that affect plan goal. The `it.todo` stubs in `videoExport-mediabunny.test.ts` are intentional placeholders for Plan 02 implementation.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced.

## Self-Check: PASSED

- `src/lib/export.ts` — FOUND (modified)
- `src/test/videoExport-audio.test.ts` — FOUND (modified, no `buildExportVideoElements`)
- `src/test/videoExport-mediabunny.test.ts` — FOUND (created)
- Commit `5cdd26b` — FOUND (Task 1)
- Commit `ef0e2bf` — FOUND (Task 2)
