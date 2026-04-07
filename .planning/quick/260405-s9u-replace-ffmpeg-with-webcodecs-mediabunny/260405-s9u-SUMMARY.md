---
phase: quick-260405-s9u
plan: 01
subsystem: video-export
tags: [webcodecs, mediabunny, video, mp4, canvas]
dependency_graph:
  requires:
    - src/lib/export.ts (renderGridToCanvas)
    - src/lib/videoRegistry.ts (videoElementRegistry)
    - src/lib/tree.ts (getAllLeaves)
  provides:
    - exportVideoGrid (WebCodecs + Mediabunny MP4 encoder)
  affects:
    - src/Editor/ExportSplitButton.tsx (caller — signature unchanged)
tech_stack:
  added:
    - mediabunny@^1.40.1 — WebCodecs-based MP4 muxer (CanvasSource, Output, BufferTarget)
  patterns:
    - Stable canvas pattern: persistent canvas for CanvasSource, temp canvas from renderGridToCanvas copied via drawImage
    - Codec selection: VP9 on Firefox (H.264 DOMException bug), AVC on all other browsers
    - seeked-event seek: frame-accurate video seeking via HTMLVideoElement seeked event with 500ms safety timeout
key_files:
  created: []
  modified:
    - src/lib/videoExport.ts
    - src/test/phase04-02-task1.test.tsx
    - package.json
decisions:
  - VP9 forced on Firefox due to Bugzilla #1918769 — H.264 VideoEncoder throws DOMException at encode() even when isConfigSupported() returns true
  - Stable canvas pattern required: CanvasSource holds a reference to a single canvas element; renderGridToCanvas returns a new canvas each call so drawImage bridges the two
  - seeked event used (not timeout) for frame accuracy; 500ms safety timeout guards against browsers that may not fire seeked
  - QUALITY_HIGH bitrate constant from mediabunny used directly (no custom bitrate)
metrics:
  duration: "~5 minutes"
  completed: "2026-04-05T18:21:51Z"
  tasks: 3
  files_changed: 3
---

# Quick Task 260405-s9u: Replace ffmpeg.wasm with WebCodecs + Mediabunny

**One-liner:** WebCodecs + Mediabunny MP4 encoder using CanvasSource + BufferTarget pipeline with VP9/H.264 codec selection and seeked-event frame sync.

## Objective

Replace the `src/lib/videoExport.ts` stub ("not yet implemented") with a working MP4 encoder using the native WebCodecs API via the mediabunny library. Eliminates the 25MB ffmpeg.wasm download and COOP/COEP SharedArrayBuffer dependency.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Install mediabunny | 7febbc7 | package.json, package-lock.json |
| 2 | Implement videoExport.ts with WebCodecs + Mediabunny | bd6fdf0 | src/lib/videoExport.ts |
| 3 | Add VideoEncoder availability guard test | bbc4155 | src/test/phase04-02-task1.test.tsx |

## Implementation Notes

### Stable Canvas Pattern

`renderGridToCanvas()` returns a new `HTMLCanvasElement` on every call. `CanvasSource` from mediabunny must hold a reference to a single stable canvas element throughout encoding. Solution: create one persistent 1080×1920 canvas before `output.start()`, pass it to `CanvasSource`, then for each frame: render via `renderGridToCanvas()` into a temp canvas, copy via `ctx.drawImage(frameCanvas, 0, 0)` onto the persistent canvas, then call `videoSource.add(timestamp, duration)`.

### Codec Selection

Firefox has a known bug (Bugzilla #1918769) where H.264 `VideoEncoder` throws `DOMException` at `encode()` time despite `isConfigSupported()` returning true. The implementation detects Firefox via `navigator.userAgent.includes('Firefox')` and forces VP9. All other browsers receive AVC (H.264).

### Video Seeking

For each frame, `seekAllVideosTo(timeSeconds)` seeks all registered `HTMLVideoElement`s in `videoElementRegistry` using the `seeked` event for frame accuracy. A 500ms `setTimeout` safety fallback handles browsers that may not fire `seeked` in certain states.

### Guard Test

The test temporarily deletes `globalThis.VideoEncoder`, calls `exportVideoGrid`, asserts the rejection message, then restores the original value. Uses the existing `LeafNode` type and `vi` imports from the test file — no new imports required.

## Verification

- `npx tsc --noEmit`: 0 errors
- `npx vitest run src/test/phase04-02-task1.test.tsx`: 23/23 tests pass
- `mediabunny` in `package.json` dependencies: `^1.40.1`
- No ffmpeg imports in `videoExport.ts`
- Function signature unchanged: `exportVideoGrid(root, mediaRegistry, settings, totalDuration, onProgress): Promise<Blob>`

## Deviations from Plan

**Minor: seekAllVideosTo adds early-exit for already-at-timestamp**

The plan's seekAllVideosTo unconditionally attaches a seeked listener and sets `currentTime`. The implementation adds an early-resolve check (`Math.abs(video.currentTime - time) < 0.01`) when the video is already at the target time. This avoids unnecessary seeks during frame 0 and prevents a theoretical race where setting `currentTime` to its current value may not fire `seeked` on all browsers.

This is a Rule 1 (auto-fix) enhancement — no behavioral change for the normal case, prevents a potential hang for frame 0 at time 0.

## Known Stubs

None — the implementation is complete and wired. The `exportVideoGrid` function no longer throws "not yet implemented".

## Self-Check

- [x] src/lib/videoExport.ts exists and contains `exportVideoGrid`
- [x] src/test/phase04-02-task1.test.tsx contains `describe('exportVideoGrid'`
- [x] Commits 7febbc7, bd6fdf0, bbc4155 exist
- [x] mediabunny@^1.40.1 in package.json dependencies
- [x] TypeScript clean
- [x] 23/23 tests pass
