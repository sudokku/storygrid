---
phase: 06-video-support-v2
plan: "02"
subsystem: Grid,media,video
tags: [video, leafnode, raf-loop, video-registry, canvas-rendering]
dependency_graph:
  requires: [06-01]
  provides: [video-preview-in-cells, raf-playback-loop, video-registry-lifecycle]
  affects: [LeafNode.tsx]
tech_stack:
  added: []
  patterns: [hidden-video-element, raf-loop-playback, video-registry-register-unregister, recomputeTotalDuration]
key_files:
  created: []
  modified:
    - src/Grid/LeafNode.tsx
decisions:
  - drawRef updated to use videoElRef over imgElRef when isVideo — single draw path handles both media types
  - recomputeTotalDuration is a module-level function (not a hook) reading from videoElementRegistry directly
  - rAF loop keyed on [isPlaying, isVideo] — clean start/stop semantics via effect return
  - Video element creation keyed on [mediaUrl, isVideo, id] — cleanup revokes and unregisters on each change
  - Still frame drawn on isPlaying going false — final drawRef.current() call in rAF effect cleanup guard
metrics:
  duration: 12s
  completed: "2026-04-05"
  tasks: 1
  files: 1
---

# Phase 06 Plan 02: LeafNode Video Rendering Summary

Hidden video element + canvas rAF loop for video cells: drops a .mp4 onto a cell, draws the first frame immediately, loops while isPlaying=true, freezes to still frame on pause, registers/unregisters in global videoElementRegistry, and recomputes totalDuration on each video lifecycle change.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | LeafNode video element, rAF loop, and registry integration | b29e015 | src/Grid/LeafNode.tsx |

## What Was Built

### src/Grid/LeafNode.tsx

**New state and refs:**
- `videoElRef: useRef<HTMLVideoElement | null>(null)` — holds the programmatic video element
- `rafIdRef: useRef<number>(0)` — tracks the active requestAnimationFrame ID
- `isPlaying` subscribed from `useEditorStore`
- `mediaType` subscribed from `useGridStore.mediaTypeMap` for the current cell's mediaId
- `isVideo` derived as `mediaType === 'video'`

**Updated drawRef:**
- Prefers `videoElRef.current` over `imgElRef.current` as the canvas source
- `drawLeafToCanvas` already accepts `HTMLImageElement | HTMLVideoElement` (from Plan 01)

**Image load effect:**
- Gated on `!isVideo` — skips `loadImage` for video cells

**Video creation effect (keyed on `[mediaUrl, isVideo, id]`):**
- Creates `document.createElement('video')` with `muted=true`, `playsInline=true`, `loop=true`
- On `loadedmetadata`: calls `recomputeTotalDuration()` then seeks to `currentTime=0`
- On `seeked` (first time only): calls `drawRef.current()` to render first frame
- Calls `registerVideo(id, video, () => drawRef.current())` to hook into global registry
- Cleanup: clears `video.src`, sets `videoElRef.current = null`, calls `unregisterVideo(id)`, `recomputeTotalDuration()`

**rAF loop effect (keyed on `[isPlaying, isVideo]`):**
- Starts `requestAnimationFrame(tick)` only when `isPlaying && isVideo`
- On cleanup (isPlaying=false or not video): draws one final still frame

**recomputeTotalDuration helper:**
- Module-level function iterating `videoElementRegistry.values()`
- Calls `useEditorStore.getState().setTotalDuration(maxDur)` directly

**File input:**
- `accept` changed from `"image/*"` to `"image/*,video/*"`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. Video preview wiring is complete. The playback controls (play/pause button, timeline scrubber) are Plan 03. The video export pipeline is Plan 04.

## Verification Results

- `npx vitest run`: 32 test files, 392 passed, 2 skipped — no regressions
- All existing image rendering paths unchanged (imgElRef still used when `!isVideo`)

## Self-Check: PASSED
