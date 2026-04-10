---
phase: quick-260410-7sa
plan: 01
subsystem: video-export
tags: [video-export, mediarecorder, canvas, render-loop, performance]
dependency_graph:
  requires: []
  provides: [render-loop-fixes, isRendering-guard, captureStream-requestFrame, fastSeek, fonts-hoist]
  affects: [src/lib/videoExport.ts, src/lib/overlayExport.ts]
tech_stack:
  added: []
  patterns: [isRendering-mutex, CanvasCaptureMediaStreamTrack-requestFrame, fastSeek-fallback]
key_files:
  created: []
  modified:
    - src/lib/videoExport.ts
    - src/lib/overlayExport.ts
    - src/test/videoExport-loop.test.ts
decisions:
  - isRendering guard uses .finally() reset — not .catch() only — so successful frames also release the lock
  - captureStream(0) with videoTrack?.requestFrame() optional-chained — safe if captureStream returns no video tracks
  - fastSeek applied to both wrap-around branches (explicit wrap detection AND video.ended/paused); pre-flight rewind stays as currentTime=0 with seeked event
  - fontsAlreadyReady param added to drawOverlaysToCanvas to skip per-frame await; all 3 call sites inside exportVideoGrid pass true; external callers unchanged
metrics:
  duration: 3min
  completed: "2026-04-10T03:34:06Z"
  tasks: 2
  files: 3
---

# Quick Task 260410-7sa: Fix Video Export Stuttering and Freeze — Summary

**One-liner:** Four targeted render-loop fixes — isRendering mutex, captureStream(0)+requestFrame, fastSeek on loop wrap, and hoisted fonts.ready — eliminate frame corruption and reduce audio gaps during MediaRecorder video export.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Apply all four render-loop fixes to videoExport.ts and overlayExport.ts | ec5c52e | src/lib/videoExport.ts, src/lib/overlayExport.ts |
| 2 | Add unit tests for isRendering guard and captureStream(0) behavior | a5dcaf3 | src/test/videoExport-loop.test.ts |

## What Was Done

### Fix A — isRendering guard (videoExport.ts)

`let isRendering = false` declared before `setInterval`. The callback checks `if (isRendering) return` before calling `renderFrame()`, sets `isRendering = true` immediately after, and resets via `.finally(() => { isRendering = false; })`. The `.finally()` placement is critical — it resets the flag even when `renderFrame` resolves successfully, not just on error.

### Fix B — Hoisted document.fonts.ready (videoExport.ts + overlayExport.ts)

`await document.fonts.ready` moved from per-frame `drawOverlaysToCanvas` to once before the render loop in `exportVideoGrid`. `drawOverlaysToCanvas` now accepts `fontsAlreadyReady?: boolean` as a fifth parameter; when `true`, the fonts await is skipped. All three call sites inside `exportVideoGrid` (pre-flight, normal tick, final frame) pass `true`. External callers (e.g., export.ts) pass nothing — behavior unchanged.

### Fix C — fastSeek on loop wrap-around (videoExport.ts)

Both loop wrap branches (`prev - loopedTime > duration * 0.5` and `video.ended || video.paused`) now use `fastSeek` where available: `if ('fastSeek' in video) { (video as ...).fastSeek(loopedTime); } else { video.currentTime = loopedTime; }`. The pre-flight rewind (`video.currentTime = 0` with `seeked` event) is unchanged per plan spec.

### Fix D — captureStream(0) + requestFrame() (videoExport.ts)

`captureStream(FPS)` changed to `captureStream(0)`. The video track is extracted: `const videoTrack = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack`. `videoTrack?.requestFrame()` is called after BOTH `renderGridIntoContext` and `drawOverlaysToCanvas` complete in all three render locations: pre-flight frame, normal tick, and final frame. `FPS` constant (30) is retained — still used by `MediaRecorder` `videoBitsPerSecond` configuration comment and future use. `FRAME_DURATION_MS` is unchanged.

## Test Results

- Pre-existing tests: 20 passed (computeLoopedTime × 6, buildAudioGraph × 7, buildExportVideoElements × 7)
- New tests added: 4 (isRendering guard × 3, fontsAlreadyReady × 1)
- Total: 24 passed, 0 failed
- `npx tsc --noEmit`: clean

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check

- [x] src/lib/videoExport.ts contains `isRendering`, `captureStream(0)`, `videoTrack.requestFrame()`, `document.fonts.ready` hoist, and `fastSeek` pattern
- [x] src/lib/overlayExport.ts `drawOverlaysToCanvas` has `fontsAlreadyReady?: boolean` param and conditional fonts await
- [x] src/test/videoExport-loop.test.ts has new describes for isRendering guard and fontsAlreadyReady
- [x] Commits ec5c52e and a5dcaf3 verified in git log
- [x] `npx tsc --noEmit` exits 0
- [x] All 24 tests pass
