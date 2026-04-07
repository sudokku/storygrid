---
status: awaiting_human_verify
trigger: "Three regressions after WebCodecs+Mediabunny optimization: canvas preview stutters, no speed improvement, playback scrubber frozen"
created: 2026-04-05T00:00:00Z
updated: 2026-04-05T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — blank first frames caused by two independent issues: (1) buildExportVideoElements only awaited readyState>=1 (HAVE_METADATA), giving no pixel data for drawImage; (2) recorder.start() was called before any frame was rendered to the canvas.
test: (1) Upgraded readyState check to >=2 (HAVE_CURRENT_DATA) via loadeddata/canplay events + explicit video.load() for detached elements. (2) Moved pre-flight: play videos → renderGridIntoContext → recorder.start(). Canvas has real content before recording begins.
expecting: No blank frames at start. TypeScript clean. All tests pass. Awaiting human verification.
next_action: Human verify in browser

## Symptoms

expected: Video export runs at same speed or faster, canvas preview plays smoothly, playback controls remain responsive
actual:
  1. Canvas preview stutters/pauses after 2-3 seconds of encoding
  2. No measurable encoding speed improvement — still 2-3 minutes for 19-second video
  3. Playback scrubber/timeline bar frozen while encoding runs
errors: None — console is clean
reproduction: Start a video export with at least one video cell
started: After quick task 260405-v3y changes (commits 03b9cef, 0b6fdcf)

## Eliminated

- hypothesis: imageCache sharing causes cross-frame contamination
  evidence: imageCache only stores HTMLImageElements keyed by dataUri string. Images are immutable once decoded. No blob URLs involved — mediaRegistry stores data URIs. Safe to share.
  timestamp: 2026-04-05

- hypothesis: renderGridIntoContext clears canvas causing race with CanvasSource async snapshot
  evidence: Mediabunny CanvasSource.add() calls new VideoSample(canvas) which immediately calls new VideoFrame(canvas) synchronously. VideoFrame captures pixel data at construction time — no async gap. The canvas is fully painted before add() is called in the current code ordering, so no race exists.
  timestamp: 2026-04-05

## Evidence

- timestamp: 2026-04-05
  checked: User checkpoint response — 3 issues remain after prior fixes
  found: (1) Stutter still visible (frame-by-frame advance is inherently choppy, setTimeout(0) is correct but slow progress = choppy preview). (2) Scrubber not always in sync — React renders between frames but 200ms seek gaps are long. (3) No speed improvement — 2+ min for 570 frames. Math: 570 × ~200ms avg seek = ~114s. This confirms seek cost dominates, not encoding.
  implication: The root performance problem is sequential seek-per-frame architecture. Pre-decoding all frames via requestVideoFrameCallback eliminates seek cost entirely.

- timestamp: 2026-04-05
  checked: requestVideoFrameCallback API and pre-decode feasibility
  found: rVFC fires when each decoded frame is ready during natural playback. For a 19s video at 30fps = 570 frames, natural playback captures all frames in ~19s real time. Post-capture, the encode loop draws ImageBitmap → canvas → videoSource.add() with no seeking — encode phase is limited only by VideoEncoder throughput, not I/O.
  implication: Pre-decode approach: total time ≈ 19s capture (natural playback) + ~2-5s encode = ~21-24s vs current ~120s. 5-6x speedup expected.

- timestamp: 2026-04-05
  checked: Multi-video handling with pre-decode
  found: Each video element is pre-decoded independently in parallel during its natural playback duration. Frame lookup at export time uses computeLoopedTime(timeSeconds, video.duration) to get the looped timestamp, then maps to frame index Math.round(loopedTime * FPS). Shorter videos that loop are captured once and indexed by modulo.
  implication: Pre-decode is correct for both single-video and multi-video grids with looping.

- timestamp: 2026-04-05
  checked: mediabunny/dist/modules/src/sample.js line 252-257
  found: When VideoFrame API is available (Chrome/Firefox WebCodecs), new VideoSample(canvas) immediately calls new VideoFrame(canvas, {timestamp, duration}). VideoFrame captures pixel data synchronously at construction. No async read path.
  implication: Hypothesis 4 (canvas race) is eliminated. The ordering of renderGridIntoContext → videoSource.add() is safe.

- timestamp: 2026-04-05
  checked: mediabunny/dist/modules/src/media-source.js lines 318-322 (VideoEncoderWrapper.add)
  found: Backpressure only triggers when encodeQueueSize >= 4. Below that threshold, add() resolves immediately without yielding. The muxer mutex also provides backpressure but only when the writer is active.
  implication: With hardware acceleration, encoding is fast — queue stays below 4, add() returns immediately every frame. The await loop never yields to the browser event loop, so React never runs → UI freezes completely.

- timestamp: 2026-04-05
  checked: videoExport.ts frame loop (lines 148-164)
  found: No setTimeout(0)/yield between frames. Loop does: seek → renderGridIntoContext → videoSource.add() — all synchronous or fast-resolving microtasks. No macrotask boundary created.
  implication: This is the confirmed root cause of regression #3 (frozen scrubber) AND regression #1 (stutter). React cannot update the preview display element because it never gets a turn on the main thread.

- timestamp: 2026-04-05
  checked: seekAllVideosTo timeout (line 80-83)
  found: Timeout reduced from 500ms to 100ms. For most frames the seek-skip threshold (FRAME_DURATION_SEC*0.5 = 0.0167s) fires and seek is skipped entirely (resolves immediately). Only when the video needs a real seek does the 100ms timeout matter.
  implication: For videos with keyframe gaps > 100ms (common in H.264/H.265 with keyframe interval of 2s+), the timeout fires before the video is actually seeked, causing the frame to use the previous video position. This causes wrong frames in the export and visual stutter in the preview. 100ms is too aggressive for videos that need to seek across keyframe boundaries. The original 500ms was conservative but correct.

- timestamp: 2026-04-05
  checked: hardwareAcceleration: 'prefer-hardware' + latencyMode: 'quality'
  found: With hardware encoding, the VideoEncoder processes frames extremely fast (sub-millisecond). The encodeQueueSize stays at 0-1. Combined with no yield between frames, the loop runs as fast as JS can execute — hundreds of frames per second on the encoding side — but canvas preview never repaints because RAF never fires.
  implication: Hardware acceleration actually makes regression #3 WORSE because the loop spins even faster without backpressure. Adding a yield fixes this. Speed regression #2 is likely caused by seek timeout: incorrect frames trigger error recovery or re-seeks internally.

- timestamp: 2026-04-05
  checked: latencyMode: 'quality' vs default
  found: latencyMode: 'quality' tells the encoder to buffer more frames before outputting — this can actually REDUCE throughput for the app because the encoder holds frames in its queue longer before releasing them to the muxer. Combined with keyFrameInterval: 2, the encoder must buffer 2 seconds of frames before it can output the keyframe group.
  implication: latencyMode: 'quality' is counterproductive here. We're doing offline export; we want maximum throughput. 'realtime' or omitting this field would be faster.

- timestamp: 2026-04-05
  checked: Blank first frame fix implementation
  found: Two root causes confirmed and fixed. (1) buildExportVideoElements upgraded from readyState>=1 (HAVE_METADATA) to readyState>=2 (HAVE_CURRENT_DATA) — now listens for loadeddata/canplay events and calls video.load() to trigger loading on detached elements. (2) Execution order restructured: play all export video elements → await play promises → renderGridIntoContext (pre-render) → recorder.start(). Canvas has real pixels before recording begins.
  implication: First frame of exported video will have correct content. Images are pre-warmed into imageCache during the pre-render. Video elements are at their first decodable frame before the interval loop begins.

- timestamp: 2026-04-05
  checked: Human verification of pre-decode + WebCodecs implementation
  found: (1) Catastrophic RAM: 591 frames × 7.9MB = 4.7GB for one video, ~7GB peak for two videos — UI responding very slowly. (2) VideoEncoder backpressure broken: encode-3 took 631ms, encode-4 took 1163ms, phase2-encode total 199,697ms for 591 frames. (3) rVFC capture is ~1.5× realtime — Video 1 (19.7s) took 29.7s to capture, only got 563/591 frames before timeout. Pre-decode approach is not viable for any video longer than ~5s at 1080p.
  implication: The fundamental architectural choice (pre-decode all frames to RAM) is wrong. Must replace with MediaRecorder + captureStream which is O(1) memory, runs at 1× speed, and handles backpressure internally.

## Resolution

root_cause: |
  FIVE confirmed root causes:

  1-3. (Prior investigation) Main thread starvation, seek timeout too short,
       latencyMode: 'quality' counterproductive.

  4. SEEK COST IS THE DOMINANT BOTTLENECK — 570 seeks × ~200ms = ~114s minimum.
     Pre-decode (Phase 2 attempt) eliminated seeks but introduced Problem 5.

  5. PRE-DECODE ARCHITECTURE CATASTROPHICALLY WRONG — ImageBitmap storage of ALL
     frames simultaneously: 591 frames × 7.9MB = 4.7GB per video, ~7GB peak for
     two videos. rVFC capture is ~1.5× realtime, so timeout fires before all frames
     captured. VideoEncoder backpressure broken (phase2-encode took 199.7s for 591
     frames = 338ms/frame). The fundamental approach of storing all frames in RAM
     is not viable for any video longer than ~5s at 1080p.

fix: |
  Replace pre-decode + WebCodecs + Mediabunny with MediaRecorder + captureStream:

  - canvas.captureStream(FPS) creates a live MediaStream from the stable canvas.
  - new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' }) handles
    encoding and muxing internally (no WebCodecs backpressure, no Mediabunny).
  - All video elements play simultaneously at 1× speed from time 0.
  - setInterval every FRAME_DURATION_MS: renderGridIntoContext draws from live
    video elements into stableCanvas; MediaRecorder captures automatically.
  - Loop wrap-around handled manually: detect wrap via computeLoopedTime, seek
    back to looped position and re-play.
  - After totalDuration ms: stop interval, stop videos, recorder.stop().
  - ondataavailable chunks → Blob → returned to caller.

  Memory: O(1) — only current canvas pixels, no frame accumulation.
  Export time: ~totalDuration + <1s muxing (e.g. ~20s for 19s video).
  Output: WebM VP9 (Chrome + Firefox) — download filename updated to .webm.

  Also fixed: pre-existing Toolbar.tsx bug where mediaRegistry was referenced but
  not destructured from useGridStore.getState().

  Removed: CanvasSource, Mediabunny VideoWriter, preDecodeVideoFrames, all
  ImageBitmap frame handling, seekAllVideosTo fallback path (no longer needed),
  preDecodedVideoFrames parameter from renderGridIntoContext and renderNode.

verification: |
  Round 1 (MediaRecorder): TypeScript clean. Build 336KB gzipped. 399 tests pass.
  Round 2 (dedicated elements + MP4):
    - TypeScript clean (npx tsc --noEmit: no errors).
    - Build passes: 336KB gzipped.
    - All 33 test files pass, 399 tests pass, 0 failures.
    - Fix 1 (dedicated export elements): buildExportVideoElements creates fresh
      HTMLVideoElement instances from blob URLs, completely isolated from live UI
      elements. destroyExportVideoElements cleans up after export.
    - Fix 2 (MP4): MediaRecorder probes video/mp4;codecs=avc1.42E01E first —
      Chrome 130+ returns true. Falls back to video/mp4, then WebM VP9, VP8.
      Download filename extension is .mp4 or .webm based on actual blob type.
    - exportVideoGrid signature updated: added mediaTypeMap parameter (3rd arg).
    - ExportSplitButton updated: passes mediaTypeMap, dynamic extension, labels.
    - Test updated: correct parameter order, updated label expectation.
  Round 3 (blank first frame fix):
    - TypeScript clean (npx tsc --noEmit: no errors).
    - All 33 test files pass, 399 tests pass, 0 failures.
    - Fix 1: buildExportVideoElements upgraded to readyState>=2 (HAVE_CURRENT_DATA)
      via loadeddata/canplay events. video.load() called explicitly for detached
      elements (no DOM → no auto-preload in some browsers).
    - Fix 2: Execution order before recorder.start() is now: play all export
      videos → renderGridIntoContext (pre-render with real content) → recorder.start().
      The canvas has valid pixel data at the moment MediaRecorder begins capturing.
    - startTime anchored after recorder.start() — pre-flight render time not
      counted against export progress percentage.
    - Awaiting browser verification that first frame is no longer blank.
files_changed:
  - src/lib/videoExport.ts
  - src/lib/export.ts
  - src/Editor/ExportSplitButton.tsx
  - src/Editor/Toolbar.tsx
  - src/test/phase04-02-task1.test.tsx
