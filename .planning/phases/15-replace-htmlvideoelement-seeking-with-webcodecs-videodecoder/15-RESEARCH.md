# Phase 15: Replace HTMLVideoElement seeking with WebCodecs VideoDecoder — Research

**Researched:** 2026-04-11
**Domain:** Mediabunny VideoSampleSink + WebCodecs frame decode pipeline
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use Mediabunny `VideoSampleSink` for video decoding. Pipeline: create `BlobSource` → `Input` → call `input.getPrimaryVideoTrack()` → create `VideoSampleSink(track)` → iterate `sink.samples()` async generator → collect all `VideoSample` objects into an array. Mediabunny handles codec detection, keyframe navigation, and hardware acceleration internally. Zero new dependencies.
- **D-02:** Do NOT use raw `VideoDecoder` (WebCodecs API) directly. Do NOT use `EncodedPacketSink`. Do NOT add mp4box.js. Mediabunny's own demux path is sufficient.
- **D-03:** Use `VideoSample.toCanvasImageSource()` when drawing into the stable canvas. `drawImage(sample.toCanvasImageSource(), 0, 0, 1080, 1920)` is valid on canvas 2D context.
- **D-04:** Decode videos **sequentially** (one at a time). Peak GPU memory = largest single video's decoded frames (~300–500 MB for a 24s 1080p H.264). Safe for mid-range phones and tablets.
- **D-05:** **Hold all decoded frames in memory** until the full encode loop finishes. Looping videos (shorter than `totalDuration`) reuse the same decoded `VideoSample` array without re-decoding.
- **D-06:** After the encode loop, call `.dispose()` on all `VideoSample` objects (`.close()` per Mediabunny types). This replaces `destroyExportVideoElements`.
- **D-07:** If `VideoSampleSink` or `Input` throws during decode of a specific video, propagate as a hard error. No silent fallback to seeking.
- **D-08:** Frames sorted by `sample.timestamp` (seconds) after collection. For export frame `i`, compute `loopedTimeSec = computeLoopedTime(i / FPS, videoDuration)` and find nearest frame.
- **D-09:** `computeLoopedTime()` (already in `videoExport.ts`) is reused. Works in seconds directly — no microsecond conversion needed (VideoSample.timestamp is in seconds).
- **D-10:** Extend `renderGridIntoContext` in `src/lib/export.ts` to accept `Map<string, CanvasImageSource | null>` (called `videoFrameMap` or similar) alongside or replacing `Map<string, HTMLVideoElement>`. `VideoSample.toCanvasImageSource()` returns `OffscreenCanvas | VideoFrame` — both are valid `CanvasImageSource`.
- **D-11:** Remove `HTMLVideoElement` from the `renderGridIntoContext` video parameter type once the seeking path is removed. Downstream test mocks will need updating.
- **D-12:** Add `'decoding'` stage to the progress stage union: `'preparing' | 'decoding' | 'encoding'`.
- **D-13:** During the sequential decode phase, call `onProgress('decoding', percent)` where `percent` = fraction of videos decoded so far.
- **D-14:** Update `Toast.tsx` to add `'decoding'` state with label "Decoding N%...". Update `ExportSplitButton.tsx` to pass `'decoding'` through to Toast.
- **D-15:** The `'preparing'` stage covers: VideoEncoder guard check, `BlobSource`/`Input` setup, audio setup (unchanged from Phase 14). Decoding begins after `output.start()` is called.
- **D-16:** Stable canvas pattern (D-11 from Phase 14): one persistent 1080×1920 canvas, `renderGridIntoContext` draws into it per frame, `CanvasSource` captures from it. Unchanged.
- **D-17:** VP9/Firefox codec selection (D-12 from Phase 14): VP9 on Firefox, AVC elsewhere. Unchanged.
- **D-18:** `exportVideoGrid` function signature stays unchanged. Only the `onProgress` stage union type changes.
- **D-19:** Non-fatal audio path (D-03 from Phase 14): `mixAudioForExport` + `AudioBufferSource` unchanged.

### Claude's Discretion

- Exact `CanvasImageSource` vs `VideoFrame` vs `VideoSample` type threading into `renderGridIntoContext` — pick whichever causes the least churn in existing callers and tests.
- Whether to dispose frames individually in the encode loop (close after final use) or batch-dispose after the loop — batch-dispose is simpler.
- Toast label for `'decoding'` state: color and wording (e.g., "Decoding N%..." or "Preparing frames N%...").
- Whether `Input.dispose()` should be called after `samples()` exhausts or after decode loop — follow Mediabunny docs on lifecycle.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 15 replaces the `seekAllVideosTo` bottleneck (responsible for 99.4% of video export time per timing data) with a Mediabunny `VideoSampleSink`-based pipeline. Instead of seeking `HTMLVideoElement` instances per frame (2996+ IPC round-trips for a 24s/4-video export), each video is decoded once via Mediabunny's async generator, all `VideoSample` frames are held in memory, and drawn directly from the array during the Mediabunny encode loop.

The user decided on Mediabunny `VideoSampleSink` (D-01, D-02) — NOT raw `VideoDecoder` + mp4box.js. This was confirmed viable by verifying `VideoSampleSink`, `samples()`, `VideoSample.toCanvasImageSource()`, and `VideoSample.timestamp` all exist in `node_modules/mediabunny/dist/mediabunny.d.ts`. Zero new dependencies are needed.

The change is self-contained: `buildExportVideoElements` + `seekAllVideosTo` + `destroyExportVideoElements` are deleted; replaced by `decodeVideoToSamples` + `decodeAllVideoSamples` + batch `.close()`. The render function `renderGridIntoContext` gains a new parameter type (`Map<string, CanvasImageSource | null>` instead of `Map<string, HTMLVideoElement>`). Two UI files gain a `'decoding'` stage (`Toast.tsx`, `ExportSplitButton.tsx`).

**Primary recommendation:** Three plans — (1) decode pipeline in `videoExport.ts`, (2) `renderGridIntoContext` extension in `export.ts` + type updates, (3) UI `'decoding'` stage in Toast/ExportSplitButton. Plans 1 and 2 are tightly coupled and may merge into one.

---

## Standard Stack

No new dependencies. All required APIs are already present. [VERIFIED: node_modules/mediabunny/dist/mediabunny.d.ts]

### Core APIs Confirmed in `mediabunny.d.ts`

| Class / Method | Line in .d.ts | Notes |
|----------------|---------------|-------|
| `BlobSource` | 461 | `constructor(blob: Blob, options?: BlobSourceOptions)` |
| `Input` | 1464 | `implements Disposable`; `dispose()` on line 1518; `getPrimaryVideoTrack()` on line 1500 |
| `VideoSampleSink` | 3215 | `constructor(videoTrack: InputVideoTrack)`; `samples(startTimestamp?, endTimestamp?)` async generator on line 3233 |
| `VideoSample` | 2999 | `implements Disposable`; `timestamp: number` (seconds, line 3023); `duration: number` (seconds, line 3025); `toCanvasImageSource(): OffscreenCanvas \| VideoFrame` (line 3138); `close()` (line 3070) |
| `VideoSample.draw()` | 3093 | Direct draw to `CanvasRenderingContext2D` with dx/dy/dWidth/dHeight — alternative to `toCanvasImageSource()` |

### Critical Type Observation: `VideoSample.timestamp` is in SECONDS

[VERIFIED: mediabunny.d.ts line 3020–3023] The doc comment says "presentation timestamp of the frame **in seconds**". `microsecondTimestamp` is a separate getter on line 3037. Decision D-09 was written with a note about microseconds — that note is wrong. `computeLoopedTime` works in seconds; `VideoSample.timestamp` is also in seconds. **No unit conversion is needed.** The planner must not include any `* 1_000_000` conversion in the frame lookup code.

### Supporting: `VideoSample.draw()` as Alternative to `toCanvasImageSource()`

`VideoSample` exposes a `draw(context, dx, dy, dWidth, dHeight)` method (line 3093) that handles rotation metadata automatically. The existing `drawLeafToCanvas` + friends call `ctx.drawImage(img, ...)` which requires a `CanvasImageSource`. Two valid paths exist:

- **Path A (D-03):** `drawImage(sample.toCanvasImageSource(), ...)` — requires `CanvasImageSource`, works with existing `drawCoverImage` / `drawPannedCoverImage` helpers which accept `HTMLImageElement | HTMLVideoElement | ImageBitmap`. These helpers need a union extension.
- **Path B:** Use `sample.draw(ctx, dx, dy, dW, dH)` directly inside `renderNode` — bypasses the existing helpers but uses Mediabunny's rotation-aware draw.

D-03 locks Path A. The `drawLeafToCanvas` function signature `(ctx, img: HTMLImageElement | HTMLVideoElement | ImageBitmap, ...)` and the downstream `getSourceDimensions` helper will need `CanvasImageSource` handling OR the caller passes `toCanvasImageSource()` result (a `VideoFrame` or `OffscreenCanvas`) directly — both are `CanvasImageSource` and both are drawable via `drawImage`. The planner should pick whichever causes least test churn (see Claude's Discretion).

### `Input.dispose()` Lifecycle

[VERIFIED: mediabunny.d.ts line 1510–1518] `Input.dispose()` cancels ongoing reads, closes open decoders, cancels ongoing media sink operations, and causes future operations to throw `InputDisposedError`. Call `input.dispose()` **after** the `samples()` generator is fully exhausted (generator return = done) and all `VideoSample` objects are extracted. Do NOT call it while still iterating. After `.dispose()`, the extracted `VideoSample` objects remain valid until their own `.close()` is called.

---

## Architecture Patterns

### Encode Loop Shape Change

**Current (Phase 14):**
```typescript
// One seek round-trip per frame per video = O(frames × videos) IPC calls
for (let i = 0; i < totalFrames; i++) {
  await seekAllVideosTo(i / FPS, exportVideoElements);  // bottleneck
  await renderGridIntoContext(stableCtx, root, mediaRegistry, 1080, 1920, settings, exportVideoElements, imageCache);
  await drawOverlaysToCanvas(...);
  await videoSource.add(i / FPS, 1 / FPS);
  onProgress('encoding', Math.round((i / totalFrames) * 100));
}
```

**Phase 15 target:**
```typescript
// Phase A: decode all videos sequentially, hold frames
// Source: CONTEXT.md D-04, D-05 + mediabunny.d.ts VideoSampleSink
const videoSamples = await decodeAllVideoSamples(root, mediaRegistry, mediaTypeMap, onProgress);
// Map<mediaId, VideoSample[]> — sorted by timestamp (seconds)

// Phase B: encode loop — zero seeking, array lookup only
for (let i = 0; i < totalFrames; i++) {
  const frameMap = buildFrameMapForTime(videoSamples, i / FPS, videoDurations);
  // Map<mediaId, CanvasImageSource | null>
  await renderGridIntoContext(stableCtx, root, mediaRegistry, 1080, 1920, settings, frameMap, imageCache);
  await drawOverlaysToCanvas(...);
  await videoSource.add(i / FPS, 1 / FPS);
  onProgress('encoding', Math.round((i / totalFrames) * 100));
}

// Cleanup: close all VideoSample frames
for (const samples of videoSamples.values()) {
  for (const s of samples) s.close();
}
```

### New Function: `decodeVideoToSamples`

```typescript
// Source: mediabunny.d.ts — BlobSource, Input, VideoSampleSink, samples()
async function decodeVideoToSamples(blobUrl: string): Promise<VideoSample[]> {
  const blob = await fetch(blobUrl).then(r => r.blob());
  const source = new BlobSource(blob);
  const input = new Input({ source });

  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return [];

    const sink = new VideoSampleSink(track);
    const samples: VideoSample[] = [];

    for await (const sample of sink.samples()) {
      samples.push(sample);
    }

    // Sort by timestamp (seconds) — Mediabunny delivers in decode order;
    // presentation order requires sorting by timestamp.
    samples.sort((a, b) => a.timestamp - b.timestamp);
    return samples;
  } finally {
    input.dispose(); // Cancel pending reads, close decoders
  }
}
```

### New Function: `decodeAllVideoSamples` (orchestrator)

```typescript
// Sequential decode per D-04. Progress via onProgress('decoding', percent).
async function decodeAllVideoSamples(
  root: GridNode,
  mediaRegistry: Record<string, string>,
  mediaTypeMap: Record<string, 'image' | 'video'>,
  onProgress: (stage: 'preparing' | 'decoding' | 'encoding', percent?: number) => void,
): Promise<Map<string, VideoSample[]>> {
  const result = new Map<string, VideoSample[]>();
  const videoMediaIds = collectUniqueVideoMediaIds(root, mediaRegistry, mediaTypeMap);
  let decoded = 0;

  for (const mediaId of videoMediaIds) {
    const blobUrl = mediaRegistry[mediaId];
    const samples = await decodeVideoToSamples(blobUrl);
    result.set(mediaId, samples);
    decoded++;
    onProgress('decoding', Math.round((decoded / videoMediaIds.size) * 100));
  }

  return result;
}
```

### Frame Lookup: `findSampleForTime`

```typescript
// VideoSample.timestamp is in SECONDS [VERIFIED: mediabunny.d.ts line 3023]
// computeLoopedTime returns seconds — no unit conversion needed [VERIFIED]
function findSampleForTime(
  samples: VideoSample[],
  exportTimeSeconds: number,
  videoDurationSeconds: number,
): VideoSample | null {
  if (samples.length === 0) return null;
  const loopedTime = computeLoopedTime(exportTimeSeconds, videoDurationSeconds);
  // Binary search or linear scan — frames are sorted ascending by timestamp
  // Find last sample with timestamp <= loopedTime
  let best = samples[0];
  for (const s of samples) {
    if (s.timestamp <= loopedTime) best = s;
    else break;
  }
  return best;
}
```

**Note on `videoDurationSeconds`:** Each decoded video's duration must be known for the looping computation. Options:
- Read `samples[samples.length - 1].timestamp + samples[samples.length - 1].duration` after decode
- Call `input.computeDuration()` before dispose [VERIFIED: mediabunny.d.ts line 1487]

Either approach works. The planner should decide at plan time.

### `renderGridIntoContext` Extension

Current signature (export.ts line 446–455):
```typescript
export async function renderGridIntoContext(
  ctx: CanvasRenderingContext2D,
  root: GridNode,
  mediaRegistry: Record<string, string>,
  width: number,
  height: number,
  settings: CanvasSettings = DEFAULT_CANVAS_SETTINGS,
  videoElements?: Map<string, HTMLVideoElement>,  // ← CHANGE THIS
  imageCache?: Map<string, HTMLImageElement>,
): Promise<void>
```

Target (per D-10, D-11):
```typescript
export async function renderGridIntoContext(
  ctx: CanvasRenderingContext2D,
  root: GridNode,
  mediaRegistry: Record<string, string>,
  width: number,
  height: number,
  settings: CanvasSettings = DEFAULT_CANVAS_SETTINGS,
  videoFrameMap?: Map<string, CanvasImageSource | null>,  // replaces videoElements
  imageCache?: Map<string, HTMLImageElement>,
): Promise<void>
```

`renderNode` (export.ts line 369) checks `videoElements?.has(leaf.mediaId)` and draws via `drawLeafToCanvas(ctx, video, rect, leaf)` where `video: HTMLVideoElement`. With Phase 15, the video parameter becomes `CanvasImageSource`. The `drawLeafToCanvas` signature accepts `HTMLImageElement | HTMLVideoElement | ImageBitmap` — this needs extending to also accept `VideoFrame | OffscreenCanvas` (both are `CanvasImageSource`).

**Minimal change strategy:** Since `drawImage(canvasImageSource, ...)` is valid natively, the caller can pass `sample.toCanvasImageSource()` directly. However `getSourceDimensions` (export.ts line 114) needs to handle `OffscreenCanvas` and `VideoFrame` to compute aspect ratios for cover/contain math. The planner must address this.

### `getSourceDimensions` Extension

Current:
```typescript
export function getSourceDimensions(
  src: HTMLImageElement | HTMLVideoElement | ImageBitmap,
): { w: number; h: number }
```

`VideoFrame` has `.displayWidth` / `.displayHeight`. `OffscreenCanvas` has `.width` / `.height`. The function needs a branch for each. Pattern:

```typescript
// For VideoFrame (WebCodecs)
if (typeof VideoFrame !== 'undefined' && src instanceof VideoFrame) {
  return { w: src.displayWidth, h: src.displayHeight };
}
// For OffscreenCanvas
if (typeof OffscreenCanvas !== 'undefined' && src instanceof OffscreenCanvas) {
  return { w: src.width, h: src.height };
}
```

### Encode Loop Positioning (D-15)

D-15 says decoding begins after `output.start()`. Current code calls `output.start()` once before the encode loop. Phase 15 inserts the decode phase **between** `output.start()` and the encode loop — the `onProgress('decoding', ...)` calls happen inside the `decodeAllVideoSamples` orchestrator, and `onProgress('encoding', 0)` is called at the start of the encode loop (same as now).

### Toast + ExportSplitButton Changes

**Toast.tsx** — Add branch for `'decoding'` state. Current `ToastState` union (line 7):
```typescript
export type ToastState = 'preparing' | 'exporting' | 'error' | 'encoding' | 'audio-warning' | null;
```
Becomes:
```typescript
export type ToastState = 'preparing' | 'decoding' | 'exporting' | 'error' | 'encoding' | 'audio-warning' | null;
```
Toast renders "Decoding N%..." with a spinner (same amber or blue as `'encoding'` — Claude's discretion).

**ExportSplitButton.tsx** — The `onProgress` callback currently has two branches (`'preparing'` and `else`). Add a `'decoding'` branch that sets `toastState('decoding')` and `setEncodingPercent(percent ?? 0)`. The existing `'encoding'` branch is unchanged. The `encodingPercent` state variable serves both — rename not required but acceptable.

**`exportVideoGrid` signature** (D-18) — only the `onProgress` parameter's stage union type changes:
```typescript
// Before:
onProgress: (stage: 'preparing' | 'encoding', percent?: number) => void
// After:
onProgress: (stage: 'preparing' | 'decoding' | 'encoding', percent?: number) => void
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video container demux (MP4/WebM) | Custom byte parser | `Mediabunny BlobSource + Input + VideoSampleSink` | Mediabunny handles codec detection, keyframe navigation, HW acceleration — already installed |
| Codec-specific frame decoding | Raw `VideoDecoder` + mp4box.js avcC extraction | `VideoSampleSink.samples()` | D-02 locks this; Mediabunny wraps all of it |
| Frame-to-timestamp nearest-neighbor | Complex binary search | Sort `VideoSample[]` by `.timestamp`, linear scan backward | Frames are sorted; O(n) scan is fine for 720 frames |
| Memory cleanup | Custom reference counting | `VideoSample.close()` | Standard Mediabunny lifecycle method |
| `Input` cleanup | Null-check soup | `input.dispose()` in `finally` block | `Input` is `Disposable`; dispose after generator exhausts |

---

## Common Pitfalls

### Pitfall 1: `VideoSample.timestamp` Unit Confusion

**What goes wrong:** Code multiplies `VideoSample.timestamp` by 1,000,000 expecting microseconds, producing wildly wrong frame lookups (frame 0 matches frame ~1,000,000 seconds into a nonexistent video).

**Why it happens:** The CONTEXT.md D-09 incorrectly notes "microseconds"; the option-2 doc mentions microseconds. However, the type definition is authoritative.

**How to avoid:** [VERIFIED: mediabunny.d.ts line 3020–3023] `VideoSample.timestamp` is in **seconds**. `computeLoopedTime` returns seconds. No conversion. Only `VideoSample.microsecondTimestamp` (getter, line 3037) is in microseconds.

**Warning signs:** Frame lookup always returns the first or last frame regardless of position in the video.

### Pitfall 2: `toCanvasImageSource()` Result is Transient

**What goes wrong:** Code stores the `CanvasImageSource` returned by `toCanvasImageSource()` across microtasks, then tries to draw it — it may already be closed.

**Why it happens:** [VERIFIED: mediabunny.d.ts line 3132–3136] The JSDoc comment says: "You must use the value returned by this method immediately, as any VideoFrame created internally will automatically be closed in the next microtask."

**How to avoid:** Call `sample.toCanvasImageSource()` directly inside `drawImage(sample.toCanvasImageSource(), ...)` without storing in an intermediate variable. Never cache the returned `CanvasImageSource`.

### Pitfall 3: Calling `Input.dispose()` Before Generator Exhausts

**What goes wrong:** `input.dispose()` cancels ongoing reads mid-generator, causing the `for await` loop to throw `InputDisposedError`.

**Why it happens:** [VERIFIED: mediabunny.d.ts line 1510–1518] `dispose()` cancels all ongoing operations immediately.

**How to avoid:** Call `input.dispose()` in a `finally` block AFTER the `for await (const sample of sink.samples())` loop completes (generator done). The `finally` block guarantees cleanup even if the loop throws.

### Pitfall 4: Tests Still Import `buildExportVideoElements`

**What goes wrong:** `src/test/videoExport-audio.test.ts` imports `buildExportVideoElements` directly (line 4). After Phase 15 removes this function, the test file fails to compile.

**Why it happens:** Tests directly import the removed function by name.

**How to avoid:** The planner must include a task to update `videoExport-audio.test.ts`. The tests for `buildExportVideoElements` behavior (muted/unmuted per audioEnabled) are no longer applicable — replace with tests for the decode pipeline helpers (`decodeVideoToSamples`, `decodeAllVideoSamples`), or remove if testing via integration-level mocks.

### Pitfall 5: `getSourceDimensions` Does Not Handle `VideoFrame` or `OffscreenCanvas`

**What goes wrong:** Cover/contain aspect ratio math in `drawCoverImage`, `drawPannedCoverImage`, etc. calls `getSourceDimensions(img)` which does `instanceof HTMLVideoElement` and `instanceof ImageBitmap` checks — returns 0×0 for `VideoFrame` / `OffscreenCanvas`.

**Why it happens:** `getSourceDimensions` (export.ts line 114) was written for `HTMLImageElement | HTMLVideoElement | ImageBitmap` only.

**How to avoid:** Extend `getSourceDimensions` to handle `VideoFrame` (use `.displayWidth` / `.displayHeight`) and `OffscreenCanvas` (use `.width` / `.height`) before Phase 15 goes live. Guard with `typeof` checks for jsdom compatibility.

### Pitfall 6: Sequential Decode Placement Before or After `output.start()`

**What goes wrong:** Decode runs before `output.start()`, then `CanvasSource` captures frames before the muxer is ready.

**Why it happens:** D-15 specifies that decode runs "after `output.start()` is called". The current code has `output.start()` before the frame loop. Decode goes between `output.start()` and the frame loop.

**How to avoid:** Sequence: `output.addVideoTrack` → `output.addAudioTrack` (if audio) → `output.start()` → `decodeAllVideoSamples(...)` (Phase A) → frame encode loop (Phase B) → audio mix → `output.finalize()`.

### Pitfall 7: Frame Sort Order — Decode Order vs Presentation Order

**What goes wrong:** Mediabunny `samples()` delivers in decode order (not necessarily presentation order for H.264 with B-frames). Using unsorted array produces wrong frame at each timestamp.

**Why it happens:** H.264 can have B-frames; decode order ≠ display order. CONTEXT.md D-08 explicitly calls this out.

**How to avoid:** After collecting all `VideoSample` objects, sort by `sample.timestamp` ascending before any lookup. A single `samples.sort((a, b) => a.timestamp - b.timestamp)` call is sufficient.

### Pitfall 8: `renderGridToCanvas` Still References `HTMLVideoElement`

**What goes wrong:** `renderGridToCanvas` (export.ts line 483) calls `renderGridIntoContext` and passes `videoElements?: Map<string, HTMLVideoElement>`. After D-11 removes `HTMLVideoElement` from the signature, this callsite must also be updated.

**Why it happens:** `renderGridToCanvas` is used for the live preview render path, not video export. It currently accepts `videoElements` for the preview case. With Phase 15, it should accept the new `Map<string, CanvasImageSource | null>` type too, or the preview path still uses `HTMLVideoElement` (the UI still has live video elements for preview).

**How to avoid:** The planner must decide whether to change `renderGridToCanvas` signature too (clean) or keep the two functions with different parameter types (safe). The preview path (`LeafNode` rendering) still uses live `HTMLVideoElement` elements from `videoElementRegistry`. Only the export path switches to `VideoSample`. Consider an overloaded or union parameter type.

---

## Code Examples

### Full `decodeVideoToSamples` with Correct Lifecycle

```typescript
// Source: mediabunny.d.ts BlobSource (461), Input (1464), VideoSampleSink (3215)
async function decodeVideoToSamples(blobUrl: string): Promise<VideoSample[]> {
  // Fetch blob — needed because BlobSource takes a Blob, not a URL string
  const response = await fetch(blobUrl);
  const blob = await response.blob();

  const source = new BlobSource(blob);
  const input = new Input({ source });

  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return [];

    const sink = new VideoSampleSink(track);
    const samples: VideoSample[] = [];

    // sink.samples() is an async generator yielding VideoSample objects
    // Delivers in decode order — sort by timestamp afterward
    for await (const sample of sink.samples()) {
      samples.push(sample);
    }

    // Sort by presentation timestamp (seconds) — D-08
    // VideoSample.timestamp is in seconds [VERIFIED: mediabunny.d.ts line 3023]
    samples.sort((a, b) => a.timestamp - b.timestamp);
    return samples;
  } finally {
    // dispose() cancels pending reads; safe to call after generator exhausts
    // [VERIFIED: mediabunny.d.ts line 1518]
    input.dispose();
  }
}
```

### Frame Lookup with `computeLoopedTime`

```typescript
// Source: src/lib/videoExport.ts computeLoopedTime + mediabunny.d.ts VideoSample
function findSampleForTime(
  samples: VideoSample[],
  exportTimeSeconds: number,
  videoDurationSeconds: number,
): VideoSample | null {
  if (samples.length === 0) return null;

  // computeLoopedTime handles modulo + edge cases (0/NaN/Infinity)
  // Returns seconds — VideoSample.timestamp is also seconds
  const loopedTime = computeLoopedTime(exportTimeSeconds, videoDurationSeconds);

  // Find last sample with timestamp <= loopedTime (presentation-ordered array)
  let best = samples[0];
  for (const s of samples) {
    if (s.timestamp <= loopedTime) {
      best = s;
    } else {
      break; // Array is sorted; no need to continue
    }
  }
  return best;
}
```

### `toCanvasImageSource()` Usage — Must Be Immediate

```typescript
// Source: mediabunny.d.ts line 3132–3138
// DO: use inline, do not store
ctx.drawImage(sample.toCanvasImageSource(), sx, sy, sw, sh, dx, dy, dw, dh);

// DON'T: store intermediate result across microtasks
const source = sample.toCanvasImageSource(); // may be auto-closed before next use
await someAsyncOp();
ctx.drawImage(source, ...); // BROKEN — VideoFrame may be closed
```

### `getSourceDimensions` Extension

```typescript
// Extension to handle VideoFrame and OffscreenCanvas from VideoSample.toCanvasImageSource()
export function getSourceDimensions(
  src: HTMLImageElement | HTMLVideoElement | ImageBitmap | VideoFrame | OffscreenCanvas,
): { w: number; h: number } {
  if (src instanceof HTMLVideoElement) {
    return { w: src.videoWidth, h: src.videoHeight };
  }
  if (typeof VideoFrame !== 'undefined' && src instanceof VideoFrame) {
    return { w: src.displayWidth, h: src.displayHeight };
  }
  if (typeof OffscreenCanvas !== 'undefined' && src instanceof OffscreenCanvas) {
    return { w: src.width, h: src.height };
  }
  if (typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap) {
    return { w: src.width, h: src.height };
  }
  return { w: (src as HTMLImageElement).naturalWidth, h: (src as HTMLImageElement).naturalHeight };
}
```

### Toast `'decoding'` Branch (amber styling matches `'audio-warning'`)

```typescript
// Suggested: use same blue as 'encoding' for visual consistency
if (state === 'decoding') {
  return (
    <div className={containerClass} role="status">
      <Loader2 size={14} className="animate-spin text-neutral-400" />
      <span>Decoding {encodingPercent ?? 0}%...</span>
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `HTMLVideoElement.currentTime = t` | `VideoSampleSink.samples()` async generator | Phase 15 | Eliminates ~2996 IPC round-trips for a 24s/4-video export |
| Seeking + `seeked` event per frame | Decode-once + array lookup | Phase 15 | ~185s → ~10–25s estimated export time |
| `Map<string, HTMLVideoElement>` in `renderGridIntoContext` | `Map<string, CanvasImageSource \| null>` | Phase 15 | Decouples render from live DOM elements |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `fetch(blobUrl).then(r => r.blob())` works for local blob URLs in export context | Code Examples | If fetch rejects local blob URLs (CORS), use `mediaRegistry[mediaId]` with `URL.createObjectURL` already in hand as a blob URL — should be fine since blob URLs are same-origin. LOW risk. | [ASSUMED] |
| A2 | `VideoSampleSink.samples()` delivers all frames without time-range truncation when called with no arguments | Architecture Patterns | If only a subset is returned (e.g., only first GOP), the decode would be incomplete. The type signature `samples(startTimestamp?, endTimestamp?)` suggests no-arg call = full track. LOW risk. | [ASSUMED] |
| A3 | Sequential decode of 4 × 24s 1080p H.264 videos stays within browser GPU/memory limits | Architecture | OOM on very low-end devices is possible; D-04 (sequential) mitigates the parallel-decode worst case. MEDIUM risk for low-memory devices. | [ASSUMED] |

---

## Open Questions

1. **`renderGridToCanvas` live preview path**
   - What we know: `renderGridToCanvas` is used by the static PNG export path (`exportGrid`). It already passes `videoElements?: Map<string, HTMLVideoElement>` to `renderGridIntoContext`.
   - What's unclear: After D-11 removes `HTMLVideoElement` from `renderGridIntoContext`, does the live preview call path (`LeafNode` canvas rendering via `useGridStore.subscribe`) still use `HTMLVideoElement`? The live preview is NOT in scope for this phase.
   - Recommendation: The planner should change `renderGridIntoContext`'s `videoElements` parameter to a union type `Map<string, HTMLVideoElement | CanvasImageSource | null>`, OR add a second overload, OR change the parameter name to `videoFrameMap` with `CanvasImageSource | null` and update `renderGridToCanvas` and `LeafNode` callers to pass `HTMLVideoElement` as `CanvasImageSource` (since `HTMLVideoElement` IS a `CanvasImageSource`).

2. **Video duration for `computeLoopedTime` in Phase B**
   - What we know: `computeLoopedTime(exportTimeSeconds, videoDurationSeconds)` requires the video's duration in seconds.
   - What's unclear: Where is duration obtained after Phase 15? Options: (a) `input.computeDuration()` before dispose, (b) `samples[last].timestamp + samples[last].duration`, (c) read from existing `useEditorStore` metadata.
   - Recommendation: Option (b) is zero-overhead (data already in the decoded array). Store duration alongside the samples array: `Map<mediaId, { samples: VideoSample[], duration: number }>`.

3. **Tests for removed `buildExportVideoElements`**
   - What we know: `src/test/videoExport-audio.test.ts` has a `describe('buildExportVideoElements — conditional muted')` block importing the now-deleted function.
   - What's unclear: Replace the deleted tests with decode-path tests, or delete them entirely?
   - Recommendation: Replace with tests for `decodeVideoToSamples` behavior (empty return for no-video, error propagation per D-07) using jsdom mocks for Mediabunny. The `hasAudioEnabledVideoLeaf` tests in the same file remain valid and unchanged.

---

## Environment Availability

Step 2.6 SKIPPED — Phase 15 is a pure code change. No external CLIs, services, or runtimes beyond the existing Mediabunny package (already installed) and WebCodecs (already in browser, already guarded by the `VideoEncoder` check in `exportVideoGrid`).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (config in vite.config.ts) |
| Config file | vite.config.ts (existing) |
| Quick run command | `npx vitest run src/test/videoExport-loop.test.ts src/test/videoExport-audio.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Behavior | Test Type | Automated Command | Existing? |
|----------|-----------|-------------------|-----------|
| `computeLoopedTime` still works correctly (seconds, no unit change) | unit | `npx vitest run src/test/videoExport-loop.test.ts` | Yes — existing tests unchanged |
| `decodeVideoToSamples` returns empty array when no video track | unit | `npx vitest run src/test/videoExport-audio.test.ts` | No — Wave 0 gap |
| `decodeVideoToSamples` sorts frames by timestamp ascending | unit | `npx vitest run src/test/videoExport-audio.test.ts` | No — Wave 0 gap |
| `findSampleForTime` returns correct frame for looped time | unit | `npx vitest run src/test/videoExport-audio.test.ts` | No — Wave 0 gap |
| `hasAudioEnabledVideoLeaf` unchanged | unit | `npx vitest run src/test/videoExport-audio.test.ts` | Yes — existing tests unchanged |
| Toast renders `'decoding'` state with spinner | unit | `npx vitest run` | No — Wave 0 gap (lightweight) |
| `getSourceDimensions` handles `VideoFrame` and `OffscreenCanvas` | unit | `npx vitest run src/test/canvas-export.test.ts` | No — Wave 0 gap |
| `renderGridIntoContext` draws from `Map<string, CanvasImageSource>` | unit | `npx vitest run src/test/canvas-export.test.ts` | No — Wave 0 gap |
| `exportVideoGrid` signature unchanged (compile check) | static | `npx tsc --noEmit` | Via CI |

### Sampling Rate

- **Per task commit:** `npx vitest run src/test/videoExport-loop.test.ts src/test/videoExport-audio.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] Update `src/test/videoExport-audio.test.ts` — remove `buildExportVideoElements` imports; add mock-based tests for `decodeVideoToSamples`, `findSampleForTime` (mock `BlobSource`, `Input`, `VideoSampleSink`)
- [ ] `src/test/canvas-export.test.ts` — add `getSourceDimensions` tests for `VideoFrame` / `OffscreenCanvas` inputs (use mock objects with `displayWidth`/`displayHeight`/`width`/`height`)
- [ ] Toast rendering test for `'decoding'` state (minimal — render `<Toast state="decoding" encodingPercent={42} />`, assert text "Decoding 42%")

*(All existing test files pass without modification — only removed functions break imports in Wave 0.)*

---

## Security Domain

Not applicable. This phase processes client-side blob URLs that were uploaded by the user in the same session. No external URLs, no authentication, no user data leaves the browser. `security_enforcement` not set to false but there are no ASVS-relevant changes.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/mediabunny/dist/mediabunny.d.ts` — Confirmed all APIs: `BlobSource` (461), `Input` / `dispose()` (1464–1518), `VideoSampleSink` / `samples()` (3215–3243), `VideoSample.timestamp` in seconds (3023), `VideoSample.toCanvasImageSource()` (3138), `VideoSample.close()` (3070), `VideoSample.draw()` (3093)
- `src/lib/videoExport.ts` — Confirmed current pipeline shape, `computeLoopedTime` (seconds), `seekAllVideosTo`, `buildExportVideoElements`, `destroyExportVideoElements`, `exportVideoGrid` signature
- `src/lib/export.ts` — Confirmed `renderGridIntoContext` signature, `getSourceDimensions`, `drawLeafToCanvas` type signatures
- `src/Editor/Toast.tsx` — Confirmed current `ToastState` union and rendering branches
- `src/Editor/ExportSplitButton.tsx` — Confirmed `onProgress` handler shape and `'preparing'`/`else` branch structure
- `src/test/videoExport-audio.test.ts` — Confirmed `buildExportVideoElements` imported directly; will break at Phase 15
- `.planning/phases/15-replace-htmlvideoelement-seeking-with-webcodecs-videodecoder/15-CONTEXT.md` — Locked decisions D-01 through D-19

### Secondary (MEDIUM confidence)
- `.planning/phase-15-option2-webcodecs-videodecoder.md` — Background analysis: root cause (IPC round-trips), performance expectations, mp4box.js fallback (not needed)
- `.planning/phase-15-option1-rVFC-playforward.md` — Not chosen, read for context only

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all APIs verified directly in installed `mediabunny.d.ts`
- Architecture: HIGH — current code read directly, new structure derived from verified APIs and locked decisions
- Pitfalls: HIGH — Pitfalls 1–4 verified against type definitions; Pitfalls 5–8 verified against current codebase
- Unit conversion (timestamps in seconds not microseconds): HIGH — verified against authoritative .d.ts, contradicts CONTEXT.md D-09 note

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (Mediabunny API is stable; no ecosystem churn expected)
