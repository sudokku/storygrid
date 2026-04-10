---
phase: quick-260410-obm
plan: 01
subsystem: video-export
tags: [ffmpeg, webm, mediarecorder, transcode, mp4, quicktime]
dependency_graph:
  requires: []
  provides: [webm-to-mp4-transcode-pipeline]
  affects: [src/lib/videoExport.ts, src/Editor/ExportSplitButton.tsx, src/Editor/Toast.tsx]
tech_stack:
  added: [transcodeToMp4.ts module, @ffmpeg/core CDN lazy-load]
  patterns: [singleton-ffmpeg-instance, webm-record-then-transcode]
key_files:
  created:
    - src/lib/transcodeToMp4.ts
  modified:
    - package.json
    - package-lock.json
    - src/lib/videoExport.ts
    - src/Editor/Toast.tsx
    - src/Editor/ExportSplitButton.tsx
decisions:
  - "WebM-only MediaRecorder + ffmpeg.wasm post-transcode chosen over direct MP4 recording; fragmented MP4 from MediaRecorder lacks moov atom and cannot open in QuickTime"
  - "Singleton FFmpeg instance cached after first load to avoid 25MB CDN re-download on repeated exports"
  - "-c:a aac flag included unconditionally; ffmpeg silently ignores audio codec flags when no audio stream exists in the WebM input"
  - "Progress handler cleaned up via ffmpeg.off() after each transcode call to prevent stacking on singleton reuse"
  - "outputData cast via unknown to ArrayBuffer to satisfy strict Uint8Array<ArrayBufferLike> typing in Blob constructor"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-10T14:37:09Z"
  tasks_completed: 2
  files_changed: 5
---

# Quick Task 260410-obm: WebM MediaRecorder + ffmpeg.wasm Transcode to MP4

**One-liner:** WebM-only MediaRecorder recording with ffmpeg.wasm post-transcode to H.264 MP4 with -movflags +faststart, producing a QuickTime-compatible file with moov atom at front.

## What Was Built

Replaced the MediaRecorder MP4 codec variants (which produced fragmented MP4 without a moov atom) with a two-stage pipeline:

1. **Stage 1 — Record:** MediaRecorder uses WebM only (vp9 > vp8 > generic webm)
2. **Stage 2 — Transcode:** ffmpeg.wasm converts the WebM blob to H.264 MP4 with `-movflags +faststart`

The exported file is always `.mp4` and opens in macOS QuickTime Player.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Remove mediabunny, create transcodeToMp4.ts | 14c92c4 |
| 2 | Wire WebM-only MediaRecorder + transcoding, update Toast + ExportSplitButton | 04411e0 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Uint8Array TypeScript cast in transcodeToMp4.ts**
- **Found during:** Build verification after Task 1 commit
- **Issue:** `ffmpeg.readFile()` returns `Uint8Array<ArrayBufferLike>` which is not directly assignable to `BlobPart` due to `SharedArrayBuffer` incompatibility in strict TypeScript
- **Fix:** Cast via `outputData as unknown as ArrayBuffer` in the Blob constructor
- **Files modified:** src/lib/transcodeToMp4.ts
- **Commit:** 04411e0 (included in Task 2 commit)

### Pre-existing Errors (Out of Scope)

The following TypeScript errors existed before this task and were not introduced by these changes:
- `src/Grid/OverlayLayer.tsx(1,8)`: unused `React` import
- `src/lib/overlayExport.ts(22,10)`: unused `estimateHeight` variable
- `src/lib/videoExport.ts(535/545)`: `currentTime` on type `never` in fastSeek else-branch
- `src/store/overlayStore.ts(37,15)`: unused `get` parameter

## Key Implementation Details

### transcodeToMp4.ts
- Lazy-loads `@ffmpeg/core@0.12.6` from `https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/` at first call
- Singleton `FFmpeg` instance cached in module scope; re-used across exports
- Progress handler registered per-call and cleaned up via `ffmpeg.off()` in `finally` block
- `-c:a aac -b:a 192k` flags safe for video-only WebM input (ffmpeg no-ops them when no audio stream present)
- Virtual FS files (`input.webm`, `output.mp4`) deleted in `finally` to avoid stale state on error

### videoExport.ts changes
- `mimeTypes` array: removed `video/mp4;codecs=avc3.42E01E` and `video/mp4` entries
- `onProgress` type extended with `'transcoding'` stage
- `recorder.onstop`: builds `webmBlob`, calls `transcodeWebmToMp4` with progress callback, resolves with resulting `mp4Blob`

### UI changes
- Toast: added `'transcoding'` to `ToastState` union; renders "Transcoding N%..." with spinner
- ExportSplitButton: handles `'transcoding'` stage in progress callback; `ext` hardcoded to `'mp4'`; popover text updated to "Exports as MP4 (H.264)"

## Known Stubs

None.

## Threat Flags

None beyond what is documented in the plan's threat model (T-obm-01 CDN supply-chain, T-obm-02 OOM — both accepted).

## Self-Check: PASSED

- `src/lib/transcodeToMp4.ts` exists: FOUND
- Task 1 commit `14c92c4`: FOUND
- Task 2 commit `04411e0`: FOUND
- `mediabunny` not in `package.json`: CONFIRMED
- `video/mp4` count in `videoExport.ts`: 0
- `transcoding` in `Toast.tsx`: CONFIRMED
