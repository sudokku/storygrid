---
phase: 06-video-support-v2
plan: "04"
subsystem: video-export
tags: [video, ffmpeg, export, mp4, toast]
dependency_graph:
  requires: ["06-03"]
  provides: ["exportVideoGrid function", "video export pipeline", "auto-detect export path"]
  affects:
    - src/lib/videoExport.ts
    - src/lib/export.ts
    - src/Editor/Toast.tsx
    - src/Editor/ExportSplitButton.tsx
tech_stack:
  added:
    - "@ffmpeg/ffmpeg@^0.12.15"
    - "@ffmpeg/util@^0.12.2"
  patterns:
    - "Dynamic import for ffmpeg lazy loading (out of initial bundle)"
    - "Log-based ffmpeg progress parsing (progress event unreliable)"
    - "seekAllVideosTo with 500ms timeout fallback for seeked event"
    - "buildVideoElementsByMediaId maps nodeId -> mediaId for renderGridToCanvas"
key_files:
  created:
    - src/lib/videoExport.ts
  modified:
    - src/lib/export.ts
    - src/Editor/Toast.tsx
    - src/Editor/ExportSplitButton.tsx
    - src/test/phase04-02-task1.test.tsx
    - package.json
decisions:
  - "ffmpeg loaded via dynamic import to keep it out of initial bundle"
  - "Log-based progress parsing used instead of ffmpeg progress event (unreliable)"
  - "seekAllVideosTo uses 500ms timeout fallback — some video formats don't fire seeked"
  - "buildVideoElementsByMediaId maps nodeId->mediaId since renderNode only has leaf.mediaId"
  - "video-blocked toast state removed; auto-detect replaces guard pattern"
metrics:
  duration: "247s"
  completed_date: "2026-04-05"
  tasks_completed: 2
  files_modified: 6
---

# Phase 06 Plan 04: Video Export Pipeline Summary

## One-liner

ffmpeg.wasm lazy-load video export pipeline with frame-accurate canvas rendering, H.264 MP4 output, log-based progress tracking, and auto-detect export mode in ExportSplitButton.

## What Was Built

**src/lib/videoExport.ts (new file):**
- `exportVideoGrid()` — main export function with Safari guard, ffmpeg lazy load, frame rendering loop, MP4 encoding, and virtual FS cleanup
- `loadFFmpeg()` — dynamic import of @ffmpeg/ffmpeg + @ffmpeg/util with CDN-hosted core (sidesteps CORP issues under COEP via toBlobURL)
- `seekAllVideosTo()` — seeks all registered video elements with 500ms timeout fallback for formats that don't fire `seeked`
- `buildVideoElementsByMediaId()` — bridges nodeId-keyed videoElementRegistry to mediaId-keyed map for renderGridToCanvas
- Log-based progress parsing: matches `time=HH:MM:SS.CS` in ffmpeg log output; 0-80% for frame writing, 80-95% for encoding, 95-100% for finalization
- Virtual FS cleanup: deletes all frame PNGs and output.mp4 after reading; calls `ffmpeg.terminate()`

**src/lib/export.ts (updated):**
- `renderGridToCanvas` signature extended with optional `videoElements?: Map<string, HTMLVideoElement>`
- `renderNode` uses video element directly for video cells (via `videoElements?.has(leaf.mediaId)`) before falling back to image path
- Backward compatible — all existing image export calls unchanged

**src/Editor/Toast.tsx (updated):**
- `ToastState` type updated: adds `'loading-ffmpeg'` and `'encoding'`; removes `'video-blocked'`
- `ToastProps` extended with `encodingPercent?: number`
- `'loading-ffmpeg'` state: Loader2 spinner + "Loading ffmpeg..." text
- `'encoding'` state: Loader2 spinner + `Encoding {encodingPercent}%...` text
- Auto-dismiss `useEffect` for `video-blocked` removed

**src/Editor/ExportSplitButton.tsx (updated):**
- `hasVideos` computed from `hasVideoCell(root, mediaTypeMap)` — auto-detect
- `exportVideoGrid` imported and wired with progress callback
- `handleExport` branches on `hasVideos`: video path calls `exportVideoGrid`, downloads as `.mp4`; image path unchanged
- Button label: "Export MP4" when video cells present, "Export PNG/JPEG" otherwise
- Popover: video mode shows "Exports as MP4 (H.264)" label, hides format/quality controls
- `encodingPercent` state passed through to Toast

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Video export pipeline and Toast extension | 8c7d2b3 | src/lib/videoExport.ts, src/Editor/Toast.tsx, src/lib/export.ts, src/test/phase04-02-task1.test.tsx, package.json |
| 2 | ExportSplitButton auto-detect and video export wiring | 75b07c3 | src/Editor/ExportSplitButton.tsx |
| 3 | End-to-end verification | checkpoint | (awaiting human verify) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @ffmpeg/ffmpeg and @ffmpeg/util not installed**
- **Found during:** Task 1 verification
- **Issue:** Vitest failed with "Failed to resolve import '@ffmpeg/ffmpeg'" — packages missing from package.json
- **Fix:** `npm install @ffmpeg/ffmpeg@^0.12.15 @ffmpeg/util@^0.12.2`
- **Files modified:** package.json, package-lock.json
- **Commit:** 8c7d2b3

**2. [Rule 1 - Bug] Test file used removed video-blocked toast state**
- **Found during:** Task 1 verification
- **Issue:** 4 tests in phase04-02-task1.test.tsx checked for `video-blocked` toast behavior that was intentionally replaced
- **Fix:** Updated tests to check for new `loading-ffmpeg` and `encoding` states; replaced video-blocked ExportSplitButton test with `Export MP4` button detection
- **Files modified:** src/test/phase04-02-task1.test.tsx
- **Commit:** 8c7d2b3

## Known Stubs

None — the pipeline is fully implemented. Task 3 (human verify) is a blocking checkpoint for end-to-end validation in a real browser with COOP/COEP headers active.

## Self-Check: PASSED

- `src/lib/videoExport.ts` — FOUND
- `src/Editor/Toast.tsx` — FOUND (modified)
- `src/lib/export.ts` — FOUND (modified)
- `src/Editor/ExportSplitButton.tsx` — FOUND (modified)
- Commit 8c7d2b3 — FOUND
- Commit 75b07c3 — FOUND
- 32 test files pass, 392 tests pass
