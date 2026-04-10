---
phase: 15-replace-htmlvideoelement-seeking-with-webcodecs-videodecoder
plan: "02"
subsystem: export
tags: [webcodecs, mediabunny, videosamplesink, decode-pipeline, toast, tests]
dependency_graph:
  requires:
    - 15-01 (DrawableSource + CanvasImageSource foundation in export.ts)
  provides:
    - decode-then-encode pipeline in videoExport.ts (no seeking)
    - decodeVideoToSamples exported function
    - findSampleForTime exported function
    - 'decoding' progress stage in Toast + ExportSplitButton
    - 6 passing unit tests for findSampleForTime
  affects:
    - src/lib/videoExport.ts
    - src/Editor/Toast.tsx
    - src/Editor/ExportSplitButton.tsx
    - src/test/videoExport-mediabunny.test.ts
tech_stack:
  added: []
  patterns:
    - Decode-then-encode: all frames decoded upfront via Mediabunny VideoSampleSink, then encode loop does zero seeking
    - Sequential decode (one video at a time) to limit peak GPU memory
    - toCanvasImageSource() called inline within buildFrameMapForTime — never stored across microtask boundaries
    - VideoSample.timestamp in seconds throughout (no microsecond conversion)
    - disposeAllSamples in finally block ensures GPU memory freed on success and error paths
key_files:
  created: []
  modified:
    - src/lib/videoExport.ts
    - src/Editor/Toast.tsx
    - src/Editor/ExportSplitButton.tsx
    - src/test/videoExport-mediabunny.test.ts
decisions:
  - VideoSample.timestamp treated as seconds throughout (verified mediabunny.d.ts line 3023) — no microsecond conversion
  - Sequential decode (D-04) chosen over parallel to bound peak GPU memory to one video at a time
  - toCanvasImageSource() called inline in buildFrameMapForTime — consumed synchronously by renderGridIntoContext with no await between map build and drawImage
  - decodeVideoToSamples stubs remain as .todo — BlobSource/Input/VideoSampleSink mocking is complex, manual integration testing is the right gate
  - decodedVideos declared with let before try block so finally can call disposeAllSamples even if decodeAllVideoSamples throws
metrics:
  duration: "~3 min"
  completed: "2026-04-11"
  tasks: 2
  files: 4
---

# Phase 15 Plan 02: VideoSampleSink Decode Pipeline Summary

Replaced HTMLVideoElement seeking pipeline with Mediabunny VideoSampleSink decode-then-encode architecture: all video frames decoded upfront into sorted in-memory arrays, then drawn directly during the encode loop with zero seeking. Added 'decoding' progress stage to Toast and ExportSplitButton, and implemented 6 unit tests for findSampleForTime.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace seeking pipeline with VideoSampleSink decode pipeline in videoExport.ts | 76c80fa | src/lib/videoExport.ts |
| 2 | Add 'decoding' stage to Toast and ExportSplitButton, fill in test stubs | 4647091 | src/Editor/Toast.tsx, src/Editor/ExportSplitButton.tsx, src/test/videoExport-mediabunny.test.ts |

## What Was Built

### Task 1 — videoExport.ts decode-then-encode rewrite

**Deleted functions:**
- `buildExportVideoElements` — created dedicated HTMLVideoElement instances per video
- `destroyExportVideoElements` — cleaned up those elements post-export
- `seekAllVideosTo` — sought all videos frame-by-frame via 'seeked' events (was 99.4% of export time)

**New functions added:**
- `collectUniqueVideoMediaIds` — collects Set of video mediaIds with valid blob URLs
- `decodeVideoToSamples(blobUrl)` — exported: fetch blob → BlobSource → Input → VideoSampleSink → sorted VideoSample[]
- `decodeAllVideoSamples(root, mediaRegistry, mediaTypeMap, onProgress)` — sequential decode of all videos, reports onProgress('decoding', %)
- `findSampleForTime(samples, exportTimeSec, videoDurationSec)` — exported: floor-lookup using computeLoopedTime, returns closest VideoSample
- `buildFrameMapForTime(decodedVideos, timeSeconds)` — builds Map<mediaId, CanvasImageSource> per frame; toCanvasImageSource() called inline
- `disposeAllSamples(decodedVideos)` — closes all VideoSample frames and clears map

**exportVideoGrid changes:**
- onProgress parameter type widened to include `'decoding'` stage
- buildExportVideoElements replaced by decodeAllVideoSamples (called after output.start())
- Encode loop body: seekAllVideosTo removed, replaced by buildFrameMapForTime lookup
- finally block: destroyExportVideoElements replaced by disposeAllSamples
- All other structures unchanged: stable canvas, codec selection, CanvasSource, AudioBufferSource, audio mixing, output.finalize()

### Task 2 — UI + test updates

**Toast.tsx:**
- Added `'decoding'` to ToastState union type
- Added rendering branch: `<span>Decoding {encodingPercent ?? 0}%...</span>` with Loader2 spinner

**ExportSplitButton.tsx:**
- Added `else if (stage === 'decoding')` branch in onProgress handler
- Sets `setToastState('decoding')` and updates encodingPercent (reusing existing state variable)

**videoExport-mediabunny.test.ts:**
- Added import of `findSampleForTime` from `@/lib/videoExport`
- Replaced 6 `it.todo` stubs with real tests covering: null for empty, single sample, floor lookup at 0.7s, looped time at 5.5s/3s video, exact duration modulo, time=0
- decodeVideoToSamples stubs remain as `.todo` — require Mediabunny mock infrastructure

## Verification

- `npx tsc --noEmit` exits 0 — no type errors
- `npx vitest run src/test/videoExport-mediabunny.test.ts` — 11 passed, 4 todo
- `npx vitest run src/test/videoExport-loop.test.ts src/test/videoExport-audio.test.ts` — 21 passed
- `npx vitest run` full suite — 632 passed / 2 skipped / 4 todo

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

The `decodeVideoToSamples` describe block retains 4 `.todo` stubs. These require mocking BlobSource, Input, and VideoSampleSink internals which is complex and better verified via manual integration testing (run the app, export a video, observe Decoding N%... in Toast). This is intentional and documented in the plan.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. The blob URL fetch in decodeVideoToSamples is same-origin user-uploaded data (same as existing audio fetch in mixAudioForExport).

## Self-Check: PASSED

- `src/lib/videoExport.ts` — FOUND (rewritten, no buildExportVideoElements/seekAllVideosTo)
- `src/Editor/Toast.tsx` — FOUND (contains 'decoding' in ToastState, Decoding N%... render)
- `src/Editor/ExportSplitButton.tsx` — FOUND (contains stage === 'decoding' branch)
- `src/test/videoExport-mediabunny.test.ts` — FOUND (imports findSampleForTime, 6 real tests)
- Commit `76c80fa` — FOUND (Task 1)
- Commit `4647091` — FOUND (Task 2)
