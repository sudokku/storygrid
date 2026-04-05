# Phase v3y: Optimize WebCodecs + Mediabunny Video Export Performance — Research

**Researched:** 2026-04-05
**Domain:** WebCodecs VideoEncoder performance, Mediabunny CanvasSource, canvas frame pipeline optimization
**Confidence:** HIGH (MDN spec / Mediabunny docs), MEDIUM (pipeline bottleneck estimates)

---

## Summary

The current `exportVideoGrid` pipeline takes 2-3 minutes to export a 19-second video (570 frames at 30fps, 1080×1920px). This is unexpected given WebCodecs should encode at hardware speed. The bottleneck is almost certainly **not** the encoder itself — it is the sequential frame pipeline: each frame waits for a video seek, creates a new canvas, renders, copies to stable canvas, then encodes. Each seek event wait alone can cost 50-500ms. The encoder may also be running in software if `hardwareAcceleration: 'prefer-hardware'` is not specified.

Three distinct bottleneck classes exist:

1. **Video seek cost** — `HTMLVideoElement.currentTime = T` triggers async seek. With `await seeked`, each frame blocks 50–500ms. For 570 frames with even one video cell, this is 28–285 seconds of pure waiting.
2. **Canvas allocation per frame** — `renderGridToCanvas` calls `document.createElement('canvas')` on every frame. Canvas allocation + GPU surface creation is expensive at 1080×1920. Should reuse a single canvas and clear it.
3. **Encoder not explicitly requesting hardware** — `CanvasSource` by default passes `hardwareAcceleration: 'no-preference'`, which may resolve to software encoding. Explicit `'prefer-hardware'` can give 5–15x throughput improvement.

**Primary recommendation:** Add `hardwareAcceleration: 'prefer-hardware'` to CanvasSource config, reuse the stable canvas for rendering (eliminate the intermediate `frameCanvas`), and reduce the seek timeout from 500ms to 100ms.

---

## Bottleneck Analysis (Current Code)

### What the code does per frame

```typescript
// In exportVideoGrid — current pipeline, sequential per frame:
for (let frame = 0; frame < totalFrames; frame++) {
  // Step 1: Seek all video elements (async — waits for 'seeked' event, up to 500ms timeout)
  await seekAllVideosTo(timeSeconds);

  // Step 2: renderGridToCanvas — CREATES A NEW CANVAS EVERY FRAME
  const frameCanvas = await renderGridToCanvas(...); // document.createElement('canvas')

  // Step 3: Copy to stable canvas
  stableCtx.drawImage(frameCanvas, 0, 0);

  // Step 4: Encode (fast if hardware-accelerated)
  await videoSource.add(timeSeconds, FRAME_DURATION_SEC);
}
```

### Cost breakdown (estimated for 570 frames, 1 video cell)

| Step | Per-frame cost | Total (570 frames) |
|------|---------------|---------------------|
| `seekAllVideosTo` (1 video, 50ms avg) | 50ms | ~29 seconds |
| `seekAllVideosTo` (1 video, 200ms avg) | 200ms | ~114 seconds |
| `document.createElement('canvas')` at 1080×1920 | 5–20ms | 3–11 seconds |
| `renderGridToCanvas` (images) | 1–5ms | 0.5–3 seconds |
| `stableCtx.drawImage` | <1ms | <1 second |
| `videoSource.add()` — software encode | 50–200ms | 28–114 seconds |
| `videoSource.add()` — hardware encode | 2–10ms | 1–6 seconds |

**Key insight:** If seek cost is 100ms/frame and encoding is software, both add up to 2-3 minutes. Hardware encoding reduces encoding to <6 seconds total, so seek cost becomes the dominant bottleneck.

---

## Optimization 1: Hardware Acceleration (HIGH IMPACT)

### Current gap

`CanvasSource` in Mediabunny accepts `VideoEncodingConfig`. The current code passes:
```typescript
const videoSource = new CanvasSource(stableCanvas, {
  codec,           // 'avc' or 'vp9'
  bitrate: QUALITY_HIGH,
});
```

`hardwareAcceleration` is not set — defaults to `'no-preference'`, which the browser may resolve to software encoding.

### Fix

```typescript
const videoSource = new CanvasSource(stableCanvas, {
  codec,
  bitrate: QUALITY_HIGH,
  hardwareAcceleration: 'prefer-hardware',
  latencyMode: 'quality',    // default, but explicit is clearer
});
```

### Expected impact

- Hardware encoding (VideoToolbox on macOS, Media Foundation on Windows, VA-API on Linux) runs at 10–50x realtime for H.264 at 1080p.
- Software H.264 at 1080×1920 in browser: ~5–15 fps encode throughput → ~38–114 seconds for 570 frames.
- Hardware H.264 at 1080×1920 in browser: ~100–500 fps → ~1–6 seconds for 570 frames.
- Estimated speedup from this change alone: **10–30x** if previously running in software.

### Detection

Use `VideoEncoder.isConfigSupported()` before starting to verify hardware availability:
```typescript
const config = {
  codec: 'avc1.4D0029',
  width: 1080,
  height: 1920,
  hardwareAcceleration: 'prefer-hardware',
};
const support = await VideoEncoder.isConfigSupported(config);
// support.supported: boolean
// support.config: the actual config that will be used (may differ from requested)
```

**Caveat:** `isConfigSupported()` returning `true` for `prefer-hardware` does not guarantee a hardware encoder will be used at runtime — it means the browser considers the config viable. Chrome on Windows typically falls back to software if the GPU driver doesn't support H.264 encoding.

**Confidence:** HIGH (MDN VideoEncoder.configure() spec confirms hardwareAcceleration behavior)

---

## Optimization 2: Eliminate Canvas-Per-Frame Allocation (MEDIUM IMPACT)

### Current gap

`renderGridToCanvas` creates a new `HTMLCanvasElement` every frame:
```typescript
// Inside renderGridToCanvas:
const canvas = document.createElement('canvas');
canvas.width = 1080;
canvas.height = 1920;
```

This is called 570 times. Creating a GPU-backed canvas surface at 1080×1920 allocates memory and (potentially) a GPU texture each time. The allocation + GC pressure adds 3–11 seconds overhead.

### Fix

Pass the stable canvas directly into `renderGridToCanvas` (or refactor to `renderGridIntoContext`):

```typescript
// Option A: Pass stable canvas as output target, skip the extra drawImage copy
// Modify renderGridToCanvas signature:
export async function renderGridToCanvas(
  root: GridNode,
  mediaRegistry: Record<string, string>,
  width = 1080,
  height = 1920,
  settings: CanvasSettings = DEFAULT_CANVAS_SETTINGS,
  videoElements?: Map<string, HTMLVideoElement>,
  existingCanvas?: HTMLCanvasElement,  // NEW optional param
): Promise<HTMLCanvasElement> {
  const canvas = existingCanvas ?? document.createElement('canvas');
  // ...rest unchanged
}
```

Or, more cleanly, extract a `renderGridIntoContext` function that accepts a pre-existing `CanvasRenderingContext2D` and call it directly in `exportVideoGrid`:

```typescript
// In exportVideoGrid — remove intermediate frameCanvas:
const stableCanvas = document.createElement('canvas');
stableCanvas.width = 1080;
stableCanvas.height = 1920;
const stableCtx = stableCanvas.getContext('2d')!;

for (let frame = 0; frame < totalFrames; frame++) {
  await seekAllVideosTo(timeSeconds);
  // Render directly into stableCtx — no intermediate canvas
  await renderGridIntoContext(stableCtx, root, mediaRegistry, 1080, 1920, settings, videoElementsByMediaId);
  await videoSource.add(timeSeconds, FRAME_DURATION_SEC);
}
```

**Estimated savings:** 3–11 seconds (eliminates 570 canvas allocations + drawImage copies).

**Confidence:** HIGH (canvas allocation cost is well-documented; MDN Canvas optimization guide explicitly recommends reusing canvas instances)

---

## Optimization 3: Reduce Seek Timeout (MEDIUM IMPACT)

### Current gap

`seekAllVideosTo` has a 500ms safety timeout before it considers a seek "done":
```typescript
const timer = setTimeout(() => {
  video.removeEventListener('seeked', onSeeked);
  resolve();
}, 500);  // 500ms timeout
```

In the worst case where `seeked` never fires (corrupted video, codec glitch), this 500ms fires. For a healthy video this timeout is never hit — but there is a secondary bug: the `setTimeout` cleanup listener is added but never properly cleared when `seeked` does fire:

```typescript
video.addEventListener('seeked', () => clearTimeout(timer), { once: true });
```

This second listener is correct but the 500ms timer starts immediately regardless. If the seek takes 150ms, we wait 150ms (good). If it takes 501ms, we resolve at 500ms without waiting for the real seek (potentially a frame-accurate rendering bug).

**Reduction recommendation:** Drop to 100ms. For a local blob URL video (already buffered), seeks typically complete in <50ms. If seek takes longer than 100ms, the video may not be fully decoded to that frame — but for standard MP4/WebM files loaded as blob URLs, 100ms is generous.

### Alternative: Check if seek is actually needed

Many consecutive frames during static sections don't need all videos re-sought. If the video's `currentTime` is already within 1 frame duration of the target, skip the seek:

```typescript
const effectiveTime = computeLoopedTime(timeSeconds, video.duration);
const frameDuration = 1 / 30;
if (Math.abs(video.currentTime - effectiveTime) < frameDuration * 0.5) {
  // Already at correct position — skip seek entirely
  resolve();
  return;
}
```

The current code has a similar check (`< 0.01`) but 0.01 seconds is only half a frame at 30fps. Using `frameDuration * 0.5` (0.0167s) is more useful — prevents unnecessary seeks when already on the correct frame.

**Confidence:** MEDIUM (seek timing depends on video codec/size — these are heuristic numbers)

---

## Optimization 4: Bitrate / Quality Preset Reduction (LOW-MEDIUM IMPACT)

### Current gap

`QUALITY_HIGH` in Mediabunny maps to an internally calculated high bitrate. For Instagram Stories, which are viewed on phones at compressed quality, `QUALITY_MEDIUM` may be sufficient.

### Mediabunny quality constants

Mediabunny offers five presets: `QUALITY_VERY_LOW`, `QUALITY_LOW`, `QUALITY_MEDIUM`, `QUALITY_HIGH`, `QUALITY_VERY_HIGH`. For H.264 at 1080×1920 at 30fps, the calculated bitrates are approximately:
- `QUALITY_HIGH`: ~8–12 Mbps (estimated)
- `QUALITY_MEDIUM`: ~4–6 Mbps (estimated)

Higher bitrate = more encoder work per frame = slower even with hardware acceleration.

Alternatively, specify a bitrate explicitly:
```typescript
const videoSource = new CanvasSource(stableCanvas, {
  codec,
  bitrate: 6_000_000,  // 6 Mbps — good quality for 1080p Story content
  hardwareAcceleration: 'prefer-hardware',
});
```

**Note:** For hardware-accelerated encoding, bitrate has smaller impact on throughput than for software encoding (the hardware encoder pipeline has fixed overhead per frame regardless of bitrate within a reasonable range).

**Confidence:** MEDIUM (Mediabunny quality preset bitrate values are estimated; exact values not documented publicly)

---

## Optimization 5: Keyframe Interval (LOW IMPACT on speed, HIGH IMPACT on file size)

### Current gap

`CanvasSource` defaults to `keyFrameInterval: 5` seconds. For a 19-second video, this means ~4 keyframes. This is reasonable.

However, the `keyFrameInterval` directly affects encoder buffering: longer GOP (group of pictures) = encoder must look further ahead for B-frame placement = more memory and computation.

```typescript
const videoSource = new CanvasSource(stableCanvas, {
  codec,
  bitrate: QUALITY_HIGH,
  hardwareAcceleration: 'prefer-hardware',
  keyFrameInterval: 2,  // More frequent keyframes, shorter GOP, faster encoding
});
```

Shorter `keyFrameInterval` (e.g., 2 seconds) slightly improves seeking in the output file. For offline batch encoding, the difference in speed is small but not zero — `latencyMode: 'quality'` enables B-frames and lookahead; shorter GOP reduces this.

**Confidence:** LOW (impact is codec/hardware-specific; hardware encoders often ignore GOP hints)

---

## Optimization 6: Web Worker + OffscreenCanvas (HIGH IMPACT, HIGH EFFORT)

### What it is

Move the entire encode pipeline to a Web Worker using `OffscreenCanvas`. This keeps the main thread responsive during export and can be slightly faster because encoding doesn't compete with React's render loop for CPU time.

### Architecture

```
Main thread:
  - Transfer stableCanvas.transferControlToOffscreen() → worker
  - PostMessage: { root, mediaRegistry, settings, totalDuration }
  - Listen for { type: 'progress', percent } and { type: 'done', blob }

Worker thread:
  - Receives OffscreenCanvas
  - Creates CanvasSource(offscreenCanvas, ...)
  - Runs the full frame loop (seek video elements via postMessage round-trip — complex)
  - Returns Blob via postMessage with transfer
```

### Complexity blocker for StoryGrid

**Critical problem:** `HTMLVideoElement` lives on the main thread. The worker cannot access `videoElementRegistry` directly. Seeking video elements from a worker requires:
1. PostMessage seek requests to main thread
2. Main thread seeks video + waits for `seeked`
3. Main thread `drawImage(video, ...)` onto a shared OffscreenCanvas or sends frame data back to worker

This adds message-passing latency that may negate the threading benefit. The architecture becomes:

```
Worker: "seek video to T and paint it to shared canvas" →
Main: seeks video, waits for seeked, draws to canvas →
Worker: reads canvas, encodes
```

This round-trip adds ~1-5ms overhead per frame (message passing), but eliminates main-thread blocking and allows the encoder to run truly concurrently.

**Recommendation:** Do NOT implement the worker optimization as the first step. Fix optimizations 1-3 first. If the result is still >30 seconds, then add the worker architecture.

**Confidence:** MEDIUM (worker threading benefit is real but complexity is high for this use case due to video element being on main thread)

---

## Codec Choice: VP8 vs VP9 vs AVC vs AV1

| Codec | Chrome encode speed | Firefox | Hardware accel | Recommendation |
|-------|--------------------|---------|--------------------|----------------|
| AVC (H.264) | Fast | Buggy (Bugzilla #1918769) | Yes (common) | Chrome primary |
| VP9 | Medium | Fast | Partial | Firefox fallback |
| VP8 | Fast | Fast | Rare | Avoid (poor quality) |
| AV1 | Very slow (software) | N/A | Limited (Intel Arc only) | Do not use |
| HEVC (H.265) | Fast | No | macOS only | Do not use |

**Current code is correct:** AVC for Chrome, VP9 for Firefox. No codec change needed.

**AV1 specifically:** 3-5x more CPU-intensive than VP9 in software. Hardware AV1 encoding requires Intel Arc GPU or very recent Apple Silicon. Do not use for this task.

**Confidence:** HIGH (MDN, Chrome Developer blog, known Firefox bug)

---

## Portrait 1080×1920 Gotchas

### Non-standard aspect ratio and encoder

H.264 at 1080×1920 is a valid configuration — it is the standard Instagram Story resolution. Hardware H.264 encoders on all major platforms support this resolution (it falls within Level 4.0 / 4.1 limits). No special handling needed.

**The only gotcha:** Some older hardware H.264 encoders have width/height alignment requirements (width must be multiple of 16). 1080 is divisible by 8 but not 16. The WebCodecs API handles alignment internally — `isConfigSupported()` will return false if the hardware encoder can't handle it, and the browser will fall back to software.

**VP9 and portrait:** VP9 has no alignment restrictions at this resolution.

**Confidence:** MEDIUM (alignment requirement sourced from MDN, confirmed by WebCodecs spec discussion; actual hardware behavior is implementation-specific)

---

## Recommended Change Priority

| Priority | Change | Effort | Expected Speedup |
|----------|--------|--------|-----------------|
| 1 | Add `hardwareAcceleration: 'prefer-hardware'` to CanvasSource | 1 line | 5–30x encoding speed |
| 2 | Eliminate intermediate `frameCanvas` — render directly into `stableCtx` | Low (refactor `renderGridToCanvas` or add overload) | 10–20s saved |
| 3 | Reduce seek timeout 500ms → 100ms | 1 line | 0–200s saved (if seeks were timing out) |
| 4 | Tighten seek skip threshold: `< 0.01` → `< frameDuration * 0.5` | 1 line | Removes unnecessary seeks |
| 5 | Reduce bitrate: `QUALITY_HIGH` → `6_000_000` explicit | 1 line | Minor (5–15% on software encode) |
| 6 | Add `keyFrameInterval: 2` | 1 line | Minor (<5%) |
| 7 | Worker + OffscreenCanvas architecture | High | Eliminates main thread blocking; not faster for single-thread video seek bottleneck |

---

## Full Recommended CanvasSource Config

```typescript
// Chrome: AVC + hardware acceleration
const videoSource = new CanvasSource(stableCanvas, {
  codec: isFirefox ? 'vp9' : 'avc',
  bitrate: 6_000_000,                   // 6 Mbps — reduced from QUALITY_HIGH
  hardwareAcceleration: 'prefer-hardware',
  latencyMode: 'quality',               // explicit (was already default)
  keyFrameInterval: 2,                  // 2s GOP — reduces lookahead buffering
});
```

---

## Code Example: Render into Existing Context (No Canvas Allocation)

The key refactor to eliminate per-frame canvas allocation:

```typescript
// New helper — renders into an existing context instead of creating a new canvas
export async function renderGridIntoContext(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  root: GridNode,
  mediaRegistry: Record<string, string>,
  width: number,
  height: number,
  settings: CanvasSettings,
  videoElements?: Map<string, HTMLVideoElement>,
  imageCache?: Map<string, HTMLImageElement>,
): Promise<void> {
  const cache = imageCache ?? new Map<string, HTMLImageElement>();
  // Paint background
  if (settings.backgroundMode === 'gradient') {
    // ... same gradient logic ...
  } else {
    ctx.fillStyle = settings.backgroundColor;
  }
  ctx.fillRect(0, 0, width, height);
  await renderNode(ctx, root, { x: 0, y: 0, w: width, h: height }, mediaRegistry, cache, settings, videoElements);
}

// In exportVideoGrid — create imageCache ONCE outside the loop:
const imageCache = new Map<string, HTMLImageElement>();

for (let frame = 0; frame < totalFrames; frame++) {
  const timeSeconds = frame * FRAME_DURATION_SEC;
  if (videoElementRegistry.size > 0) {
    await seekAllVideosTo(timeSeconds);
  }
  // Render directly into stableCtx — no new canvas, no drawImage copy
  await renderGridIntoContext(stableCtx, root, mediaRegistry, 1080, 1920, settings, videoElementsByMediaId, imageCache);
  await videoSource.add(timeSeconds, FRAME_DURATION_SEC);
  onProgress('encoding', Math.round(((frame + 1) / totalFrames) * 100));
}
```

**Note:** The `imageCache` optimization is already present inside `renderGridToCanvas` but the cache is recreated each call. Moving the cache outside the loop means images are decoded once across all frames, not once per frame.

---

## Common Pitfalls

### Pitfall 1: Seek Cost Dominates After Hardware Encoding Fixed

**What goes wrong:** After enabling hardware acceleration, encoding drops from 2 minutes to 10 seconds but export is still 60-120 seconds. Seek cost is now the bottleneck.

**Root cause:** Each `await seekAllVideosTo()` blocks the loop for the full duration of the video decoder's seek operation. For a 19-second video loaded as a blob URL, seeks typically take 20-150ms per frame.

**How to avoid:** Pre-decode video frames using `requestVideoFrameCallback` (not feasible for arbitrary seek) or accept the seek cost as a hard lower bound. For a single video cell, 570 seeks × 50ms = ~29 seconds minimum.

**Alternative approach (HIGH EFFORT):** Use `VideoDecoder` API to decode all video frames once into an array of `ImageBitmap` objects before the encode loop begins. Then the encode loop has zero seek latency. This is a separate, significant refactor and is not recommended as the first optimization.

### Pitfall 2: `hardwareAcceleration: 'prefer-hardware'` Falls Back to Software Silently

**What goes wrong:** You add `prefer-hardware` but encoding is still slow. The browser fell back to software without telling you.

**Detection:**
```typescript
const config = {
  codec: 'avc1.4D0029',
  width: 1080, height: 1920,
  hardwareAcceleration: 'prefer-hardware',
};
const result = await VideoEncoder.isConfigSupported(config);
console.log('config supported:', result.supported);
console.log('actual config:', result.config); // browser may downgrade hardwareAcceleration
```

The `result.config.hardwareAcceleration` in the returned config shows what the browser actually plans to use. If it returns `'no-preference'`, hardware is unavailable.

### Pitfall 3: `frame.close()` Not Called After Manual Encode (If Switching to Manual Pipeline)

**What goes wrong:** After 4-8 frames, encoding stalls because the VideoFrame GPU texture pool is exhausted.

**Relevance:** `CanvasSource` handles `frame.close()` internally. This pitfall only applies if the code is refactored to use `EncodedVideoPacketSource` + manual `VideoEncoder`. Do not change to the manual pipeline unless `CanvasSource` becomes a bottleneck.

### Pitfall 4: Seek Skip Threshold Too Tight

**What goes wrong:** The check `Math.abs(video.currentTime - effectiveTime) < 0.01` misses frames where the current time is 0.015s off — the code seeks needlessly, adding latency.

**Fix:** Use `< FRAME_DURATION_SEC * 0.5` (0.0167s at 30fps) as the skip threshold.

---

## Environment Availability

Step 2.6: SKIPPED — This is a performance optimization for existing browser APIs. No new external dependencies.

---

## Sources

### Primary (HIGH confidence)
- [MDN VideoEncoder.configure()](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder/configure) — `hardwareAcceleration`, `latencyMode`, `bitrateMode` options and behavior
- [MDN VideoEncoder.encodeQueueSize](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder/encodeQueueSize) — backpressure management
- [Mediabunny Media Sources guide](https://mediabunny.dev/guide/media-sources) — `CanvasSource` constructor, `keyFrameInterval`, hardware acceleration options
- [Chrome for Developers: Video processing with WebCodecs](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs) — `encodeQueueSize > 2` drop pattern, worker thread architecture, frame.close() requirement
- [W3C WebCodecs spec — VideoEncoder](https://www.w3.org/TR/webcodecs/) — latencyMode semantics ("realtime mode may drop frames to meet framerate deadlines")

### Secondary (MEDIUM confidence — community reports + verified against spec)
- [w3c/webcodecs Issue #492](https://github.com/w3c/webcodecs/issues/492) — VideoEncoder performance with hardware acceleration; community benchmark showing 80fps vs 280fps (WebCodecs vs FFmpeg native at 1080p)
- [w3c/webcodecs Issue #269](https://github.com/w3c/webcodecs/issues/269) — latencyMode design intent; quality mode enables B-frames/lookahead/larger GOP
- [MDN Canvas optimization guide](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) — reuse canvas instances vs per-frame allocation
- [DEV Community: WebCodecs + OffscreenCanvas + Worker](https://dev.to/nareshipme/how-to-render-and-export-video-in-the-browser-with-webcodecs-offscreencanvas-and-a-web-worker-mm3) — worker architecture pattern, sample.close() requirement
- [Chrome Developer Blog: Improved AV1 encoding](https://developer.chrome.com/blog/av1) — AV1 speed vs VP9 tradeoffs; AV1 hardware limited to Intel Arc and newer

### Tertiary (LOW confidence — verify before acting)
- Community report (multiple sources): `prefer-hardware` on Windows may resolve to software on Intel integrated graphics; actual behavior is machine-specific
- Seek timing heuristics (20-150ms per frame for local blob URL) — based on general video decode benchmarks, not StoryGrid-specific measurement

---

## Metadata

**Confidence breakdown:**
- Hardware acceleration impact: HIGH — documented in MDN spec; mechanism is clear even if exact speedup is machine-dependent
- Canvas allocation waste: HIGH — well-documented browser behavior; reuse is the standard pattern
- Seek cost estimate: MEDIUM — depends on video codec, file size, machine; 50ms/frame is a reasonable midpoint
- Codec choice (AVC/VP9): HIGH — confirmed by MDN, Firefox bug confirmed by Bugzilla

**Research date:** 2026-04-05
**Valid until:** 2026-07-05 (Mediabunny and WebCodecs APIs stable; Firefox H.264 bug may resolve)
