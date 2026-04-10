---
name: 260410-7sa Context
description: User decisions for fixing video export stuttering/freeze when clips have audio enabled
type: project
---

# Quick Task 260410-7sa: Fix video export stuttering/freeze when clips have audio enabled — prefer quality over speed - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Task Boundary

Fix video export stuttering/freeze that occurs when one or more grid cells have a video with audio enabled. The export uses MediaRecorder + canvas.captureStream() — NOT ffmpeg. Quality is preferred over export speed (slower encoding is acceptable).

</domain>

<decisions>
## Implementation Decisions

### Clarification: No ffmpeg in current stack
The current video export pipeline (`src/lib/videoExport.ts`) uses:
- `canvas.captureStream(FPS)` → live MediaStream
- `MediaRecorder` with MP4/WebM codec detection
- Web Audio API (`AudioContext` + `MediaElementAudioSourceNode`) for per-cell audio mixing
- `setInterval` at 30fps render loop
- No ffmpeg/wasm anywhere in the pipeline

### Audio Sync Strategy
- User wants separate mux strategy where possible
- Concretely: explore separating audio extraction from frame rendering to prevent interleave stalls
- The current approach mixes audio via WebAudio graph and video via canvas stream simultaneously

### Worker/Threading Model
- Move encoding work off main thread using Web Worker where possible
- MediaRecorder itself cannot move to a worker (no OffscreenCanvas + captureStream in workers in all browsers), but the frame rendering could use OffscreenCanvas if supported
- Investigate whether the setInterval + async renderFrame overlap causes main-thread stalls

### Quality vs Compatibility
- H.264 + AAC quality-first: use highest supported bitrate/quality settings
- Slower encoding is acceptable — user prefers no stutter over fast export
- Current: `videoBitsPerSecond: 6_000_000` — may need tuning

### Claude's Discretion
- Exact root cause diagnosis (seek stutter vs. async overlap vs. thread stall) — research to determine
- Whether OffscreenCanvas + worker is feasible or a simpler fix suffices
- Whether to keep MediaRecorder or evaluate WebCodecs as alternative for quality-first path

</decisions>

<specifics>
## Specific Ideas

- Suspected root causes (to validate in research):
  1. `setInterval` + async `renderFrame`: if rendering takes >33ms, next interval fires before previous completes → overlapping async calls
  2. Loop wrap seek (`video.currentTime = loopedTime` + `video.play()`) → momentary seek pause interrupts both audio and video stream
  3. `MediaElementAudioSourceNode` has audio gaps during seek
  4. Main thread blocked by canvas rendering → setInterval fires late → jank
- Existing audio graph: `buildAudioGraph()` in videoExport.ts wires `MediaElementAudioSourceNode` per unique audioEnabled video to a `MediaStreamAudioDestinationNode`
- Prefer quality: investigate if `requestAnimationFrame`-based loop or WebCodecs gives better A/V sync than setInterval

</specifics>

<canonical_refs>
## Canonical References

- `src/lib/videoExport.ts` — full export pipeline (MediaRecorder, audio graph, render loop)
- `src/lib/export.ts` — `renderGridIntoContext` (the per-frame canvas renderer)
- `src/lib/overlayExport.ts` — overlay drawing pass (runs after every frame render)
- `src/test/videoExport-audio.test.ts` — existing audio export tests
- `src/test/videoExport-loop.test.ts` — existing loop tests

</canonical_refs>
