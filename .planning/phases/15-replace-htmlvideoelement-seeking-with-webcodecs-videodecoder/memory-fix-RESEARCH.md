# Phase 15: Memory-Efficient Video Decode — Research

**Researched:** 2026-04-11
**Domain:** Mediabunny VideoSampleSink memory patterns, WebCodecs backpressure, browser frame lifecycle
**Confidence:** HIGH (Mediabunny API verified from node_modules source; WebCodecs patterns from W3C + webrtcHacks)

---

## Problem Statement

The current `decodeVideoToSamples` implementation pre-decodes ALL frames from ALL videos into
`ImageBitmap` objects held simultaneously:

- Per frame at 1080×1920 RGBA: 1080 × 1920 × 4 = **7.9 MB**
- 4 videos × 30fps × 10s = 1200 frames = **9.3 GB** total (current worst case)
- Even for a single video at 10s: 300 × 7.9 MB = **2.4 GB** per video

The CONTEXT.md D-04/D-05 approach (sequential decode, hold all frames in memory) addresses
the simultaneous-all-4-videos problem but still accumulates 2.4 GB per video before starting
encode. This freezes mid-range devices.

---

## Q1: Mediabunny Streaming API — getSample and samplesAtTimestamps

### Findings

**`getSample(timestamp: number): Promise<VideoSample | null>`** [VERIFIED: mediabunny.d.ts line 3225]

Each `getSample` call internally creates a fresh `mediaSamplesAtTimestamps([timestamp])` generator.
Looking at the source [VERIFIED: node_modules/mediabunny/src/media-sink.ts line 1426-1432]:

```typescript
async getSample(timestamp: number) {
    validateTimestamp(timestamp);
    for await (const sample of this.mediaSamplesAtTimestamps([timestamp])) {
        return sample;
    }
    throw new Error('Internal error: Iterator returned nothing.');
}
```

Each `getSample` call:
1. Creates a new decoder (via `_createDecoder`)
2. Seeks to the nearest keyframe before `timestamp`
3. Decodes forward from that keyframe until the target frame
4. Returns the single decoded frame
5. The generator's `return()` closes the decoder

**Cost:** O(GOP size) decode work per call. For a 30fps H.264 video with default GOP=30 (1s),
each `getSample` call decodes up to 30 frames to retrieve 1. For a 300-frame video queried at
every export frame timestamp, that is O(300 × GOP_size) = O(9000) frame decodes for what should
be 300 frames.

**Verdict:** `getSample` is suitable for thumbnail generation (sparse, low-frequency access).
It is NOT suitable for export loops (30fps sequential access). Using it would be slower than the
current seek-based pipeline it replaced.

---

**`samplesAtTimestamps(timestamps: AnyIterable<number>)`** [VERIFIED: mediabunny.d.ts line 3242]

This method uses a **single decoder** for the full timestamp sequence. The optimization in the
source [VERIFIED: media-sink.ts line 724-733]:

```typescript
// Check if the key packet has changed or if we're going back in time
if (lastPacket && (
    keyPacket.sequenceNumber !== lastKeyPacket!.sequenceNumber
    || targetPacket.timestamp < lastPacket.timestamp
)) {
    await decodePackets();
    await flushDecoder(); // Only re-seeks if new GOP or backwards jump
}
```

When timestamps are **monotonically increasing** (which they are in a 30fps export loop), the
decoder runs forward continuously — no re-seeks, no extra decode work. Each packet is decoded
exactly once.

**Key constraint:** The `timestamps` parameter is `AnyIterable<number>`, including
`AsyncGenerator<number>`. This means you can pass an async generator that yields timestamps
**lazily** — one per encode frame. This creates a streaming pipeline:

```
async generator yields timestamp T
    → sink decodes up to frame T
    → yields VideoSample for T
    → encode loop draws frame, calls videoSource.add()
    → generator yields T + 1/30
    → (repeat)
```

**Memory at steady state:** Only the frames currently in `sampleQueue` (internal to the sink,
max 8 when decoded samples exist — see `computeMaxQueueSize` below) plus 1 frame actively drawn.

**`computeMaxQueueSize` internal backpressure** [VERIFIED: media-sink.ts line 810-815]:

```typescript
const computeMaxQueueSize = (decodedSampleQueueSize: number) => {
    // If we have decoded samples lying around, limit total queue to small value
    return decodedSampleQueueSize === 0 ? 40 : 8;
};
```

When decoded samples exist in the queue, the decoder stops accepting new packets until the
queue drains to below 8 entries. This is automatic backpressure — the sink holds at most ~8
decoded frames in flight at any time, regardless of how long the video is.

**Memory for `samplesAtTimestamps` streaming:** ~8 frames × 7.9 MB = **63 MB** maximum in the
sink queue, regardless of video length.

---

**`samples(startTimestamp?, endTimestamp?)`** [VERIFIED: mediabunny.d.ts line 3233]

Pre-decodes a few frames ahead via `mediaSamplesInRange`. Suitable for sequential scan of an
entire video. Also uses a single decoder and runs forward. The queue is also bounded by
`computeMaxQueueSize`.

However, `samples()` requires the **caller to close each `VideoSample` before yielding the
next** to stay within the internal queue bound. The current implementation converts each
`VideoSample` → `ImageBitmap` and closes immediately — which is correct for this approach.

---

### Summary for Q1

| Method | Memory Peak | Re-seeks | Use Case |
|--------|-------------|----------|----------|
| `getSample` | ~1 frame | Every call (GOP seek) | Thumbnails, sparse access |
| `samples()` | ~8 frames in sink + caller's frames | None (forward scan) | Pre-decode all frames |
| `samplesAtTimestamps(asyncGen)` | ~8 frames in sink | Only on backwards jump | **Streaming encode loop** |

**Recommendation: `samplesAtTimestamps` with a lazy async timestamp generator is the ideal
API for a memory-bounded streaming encode loop.**

---

## Q2: Mediabunny Examples and Community Patterns

[CITED: https://mediabunny.dev/examples]

Official examples: metadata extraction, thumbnail generation, file compression, procedural video
generation, live recording, advanced media player. No example specifically shows memory-bounded
streaming encode.

The documentation confirms [CITED: https://mediabunny.dev/guide/reading-media-files]:

> "Files are always read partially ('lazily'), meaning only the bytes required to extract the
> requested information will be read, keeping performance high and memory usage low."

The `BlobSource` default cache is 8 MiB [CITED: mediabunny docs]. The demuxer streams — it does
not buffer the entire video blob in memory. Only decoded frames hold significant memory.

**No official example shows a streaming encode loop with `samplesAtTimestamps`.** This pattern
is inferred from API documentation and source code analysis.

---

## Q3: Web Worker Support

**Does Mediabunny work inside a Web Worker?**

[VERIFIED: node_modules/mediabunny/src/media-sink.ts line 1240-1244]

```typescript
if (typeof OffscreenCanvas !== 'undefined') {
    // Prefer OffscreenCanvas for Worker environments
    this.canvas = new OffscreenCanvas(300, 150);
} else {
    this.canvas = document.createElement('canvas');
}
```

[VERIFIED: node_modules/mediabunny/src/media-sink.ts line 1642-1648]

```typescript
if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
} else {
    canvas = new OffscreenCanvas(this._width, this._height);
}
```

Mediabunny internally detects Worker vs DOM context and uses `OffscreenCanvas` when `document`
is unavailable. The `BlobSource`, `Input`, `VideoSampleSink`, and all decode operations use only
Web APIs available in Workers (`Blob`, `fetch`, `WebCodecs VideoDecoder`, `OffscreenCanvas`).

**`BlobSource` + `Input` + `VideoSampleSink` are all Worker-compatible.** [VERIFIED: source]

**`CanvasSource` requires an `HTMLCanvasElement` or `OffscreenCanvas`** — `OffscreenCanvas` is
supported in Workers (Chrome 69+, Firefox 105+, Safari 17+). [CITED: MDN OffscreenCanvas]

**Caveat: `CanvasSource` is currently used on the main thread (stable canvas pattern, D-16).**
To move encoding to a Worker, the stable canvas would need to be an `OffscreenCanvas` created
via `canvas.transferControlToOffscreen()`. This is a significant architecture change — out of
scope for the current memory fix.

**Conclusion:** Decode (`BlobSource` + `Input` + `VideoSampleSink`) can run in a Worker.
Encode (`CanvasSource` + `Output` + drawing to canvas) is harder because it requires
`OffscreenCanvas` coordination with the main thread renderer. Worker-based decode is feasible
but a separate scope of work.

---

## Q4: Frame Eviction / LRU Cache

For a forward-sequential encode loop (the actual use case), an LRU cache is not needed — a
**simple 1-frame ring buffer per video** is sufficient:

- At export frame `i`, for each video, we need the sample nearest to `computeLoopedTime(i/FPS, duration)`
- Because looped time is monotonically increasing (within one video loop), frames are always
  accessed in order
- Once frame `j` has been drawn, frame `j-1` will never be needed again (until the loop restarts)

**LRU is only useful for looping videos with short durations**, where the encode loop cycles
back to the beginning. In that case: cache the entire short video (100 frames × 7.9 MB = 790 MB
for a 10s loop). That's the current D-05 approach and is only safe if the single video fits.

**For streaming, use `samplesAtTimestamps` instead of a cache** — the sink's internal queue
already acts as a small look-ahead buffer (up to 8 frames).

---

## Q5: Downscale During Decode

**`VideoSampleSink` does NOT support downscaling.** [VERIFIED: mediabunny.d.ts — no width/height options in VideoSampleSink constructor]

**`CanvasSink` DOES support downscaling via `width`/`height` options** [VERIFIED: mediabunny.d.ts line 585-628]:

```typescript
type CanvasSinkOptions = {
    width?: number;   // Output canvas width in pixels
    height?: number;  // Output canvas height in pixels
    fit?: 'fill' | 'contain' | 'cover';
    poolSize?: number;
};
```

`CanvasSink` returns `WrappedCanvas` (HTMLCanvasElement or OffscreenCanvas), not `VideoSample`.
It can downscale (e.g., to 540×960) during decode. However, since our export writes to a
1080×1920 stable canvas via `renderGridIntoContext`, we need full-resolution frames for the
final output. Downscaling decode would reduce fidelity.

**Alternative: CPU-side resize with `createImageBitmap` options.**

`createImageBitmap` accepts `{ resizeWidth, resizeHeight, resizeQuality }`. This can convert
a full-resolution `VideoFrame` into a half-resolution `ImageBitmap` during decode:

```typescript
const bitmap = await createImageBitmap(videoFrame, {
    resizeWidth: 540,
    resizeHeight: 960,
    resizeQuality: 'medium',
});
```

Memory: 540 × 960 × 4 = 2 MB per frame vs 7.9 MB. For a 300-frame video: **600 MB vs 2.4 GB**.

However, the encoder draws the bitmap onto the 1080×1920 stable canvas — the canvas 2D
`drawImage` upscales at draw time. Upscaling quality depends on `ctx.imageSmoothingQuality`.
For export-quality video, this is a lossy tradeoff.

**Verdict:** Downscaling is technically feasible but reduces quality. Only appropriate as a
memory-pressure fallback, not as the primary approach.

---

## Q6: General WebCodecs Memory Patterns

[CITED: https://webrtchacks.com/real-time-video-processing-with-webcodecs-and-streams-processing-pipelines-part-1/]

> "1 second of full HD video at 25 frames per second happily takes 200MB of memory once decoded."

Confirmed: 25fps × 200MB = 8 MB/frame — matches our 7.9 MB calculation.

**Industry standard pattern for bounded-memory streaming decode:**

```typescript
// Throttle decoder input based on queue depth
while (decoder.decodeQueueSize >= 20) {
    await new Promise(r => setTimeout(r, 10));
}
decoder.decode(encodedChunk);
```

[CITED: https://webcodecsfundamentals.org/patterns/transcoding/]

```typescript
// backpressure via decodeQueueSize
while (decoder.decodeQueueSize >= 20) {
    await new Promise((r) => setTimeout(r, 10));
}
```

**Mediabunny already implements this internally** [VERIFIED: media-sink.ts line 672-676]:

```typescript
while (sampleQueue.length + decoder.getDecodeQueueSize() > maxQueueSize && !terminated) {
    ({ promise: queueDequeue, resolve: onQueueDequeue } = promiseWithResolvers());
    await queueDequeue;
}
```

Callers using `samplesAtTimestamps` get this backpressure for free — the generator's `next()`
call blocks until the decode queue drains to acceptable levels.

**Decode-only memory profile for streaming (vs pre-decode):**

| Strategy | Peak RAM (4 videos × 10s × 30fps) | Notes |
|----------|-----------------------------------|-------|
| Pre-decode all (current D-05) | 9.3 GB | Causes OS freeze |
| Sequential pre-decode (D-04+D-05) | 2.4 GB | Still too large |
| `samplesAtTimestamps` streaming | ~32 MB steady-state | 4 × ~8-frame queue |
| LRU cache N frames/video | N × 4 × 7.9 MB | Bounded, configurable |

---

## Q7: VideoDecoder Queue Limits

[CITED: https://github.com/w3c/webcodecs/issues/27]
[CITED: W3C WebCodecs spec, `decodeQueueSize`]

`VideoDecoder` does NOT have a hard queue limit imposed by the browser. The queue can grow
unbounded if you call `decoder.decode()` in a tight loop without checking `decodeQueueSize`.

**`decodeQueueSize` attribute** signals how many frames are pending decode internally. The
recommended pattern is to pause submitting new packets when the queue exceeds a threshold:

```typescript
const MAX_DECODE_QUEUE = 20; // or browser-specific safe limit

while (encoder.encodeQueueSize > 2) {
    await new Promise(r => setTimeout(r, 0)); // yield to event loop
}
```

**Mediabunny's `computeMaxQueueSize` uses 8 when decoded samples exist in the output queue.**
This means `sampleQueue.length + decoder.decodeQueueSize <= 8` while frames are actively flowing,
providing tight memory bounds.

---

## Recommended Architecture Change

### Option A: `samplesAtTimestamps` Streaming Pipeline (Recommended)

Replace the two-phase (pre-decode then encode) pipeline with a single streaming pipeline using
`samplesAtTimestamps` with a lazy async timestamp generator.

**Architecture:**

```typescript
// For each video, create an async generator that yields export timestamps
async function* videoTimestamps(fps: number, totalDuration: number, videoDuration: number) {
    const totalFrames = Math.ceil(totalDuration * fps);
    for (let i = 0; i < totalFrames; i++) {
        yield computeLoopedTime(i / fps, videoDuration);
    }
}

// Streaming decode: one frame at a time, per video, during encode loop
async function exportWithStreaming(...) {
    // Set up one VideoSampleSink per video, keep Input alive during encode
    const sinks = new Map<string, { sink: VideoSampleSink; input: Input }>();
    const iterators = new Map<string, AsyncGenerator<VideoSample | null>>();

    for (const [mediaId, { blobUrl, duration }] of videos) {
        const blob = await (await fetch(blobUrl)).blob();
        const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
        const track = await input.getPrimaryVideoTrack();
        const sink = new VideoSampleSink(track!);
        const iter = sink.samplesAtTimestamps(videoTimestamps(FPS, totalDuration, duration));
        sinks.set(mediaId, { sink, input });
        iterators.set(mediaId, iter);
    }

    const totalFrames = Math.ceil(totalDuration * FPS);
    for (let i = 0; i < totalFrames; i++) {
        // Advance each video's iterator by one step
        const frameMap = new Map<string, CanvasImageSource>();
        for (const [mediaId, iter] of iterators) {
            const { value: sample } = await iter.next();
            if (sample) {
                frameMap.set(mediaId, sample.toCanvasImageSource());
                // sample.close() must be called AFTER draw — toCanvasImageSource() auto-closes
                // VideoFrame in next microtask, so draw must be synchronous
            }
        }

        await renderGridIntoContext(stableCtx, root, ..., frameMap, imageCache);
        await videoSource.add(i / FPS, 1 / FPS);

        // Close samples after draw
        for (const [mediaId, iter] of iterators) {
            // Note: VideoSample was already closed by the encode pipeline above
        }
    }

    // Dispose all inputs
    for (const { input } of sinks.values()) {
        input.dispose();
    }
}
```

**Memory: ~8 frames × N videos × 7.9 MB = 32 MB for 4 videos.** [CALCULATED]

**Critical constraint: `toCanvasImageSource()` auto-closes its internal VideoFrame in the next
microtask.** [VERIFIED: mediabunny.d.ts line 3132-3137]. The draw to canvas MUST be synchronous
(no `await`) between calling `toCanvasImageSource()` and the browser clearing the frame. Since
`renderGridIntoContext` is `async` (loads images for non-video cells), we cannot safely use
`toCanvasImageSource()` for streaming without immediately drawing. Use `sample.draw(ctx, ...)` or
convert to `ImageBitmap` first (which does NOT auto-close).

**Safer variant: convert VideoSample → ImageBitmap inline per frame:**

```typescript
const videoFrame = sample.toVideoFrame(); // caller-owned, no auto-close
const bitmap = await createImageBitmap(videoFrame);
videoFrame.close();
sample.close();
frameMap.set(mediaId, bitmap);
// bitmap is valid for the duration of this frame's encode — close after videoSource.add()
```

This is essentially the current decode approach, but **done one frame at a time during the
encode loop** rather than pre-decoding all frames.

**Memory: 4 videos × 1 bitmap per video × 7.9 MB = 32 MB steady-state.**

---

### Option B: Streaming `samplesAtTimestamps` with `sample.draw()` (Simplest)

Use `sample.draw(ctx, dx, dy, dWidth, dHeight)` directly instead of going through
`renderGridIntoContext`. This bypasses the `toCanvasImageSource()` microtask issue entirely.

`VideoSample.draw()` accepts `CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D`
[VERIFIED: mediabunny.d.ts line 3093]. It handles rotation metadata automatically.

However, this requires restructuring how `renderGridIntoContext` works (it uses `drawImage` on
`CanvasImageSource`). Likely more refactoring than Option A.

---

### Option C: Sequential Pre-decode with ImageBitmap (Current D-04/D-05, Problematic)

The CONTEXT.md decisions (D-04: sequential, D-05: hold all frames) were designed before the
9.3 GB → 2.4 GB per-video reality was measured. At 1080×1920, even a single 10s video at 30fps
produces 300 × 7.9 MB = **2.4 GB** of ImageBitmaps. This is too large for mid-range mobile.

**This is the approach currently implemented in the codebase.** It will work on high-end desktops
(16+ GB RAM) but will crash or severely degrade 4-8 GB devices.

---

## Concrete Recommendation

### Immediate fix: `samplesAtTimestamps` with per-frame ImageBitmap conversion

Replace the two-phase (Phase A: pre-decode all / Phase B: encode) architecture with a single
encode loop that decodes one frame per video per export frame timestamp, using
`samplesAtTimestamps` with a lazy async timestamp generator.

**Code pattern:**

```typescript
// 1. Build async timestamp generator for one video
async function* makeTimestampGen(
    fps: number,
    totalDuration: number,
    videoDuration: number,
): AsyncGenerator<number> {
    const totalFrames = Math.ceil(totalDuration * fps);
    for (let i = 0; i < totalFrames; i++) {
        yield computeLoopedTime(i / fps, videoDuration);
    }
}

// 2. Set up sinks (one per video)
type VideoStreamEntry = {
    input: Input;
    iter: AsyncGenerator<VideoSample | null>;
    duration: number;
};

async function buildVideoStreams(
    videoMediaIds: Set<string>,
    mediaRegistry: Record<string, string>,
    totalDuration: number,
): Promise<Map<string, VideoStreamEntry>> {
    const streams = new Map<string, VideoStreamEntry>();

    for (const mediaId of videoMediaIds) {
        const blobUrl = mediaRegistry[mediaId];
        const blob = await (await fetch(blobUrl)).blob();
        const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
        const track = await input.getPrimaryVideoTrack();
        if (!track) { input.dispose(); continue; }

        // Compute video duration from track metadata
        const duration = track.duration ?? 0;

        const sink = new VideoSampleSink(track);
        const iter = sink.samplesAtTimestamps(
            makeTimestampGen(FPS, totalDuration, duration)
        );

        streams.set(mediaId, { input, iter, duration });
    }

    return streams;
}

// 3. Encode loop — per-frame streaming decode
const totalFrames = Math.ceil(totalDuration * FPS);
for (let i = 0; i < totalFrames; i++) {
    const frameMap = new Map<string, CanvasImageSource>();
    const bitmapsToClose: ImageBitmap[] = [];

    // Advance each video stream by one step
    for (const [mediaId, { iter }] of videoStreams) {
        const result = await iter.next();
        if (result.done || !result.value) continue;

        const sample = result.value;
        // Convert to ImageBitmap (caller-owned, no auto-close risk)
        const videoFrame = sample.toVideoFrame();
        const bitmap = await createImageBitmap(videoFrame);
        videoFrame.close();
        sample.close(); // release decoder buffer immediately

        frameMap.set(mediaId, bitmap);
        bitmapsToClose.push(bitmap);
    }

    // Render and encode
    await renderGridIntoContext(stableCtx, root, mediaRegistry, 1080, 1920, settings, frameMap, imageCache);
    await drawOverlaysToCanvas(...);
    await videoSource.add(i / FPS, 1 / FPS);

    // Release bitmaps immediately after encode
    for (const b of bitmapsToClose) b.close();

    onProgress('encoding', Math.round(((i + 1) / totalFrames) * 100));
    if ((i + 1) % 10 === 0) await new Promise<void>(r => setTimeout(r, 0));
}

// 4. Dispose all inputs
for (const { input, iter } of videoStreams.values()) {
    await iter.return?.(); // clean up generator
    input.dispose();
}
```

**Memory: 4 videos × 1 ImageBitmap × 7.9 MB = ~32 MB.** Steady-state, regardless of video
duration or frame count.

**Performance:** `samplesAtTimestamps` with monotonically increasing timestamps decodes each
packet at most once — same as forward-sequential `samples()`. The `await iter.next()` call
includes the decode cost per frame. Decode latency per frame is hardware-dependent but
typically < 2ms for H.264 on hardware decoder.

---

## Impact on CONTEXT.md Decisions

| Decision | Status | Notes |
|----------|--------|-------|
| D-01 (VideoSampleSink) | COMPATIBLE | Switch from `samples()` iteration to `samplesAtTimestamps()` |
| D-02 (no raw VideoDecoder) | COMPATIBLE | Still using Mediabunny — not WebCodecs directly |
| D-03 (toCanvasImageSource) | SUPERSEDED | Use `toVideoFrame()` + `createImageBitmap()` per frame instead |
| D-04 (sequential decode) | SUPERSEDED | Interleaved streaming decode is better — all 4 videos stream simultaneously |
| D-05 (hold all frames) | SUPERSEDED | Hold only 1 frame per video at a time |
| D-06 (dispose after loop) | SIMPLIFIED | Dispose each frame immediately after encode, not batch at end |
| D-07 (propagate errors) | UNCHANGED | Error in `iter.next()` propagates naturally |
| D-08 (sort by timestamp) | NOT NEEDED | `samplesAtTimestamps` handles ordering internally |
| D-09 (computeLoopedTime) | STILL NEEDED | Used in the timestamp generator |
| D-10 (renderGridIntoContext Map) | UNCHANGED | Map<mediaId, CanvasImageSource> — same API |

**Decisions D-04 and D-05 in CONTEXT.md were provisional and based on the assumption that
pre-decoding all frames was necessary for looping support.** The `samplesAtTimestamps` API
handles looping via the timestamp generator — no pre-decoding needed.

---

## Key Constraints and Caveats

### 1. `toCanvasImageSource()` Auto-Close Timing (CRITICAL)
[VERIFIED: mediabunny.d.ts line 3132-3137]

```
You must use the value returned by this method immediately, as any VideoFrame
created internally will automatically be closed in the next microtask.
```

`toCanvasImageSource()` is NOT safe to use if an `await` follows before drawing. Use
`toVideoFrame()` (explicit caller ownership) → `createImageBitmap()` instead.

### 2. Input Must Remain Alive During samplesAtTimestamps Iteration
[VERIFIED: media-sink.ts line 706-708]

```typescript
if (terminated || this._track.input._disposed) {
    break;
}
```

If `input.dispose()` is called while `samplesAtTimestamps` is still iterating, the generator
terminates early. **Keep each `Input` alive until `iter.return()` is called and the encode loop
completes.**

### 3. InputVideoTrack.duration Availability
[VERIFIED: mediabunny.d.ts — InputVideoTrack has `duration` field]

For the timestamp generator, `videoDuration` is needed to compute `computeLoopedTime`. This
can be read from `track.duration` (available after `getPrimaryVideoTrack()` resolves). No need
to compute it from the last sample's timestamp.

### 4. `samplesAtTimestamps` Internal Backpressure
[VERIFIED: media-sink.ts line 672-676, 810-815]

The sink internally limits `sampleQueue.length + decodeQueueSize <= 8` when decoded frames are
present. This means the `await iter.next()` call naturally throttles to prevent the decoder
from racing ahead. No additional backpressure code is needed.

### 5. Multiple Videos with Interleaved Iteration
When iterating 4 videos interleaved (one `await iter.next()` per video per frame), each video's
sink has its own independent pump coroutine and decoder. The 4 pumps run concurrently via the
event loop — there is no serial bottleneck. Total steady-state memory: 4 × 8 × 7.9 MB = 253 MB
maximum decode queue, 4 × 1 × 7.9 MB = 32 MB for the active frame map.

---

## Sources

### Primary (HIGH confidence — verified from node_modules)
- `node_modules/mediabunny/src/media-sink.ts` — `mediaSamplesAtTimestamps`, `computeMaxQueueSize`, Worker/OffscreenCanvas detection
- `node_modules/mediabunny/dist/mediabunny.d.ts` — All API types: `VideoSampleSink`, `VideoSample`, `CanvasSink`, `CanvasSinkOptions`
- `node_modules/mediabunny/src/misc.ts` line 861 — `typeof window === 'undefined'` Worker detection

### Secondary (HIGH confidence — official docs)
- [mediabunny.dev/guide/media-sinks](https://mediabunny.dev/guide/media-sinks) — `samplesAtTimestamps` optimization note
- [mediabunny.dev/guide/reading-media-files](https://mediabunny.dev/guide/reading-media-files) — lazy I/O, BlobSource cache
- [mediabunny.dev/api/VideoSample](https://mediabunny.dev/api/VideoSample) — `toCanvasImageSource()` microtask auto-close
- [mediabunny.dev/api/VideoSampleSink](https://mediabunny.dev/api/VideoSampleSink) — `getSample` vs `samplesAtTimestamps`

### Tertiary (MEDIUM confidence — community/spec)
- [webrtchacks.com — WebCodecs Streams Part 1](https://webrtchacks.com/real-time-video-processing-with-webcodecs-and-streams-processing-pipelines-part-1/) — 200 MB/s per second of 1080p25
- [webcodecsfundamentals.org/patterns/transcoding](https://webcodecsfundamentals.org/patterns/transcoding/) — `decodeQueueSize` backpressure pattern
- [w3c/webcodecs issue #27](https://github.com/w3c/webcodecs/issues/27) — `decodeQueueSize` spec rationale

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `InputVideoTrack.duration` is available after `getPrimaryVideoTrack()` without iterating samples | Q1 | Need to compute duration from last sample instead |
| A2 | 4 interleaved `samplesAtTimestamps` iterators don't contend on a shared decoder | Q6 | May need sequential iteration if shared decoder architecture exists |
| A3 | `iter.next()` latency per frame is tolerable (<50ms) for interactive export | Q6 | Export may be slower than pre-decode approach — measure needed |

A2 is LOW risk: each `VideoSampleSink` creates its own independent decoder (verified from
`_createDecoder` call in `mediaSamplesAtTimestamps` which is per-generator, not per-sink).

---

## Open Questions

1. **`InputVideoTrack.duration` availability**
   - What we know: The field exists in the type definitions
   - What's unclear: Whether it's populated before iterating any samples (metadata-only read)
   - Recommendation: Test `track.duration` immediately after `getPrimaryVideoTrack()` in a one-off check before committing the pattern

2. **Per-frame decode latency vs pre-decode batch**
   - What we know: Hardware decoder throughput for 1080p H.264 is typically 60-240fps
   - What's unclear: Whether `await iter.next()` in a 30fps encode loop adds measurable latency vs batch decode
   - Recommendation: Benchmark before declaring victory on the total export time target (≤45s)

3. **Looping video timestamp generator reset**
   - What we know: `computeLoopedTime(i/FPS, duration)` produces increasing timestamps that cycle back to 0 when `i/FPS >= duration`
   - What's unclear: Whether `samplesAtTimestamps` handles the backwards-jump (timestamp going from ~duration back to ~0) via GOP re-seek correctly without stalling
   - Recommendation: From source code analysis at media-sink.ts line 729 (`targetPacket.timestamp < lastPacket.timestamp`), backwards jumps DO trigger a flush+re-seek — this is expected and handled
