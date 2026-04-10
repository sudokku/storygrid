---
phase: 14-migrate-video-export-from-mediarecorder-ffmpeg-wasm-to-media
plan: 02
subsystem: video-export
tags: [mediabunny, webcodecs, audio, offlineaudiocontext, mp4, video-export]

# Dependency graph
requires:
  - "14-01 — mediabunny + @mediabunny/aac-encoder installed, ffmpeg removed"
provides:
  - "Complete Mediabunny CanvasSource + AudioBufferSource video export pipeline"
  - "OfflineAudioContext-based audio mixing for audio-enabled video cells"
  - "Toast 'audio-warning' state for D-03 AAC fallback"
  - "ExportSplitButton wired to onWarning callback"
  - "VideoEncoder (WebCodecs) guard replacing MediaRecorder guard"
affects:
  - "All MP4 video exports — now produced by Mediabunny, not MediaRecorder+ffmpeg.wasm"

# Tech tracking
tech-stack:
  added:
    - "OfflineAudioContext mixing pipeline — fetch+decodeAudioData per cell, mix via AudioBufferSourceNode"
    - "seekAllVideosTo() — seeked-event seeking with 500ms timeout fallback (D-13)"
    - "collectAudioEnabledMediaIds() — Set of mediaIds where audioEnabled=true AND video type"
    - "mixAudioForExport() — OfflineAudioContext mixer clipped to totalDuration (AUD-07)"
  patterns:
    - "VideoEncoder guard (typeof VideoEncoder === 'undefined') — D-06 hard block"
    - "Codec selection: VP9 on Firefox, AVC on others — D-12"
    - "D-03 non-fatal audio fallback: onWarning callback, video-only export on AAC unavailability"
    - "output.start() always after addVideoTrack + addAudioTrack — Pitfall 5"
    - "Audio mixed AFTER video loop — OfflineAudioContext is fast (offline, not real-time)"

key-files:
  created: []
  modified:
    - "src/lib/videoExport.ts — complete rewrite: Mediabunny CanvasSource+AudioBufferSource, remove MediaRecorder+ffmpeg"
    - "src/Editor/Toast.tsx — 'transcoding' removed, 'audio-warning' added (D-03, D-14)"
    - "src/Editor/ExportSplitButton.tsx — remove transcoding branch, wire onWarning (D-15, D-03)"
    - "src/test/phase04-02-task1.test.tsx — VideoEncoder guard test replaces MediaRecorder guard test"
    - "src/test/videoExport-audio.test.ts — buildAudioGraph tests replaced with hasAudioEnabledVideoLeaf + buildExportVideoElements tests"

key-decisions:
  - "buildAudioGraph deleted — was MediaRecorder+MediaElementAudioSourceNode pattern; incompatible with OfflineAudioContext (Pitfall 1); replaced by mixAudioForExport"
  - "Audio mixed after video loop — OfflineAudioContext renders offline (fast); video loop must complete before finalize() is called"
  - "onWarning added as optional 7th parameter to exportVideoGrid — D-03 non-fatal audio fallback; backward compatible"
  - "videoExport-audio.test.ts updated to remove buildAudioGraph tests — function deleted; coverage preserved via hasAudioEnabledVideoLeaf + buildExportVideoElements tests"

patterns-established:
  - "OfflineAudioContext looped scheduling: while(offset < totalDuration) { create node, start(offset), stop(min(offset+duration, total)), offset += duration }"
  - "Audio decode: fetch(blobUrl) → arrayBuffer → decodeAudioData — blob URLs are valid for fetch (same-origin in-memory)"

requirements-completed:
  - "AUD-05 — MP4 video export mixes audio from all cells where audio is enabled (AudioBufferSource + OfflineAudioContext)"
  - "AUD-06 — Zero audio-enabled cells → exported MP4 has no audio track (hasAudioEnabledVideoLeaf skip path)"
  - "AUD-07 — Audio clipped to totalDuration (OfflineAudioContext length = totalDuration × sampleRate)"

# Metrics
duration: 18min
completed: 2026-04-10
---

# Phase 14 Plan 02: Mediabunny Pipeline Implementation Summary

**Rewrote videoExport.ts replacing MediaRecorder+ffmpeg.wasm with Mediabunny CanvasSource+AudioBufferSource — frame-accurate MP4 with OfflineAudioContext audio mixing, VideoEncoder guard, VP9/AVC codec selection, and D-03 non-fatal audio fallback**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-10T21:30:00Z
- **Completed:** 2026-04-10T21:48:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

### Task 1: Rewrite videoExport.ts with Mediabunny CanvasSource + AudioBufferSource pipeline

- Completely replaced MediaRecorder+ffmpeg.wasm pipeline with Mediabunny direct MP4 encoding
- Added `seekAllVideosTo()` — seeks all export video elements to exact timestamp using `seeked` event with 500ms timeout fallback (D-13)
- Added `collectAudioEnabledMediaIds()` — collects unique mediaIds where `audioEnabled=true` AND type is `'video'`
- Added `mixAudioForExport()` — decodes each cell's audio via `fetch+decodeAudioData`, mixes via `OfflineAudioContext` with looped `AudioBufferSourceNode` scheduling; audio clipped to `totalDuration` (AUD-07)
- Rewrote `exportVideoGrid()`:
  - VideoEncoder guard: hard block with "WebCodecs" message (D-06)
  - VP9 on Firefox, AVC on all others (D-12)
  - Mediabunny Output: `CanvasSource` + optional `AudioBufferSource` (D-01)
  - `registerAacEncoder()` polyfill for Firefox AAC (Pitfall 2)
  - D-03: AAC unavailability is non-fatal — `onWarning` callback, video-only export
  - Frame loop: `seekAllVideosTo` → `renderGridIntoContext` → `drawOverlaysToCanvas` → `videoSource.add()`
  - Audio after video loop: `mixAudioForExport` → `audioSource.add(mixedBuffer)`
  - `try/finally` ensures `destroyExportVideoElements` always runs
- Preserved unchanged: `computeLoopedTime`, `buildExportVideoElements`, `hasAudioEnabledVideoLeaf`, `destroyExportVideoElements`
- Deleted: `buildAudioGraph` (MediaRecorder-specific; incompatible with OfflineAudioContext)

### Task 2: Update Toast, ExportSplitButton, and tests for new pipeline

- **Toast.tsx**: Removed `'transcoding'` state; added `'audio-warning'` state with amber styling, warning message "Audio not supported in this browser — exported video only", and dismiss button
- **ExportSplitButton.tsx**: Removed `transcoding` branch from `onProgress` handler; added `audioWarningRef` to capture warning; shows `'audio-warning'` toast after successful download if audio fell back
- **phase04-02-task1.test.tsx**: Replaced MediaRecorder `isTypeSupported` guard test with `VideoEncoder` deletion guard test; added 2 new Toast `audio-warning` tests
- **videoExport-audio.test.ts**: Replaced `buildAudioGraph` tests (deleted function) with comprehensive `hasAudioEnabledVideoLeaf` and `buildExportVideoElements` tests covering AUD-06 skip path and de-duplication

## Task Commits

1. **Task 1: Rewrite videoExport.ts** — `9bffcc3` (feat)
2. **Task 2: Update Toast, ExportSplitButton, tests** — `59764d5` (feat)

## Files Created/Modified

- `src/lib/videoExport.ts` — complete rewrite: Mediabunny pipeline, OfflineAudioContext audio, remove MediaRecorder+ffmpeg
- `src/Editor/Toast.tsx` — 'audio-warning' state replaces 'transcoding'
- `src/Editor/ExportSplitButton.tsx` — onWarning wired, transcoding branch removed
- `src/test/phase04-02-task1.test.tsx` — VideoEncoder guard test, audio-warning Toast tests
- `src/test/videoExport-audio.test.ts` — updated to cover new pipeline helpers

## Decisions Made

- Deleted `buildAudioGraph` entirely — it was a `MediaElementAudioSourceNode` + `MediaStreamAudioDestinationNode` pattern that only works with real-time `AudioContext` and MediaRecorder's stream; incompatible with the new OfflineAudioContext mixing approach (Pitfall 1 in RESEARCH.md)
- Audio mixed AFTER video loop — `OfflineAudioContext` renders offline (not real-time), so it's fast regardless of video duration. Keeping it after the loop allows `output.finalize()` to be called once for both tracks.
- Added `onWarning` as optional 7th parameter to `exportVideoGrid` — fully backward-compatible; existing callers without the parameter still work
- Updated `videoExport-audio.test.ts` rather than deleting it — the `buildExportVideoElements` and `hasAudioEnabledVideoLeaf` tests remained fully valid and valuable for the new pipeline

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing node_modules in worktree**
- **Found during:** Task 1 build verification
- **Issue:** `mediabunny` and `@mediabunny/aac-encoder` were in `package.json` but not installed in the worktree's `node_modules`
- **Fix:** Ran `npm install` in the worktree directory
- **Files modified:** none (runtime environment fix)
- **Commit:** n/a

**2. [Rule 1 - Bug] `videoExport-audio.test.ts` imported deleted `buildAudioGraph`**
- **Found during:** Task 2 test run (6 tests failed with `TypeError: buildAudioGraph is not a function`)
- **Issue:** The plan correctly deleted `buildAudioGraph` from `videoExport.ts`, but the existing test file still imported and tested it
- **Fix:** Rewrote `videoExport-audio.test.ts` — replaced `buildAudioGraph` tests with equivalent coverage via `hasAudioEnabledVideoLeaf` (AUD-06 skip path logic) and `buildExportVideoElements` (muted/unmuted per audioEnabled) tests. Same behavioral guarantees, correct for the new pipeline.
- **Files modified:** `src/test/videoExport-audio.test.ts`
- **Commit:** `59764d5`

## Issues Encountered

None beyond the two auto-fixed deviations above.

## Known Stubs

None — no placeholder data, hardcoded empty values, or TODO comments introduced.

## Threat Flags

No new trust boundaries introduced. All processing remains client-side. Audio is decoded from in-memory blob URLs (same-origin fetch, no network). `console.warn` on audio failure logs only error messages and mediaId strings — no sensitive data.

## Self-Check

- FOUND: src/lib/videoExport.ts
- FOUND: src/Editor/Toast.tsx
- FOUND: src/Editor/ExportSplitButton.tsx
- FOUND: src/test/phase04-02-task1.test.tsx
- FOUND: src/test/videoExport-audio.test.ts
- FOUND: commit 9bffcc3 (Task 1)
- FOUND: commit 59764d5 (Task 2)

## Self-Check: PASSED
