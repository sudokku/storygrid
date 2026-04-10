# Quick Task 260410-7sa: Fix Video Export Stuttering/Freeze — Research

**Researched:** 2026-04-10
**Domain:** Browser video export — MediaRecorder + canvas.captureStream + Web Audio API
**Confidence:** HIGH (primary issues confirmed via code inspection + documented browser behavior)

---

## Summary

The current export pipeline has two confirmed and one likely root cause for stuttering. The highest-impact issue is the **unguarded async render loop**: `setInterval` fires at 33ms intervals but `renderFrame` is `async` and can take longer than 33ms on a 1080×1920 canvas with multiple video cells and overlay passes. When that happens, the next `setInterval` tick fires a second concurrent `renderFrame` before the first finishes — producing overlapping canvas writes that MediaRecorder captures as jank frames.

The second confirmed issue is **seek-induced audio gaps**: when a short video loops, the code does `video.currentTime = loopedTime; video.play()`. Seeking a `MediaElementAudioSourceNode`-wired element causes the Web Audio pipeline to stall for the duration of the seek I/O, producing an audible cut. This is a documented browser behavior, not a bug.

A third contributor is **setInterval timer drift** on a saturated main thread: at 1080×1920 with multiple canvas clips, blur filters, and overlay stickers, a single `renderGridIntoContext` + `drawOverlaysToCanvas` call takes well over 33ms on mid-range hardware, causing setInterval to fire late and produce sub-30fps output.

**Primary recommendation:** Add an `isRendering` guard flag to prevent async overlap (highest impact, lowest risk). Separately, soften loop wrap-around to avoid seek on every loop. WebCodecs VideoEncoder is the quality-first long-term path but requires a separate muxing step and has incomplete Safari support as of April 2026.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Fix target: MediaRecorder + canvas.captureStream pipeline — NOT ffmpeg
- Audio sync strategy: explore separating audio extraction from frame rendering to prevent interleave stalls
- Worker/threading: move encoding work off main thread where feasible; OffscreenCanvas if supported
- Quality over speed: H.264 + AAC quality-first, slower encoding acceptable
- Current bitrate: `videoBitsPerSecond: 6_000_000` — may need tuning

### Claude's Discretion
- Exact root cause ordering (seek stutter vs. async overlap vs. thread stall)
- Whether OffscreenCanvas + worker is feasible or a simpler fix suffices
- Whether to keep MediaRecorder or evaluate WebCodecs as quality-first alternative
</user_constraints>

---

## Root Cause Analysis

### Root Cause 1 — Unguarded Async Render Loop (CONFIRMED, HIGH SEVERITY)

**Evidence in code (videoExport.ts lines 466–545):**

```typescript
const renderFrame = async () => { ... };

intervalId = setInterval(() => {
  renderFrame().catch(err => { ... });
}, FRAME_DURATION_MS); // 33ms
```

`renderFrame` is `async` and does two awaited operations per tick:
1. `await renderGridIntoContext(...)` — iterates the full grid tree, calls `drawImage` on every video element, loads/decodes stickers
2. `await drawOverlaysToCanvas(...)` — awaits `document.fonts.ready` on every frame if overlays exist

On a 1080×1920 canvas with 4 video cells, a blur filter, and one sticker overlay, this easily exceeds 33ms. setInterval does not wait for the previous tick to complete — it fires again at exactly 33ms. The two concurrent `renderFrame` calls both write to `stableCtx`, with the second possibly drawing mid-composition of the first.

**Effect on recording:** MediaRecorder's captureStream sees partial frames — the canvas mid-render has inconsistent pixel content. This appears as a visual freeze (a frame drawn in multiple passes) and can corrupt A/V sync because the audio track continues advancing while the canvas frame is stuck mid-update.

[VERIFIED: code inspection of videoExport.ts]

### Root Cause 2 — Seek-Induced Audio Gap on Loop Wrap (CONFIRMED, MEDIUM SEVERITY)

**Evidence in code (videoExport.ts lines 506–514):**

```typescript
if (prev - loopedTime > video.duration * 0.5) {
  // Wrapped around — seek back to the start of the loop.
  video.currentTime = loopedTime;
  video.play().catch(() => {});
}
```

When a short clip wraps, the code sets `currentTime` and calls `play()`. The seek is async — the browser needs to re-decode from the new position. During that I/O window, the `MediaElementAudioSourceNode` connected to that element outputs **silence**. The duration of the gap depends on codec, hardware, and whether the seek lands on a keyframe. For H.264 video without dense keyframes, a seek can pause audio for 50–300ms.

The `await document.fonts.ready` call inside `drawOverlaysToCanvas` on every frame also contributes a minor async delay per frame, but only when overlays are present.

[VERIFIED: code inspection + documented Web Audio behavior at MDN AudioContext/createMediaElementSource] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaElementSource]

### Root Cause 3 — setInterval Timer Drift (CONFIRMED, LOWER SEVERITY)

`setInterval` is not frame-precise. On a saturated main thread (Canvas 2D draw at 1080×1920 is synchronous GPU-bound work), timers fire late. Chrome throttles setInterval in background tabs to 1/s. Even foreground, a 33ms interval with 40ms of canvas work produces ~75ms between rendered frames — the captured stream reflects that jank directly.

[VERIFIED: documented Chrome behavior] [CITED: https://bugzilla.mozilla.org/show_bug.cgi?id=1344524]

---

## Fix Options (Ranked by Impact vs. Risk)

### Fix A — isRendering Guard Flag (LOW RISK, HIGH IMPACT)

Add a boolean guard before `renderFrame` starts and clear it on completion. If the previous frame has not finished rendering, skip the current tick.

```typescript
let isRendering = false;

intervalId = setInterval(() => {
  if (isRendering) return; // previous frame not done — skip tick
  isRendering = true;
  renderFrame()
    .catch(err => { ... })
    .finally(() => { isRendering = false; });
}, FRAME_DURATION_MS);
```

**Effect:** Eliminates concurrent canvas writes. If a frame takes 50ms, the output is ~20fps instead of 30fps — which is better than a corrupted/stuttering 30fps. The audio track continues advancing at true speed; the video will drop frames but won't jitter.

**Tradeoff:** Exported video may be slightly under 30fps on complex scenes. Acceptable per "quality over speed" constraint.

[ASSUMED: this is a standard pattern for async render loops; no browser-specific evidence needed]

### Fix B — One-Shot `document.fonts.ready` Await (LOW RISK, QUICK WIN)

`drawOverlaysToCanvas` awaits `document.fonts.ready` on every frame. This is resolved immediately after first await, but the await itself adds microtask overhead and makes every frame async even when fonts are already ready. Hoist the await outside the loop.

**In videoExport.ts, before the setInterval block:**
```typescript
if (typeof document !== 'undefined' && document.fonts?.ready) {
  await document.fonts.ready; // await ONCE before loop
}
```

Then remove the `document.fonts.ready` await from inside `drawOverlaysToCanvas` for the video export path (or pass a flag). This reduces per-frame async overhead.

[VERIFIED: code inspection of overlayExport.ts lines 55-57]

### Fix C — Soften Loop Seek with Video.fastSeek() (MEDIUM RISK, MEDIUM IMPACT)

Instead of `video.currentTime = x` (which triggers full decode seek), use `video.fastSeek(x)` when available. `fastSeek` targets the nearest keyframe rather than the exact timestamp, making the seek complete faster.

```typescript
if ('fastSeek' in video) {
  (video as HTMLVideoElement & { fastSeek(time: number): void }).fastSeek(loopedTime);
} else {
  video.currentTime = loopedTime;
}
```

This does NOT eliminate the audio gap — it shortens it. The only way to eliminate the gap is to use the `loop` attribute (browser-native gapless looping) or pre-buffer with a second video element. However, `video.loop = true` conflicts with manual loop time tracking used for `computeLoopedTime`.

**Alternative approach for single-duration videos:** If all cells have the same duration as `totalDuration`, set `video.loop = true` and remove the manual wrap-around logic entirely. Only applies to the trivial case.

[CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/fastSeek]
[ASSUMED: audio gap reduction magnitude — not benchmarked]

### Fix D — captureStream(0) + requestFrame() (MEDIUM RISK, HIGH POTENTIAL IMPACT)

Using `canvas.captureStream(0)` with `videoTrack.requestFrame()` called after each completed render gives MediaRecorder a stable, render-complete frame rather than sampling the canvas at arbitrary times.

```typescript
const stream = stableCanvas.captureStream(0); // no auto-capture
const videoTrack = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;

// Inside renderFrame, after all drawing is complete:
await renderGridIntoContext(...);
await drawOverlaysToCanvas(...);
videoTrack.requestFrame(); // now push the completed frame
```

**Key advantage:** MediaRecorder receives frames only when the canvas is fully drawn. No partial-frame captures. Frame rate will be variable (matching actual render speed) rather than a nominal 30fps.

**Known limitation:** Videos produced this way have variable frame rates. MediaRecorder on Chrome/Firefox accepts this well. Safari behavior with captureStream(0) is less well tested.

[CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream]
[VERIFIED: requestFrame() is part of the CanvasCaptureMediaStreamTrack spec and is supported in Chrome and Firefox] [ASSUMED: Safari support level for captureStream(0) + requestFrame() — needs browser testing]

### Fix E — WebCodecs VideoEncoder + AudioEncoder (QUALITY CEILING, HIGH COMPLEXITY)

WebCodecs gives direct control over encoded frames: deterministic frame timestamps, hardware-accelerated H.264/VP9 encoding, explicit frame-accurate audio sync. This eliminates both the async-overlap problem and the seek-audio-gap problem.

**Architecture:**
1. Render frame to canvas → `ImageBitmap` → `VideoFrame(bitmap, { timestamp: elapsedUs })`
2. `VideoEncoder.encode(videoFrame)` — explicit timestamp eliminates setInterval drift
3. `AudioEncoder.encode(audioData)` — captured from AudioWorklet or Web Audio API output
4. Mux encoded chunks via mp4-muxer or webm-muxer (small, well-maintained libraries)
5. Output Blob

**Browser support (as of April 2026):**
- Chrome: full VideoEncoder + AudioEncoder support [VERIFIED: MDN / caniuse]
- Firefox: VideoEncoder + AudioDecoder supported; AudioEncoder support status varies [ASSUMED — needs verification against current Firefox version]
- Safari: Safari 26 adds AudioEncoder + AudioDecoder; Safari 15 (project minimum) has NO WebCodecs encoder support [CITED: webcodecsfundamentals.org/datasets/codec-analysis-2026]

**Blocker for this project:** CLAUDE.md states `Browser Support: Chrome 90+, Firefox 90+, Safari 15+` and `Video export Chrome/Firefox only`. WebCodecs VideoEncoder is not available in Safari 15, but since video export is already Chrome/Firefox-only, Safari exclusion is acceptable.

**Additional complexity:** Requires a muxer library. `mp4-muxer` (~40KB) or `webm-muxer` (~20KB) are the standard choices. Audio path requires decoding the source video's audio into `AudioData` frames — this adds complexity around `AudioDecoder` or Web Audio → `AudioWorkletProcessor` capture.

[CITED: https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API]
[CITED: https://developer.chrome.com/docs/web-platform/best-practices/webcodecs]
[ASSUMED: mp4-muxer + WebCodecs integration specifics — needs hands-on investigation]

### Fix F — OffscreenCanvas + Worker (NOT FEASIBLE, BLOCKED)

Moving canvas rendering to a worker via `OffscreenCanvas` would unblock the main thread. However, `captureStream()` is **not available on OffscreenCanvas** in any browser as of April 2026. The sequence `canvas.transferControlToOffscreen()` followed by `canvas.captureStream()` is not specified and not implemented.

[VERIFIED: w3c/mediacapture-fromelement Issue #84; MDN OffscreenCanvas docs]

This approach is blocked. Do not pursue.

---

## Recommended Fix Sequence

| Step | Fix | Effort | Impact |
|------|-----|--------|--------|
| 1 | Fix A: `isRendering` guard flag | ~15 min | Eliminates overlapping frame corruption |
| 2 | Fix B: hoist `document.fonts.ready` | ~10 min | Reduces per-frame async overhead |
| 3 | Fix D: `captureStream(0)` + `requestFrame()` | ~1 hour | Eliminates mid-render captures |
| 4 | Fix C: `fastSeek()` on loop wrap | ~20 min | Shortens audio gap on loop |

Steps 1+2+3 together address the primary stutter. Step 4 is a partial mitigation for the audio gap — a full fix requires either native `loop=true` (when duration matches) or a double-buffer video element (high complexity).

WebCodecs (Fix E) is the quality ceiling but represents a significant rewrite. Recommend as a follow-on phase after the MediaRecorder path is stabilized.

---

## Bitrate/Quality Settings

Current: `videoBitsPerSecond: 6_000_000` (6 Mbps) for 1080p.

For a static MediaRecorder canvas export at 1080×1920, industry guidance:
- 6 Mbps is adequate for H.264 at 30fps
- Increasing to 8–12 Mbps provides diminishing returns for canvas-sourced content (canvas pixels are already "perfect"; the compression artifacts at 6Mbps are minimal)
- The stutter is NOT caused by insufficient bitrate — it is caused by the render loop issues above

[ASSUMED: specific quality threshold — not benchmarked against this pipeline]

---

## Common Pitfalls for the Fix

### Pitfall 1: Guard Flag Causes Permanent Lock on Render Error
If `renderFrame` throws before the `finally` block clears `isRendering`, the flag stays `true` permanently. Use `try/finally` or `.finally()` to guarantee reset.

### Pitfall 2: captureStream(0) + requestFrame() Frame Count
With `captureStream(0)`, if `requestFrame()` is never called (e.g., render throws on first frame), MediaRecorder gets zero frames and may produce an empty or invalid file. Ensure the first frame always calls `requestFrame()` even on error paths, or fall back to a blank frame.

### Pitfall 3: Audio Continues During Dropped Frames
With Fix A (skip-if-busy), the audio track advances at real time but the video frame is held. This produces A/V drift proportional to the number of dropped frames. For scenes that consistently exceed 33ms per frame, the exported video will be slightly shorter than the audio. Mitigation: increase `totalDurationMs` by the estimated dropped-frame time, or cap skipped frames and warn the user.

### Pitfall 4: overlayImageCache await on Every Frame
`drawOverlaysToCanvas` awaits `loadImage` per sticker on first encounter, then caches. The cache is scoped to the export run (allocated in `exportVideoGrid`). This is already correct — no change needed here.

---

## Sources

### Primary (HIGH confidence)
- Code inspection: `/src/lib/videoExport.ts` — confirmed setInterval + async overlap, confirmed seek on loop wrap
- Code inspection: `/src/lib/overlayExport.ts` — confirmed per-frame `document.fonts.ready` await
- [MDN AudioContext.createMediaElementSource](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaElementSource) — audio gap behavior during seek
- [MDN HTMLCanvasElement.captureStream](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream) — requestFrame() spec

### Secondary (MEDIUM confidence)
- [w3c mediacapture-record Issue #213](https://github.com/w3c/mediacapture-record/issues/213) — non-realtime frame-by-frame recording discussion
- [w3c mediacapture-fromelement Issue #84](https://github.com/w3c/mediacapture-fromelement/issues/84) — OffscreenCanvas + captureStream not specified
- [Chrome Developers — WebCodecs](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs) — WebCodecs video encoding
- [MDN WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) — browser support matrix

### Tertiary (LOW confidence / ASSUMED)
- isRendering guard flag effectiveness — pattern derived from training knowledge, not benchmarked against this codebase
- WebCodecs AudioEncoder Firefox status — caniuse data changes frequently; verify before committing to Fix E

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `isRendering` guard flag is sufficient to prevent MediaRecorder from receiving corrupted mid-render frames | Fix A | If MediaRecorder samples frames asynchronously between guard set/clear, jank may persist → need captureStream(0) as additional measure |
| A2 | Audio gap on loop seek is 50–300ms range | Root Cause 2 | Gap may be shorter (sub-perceptible) or longer depending on codec/hardware; affects priority of Fix C |
| A3 | `fastSeek()` reduces audio gap duration | Fix C | fastSeek availability and behavior varies; may have no effect |
| A4 | Firefox AudioEncoder support is stable as of April 2026 | Fix E | WebCodecs support table changes frequently; verify before choosing WebCodecs path |
