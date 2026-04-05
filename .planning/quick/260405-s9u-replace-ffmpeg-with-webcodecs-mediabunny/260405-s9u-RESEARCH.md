# Research: Replace ffmpeg.wasm with WebCodecs + Mediabunny

**Researched:** 2026-04-05
**Domain:** In-browser video encoding — WebCodecs VideoEncoder + Mediabunny muxer
**Confidence:** HIGH (primary API docs) / MEDIUM (Firefox codec compat — active bugs)

---

## Summary

WebCodecs `VideoEncoder` paired with Mediabunny as the MP4 muxer is the correct modern replacement for ffmpeg.wasm in StoryGrid's video export path. The pipeline eliminates the ~25MB WASM download, removes the COOP/COEP header requirement, and runs on the browser's native hardware-accelerated encoder.

The critical browser compatibility issue: **Firefox's `VideoEncoder` implementation has a known, unfixed bug where H.264 (avc1) encoding fails at runtime even though `VideoEncoder.isConfigSupported()` returns `true`.** VP9 encoding in Firefox is the safe fallback. Chrome supports both H.264 and VP9. Since the output must be a downloadable MP4, and MP4 natively supports VP9 (though it is non-standard — most players accept it), the recommended approach is to probe codec support at runtime and use H.264 on Chrome, VP9 on Firefox.

Mediabunny is the canonical successor to mp4-muxer (same author, Vanilagy). mp4-muxer is officially deprecated as of July 2025 with a "migrate in 10 minutes" guide. Mediabunny's `CanvasSource` is the highest-level abstraction for this use case — it accepts an `HTMLCanvasElement`, reads frames on each `add(timestamp, duration)` call, and internally manages `VideoFrame` creation, `VideoEncoder` plumbing, and `EncodedVideoPacketSource` routing. For StoryGrid's offline rendering loop (pre-rendered frames, not a live stream), `CanvasSource` is the right choice.

**Primary recommendation:** Use `CanvasSource` (Mediabunny) + `BufferTarget` for the simple, high-level pipeline. Use `EncodedVideoPacketSource` + manual `VideoEncoder` only if frame-level control is needed (e.g., custom keyframe intervals).

---

## Mediabunny API

### Installation

```bash
npm install mediabunny
```

Package: `mediabunny` (npm). Zero dependencies, pure TypeScript, MPL-2.0 license. Bundle size ranges 5–70 KB gzipped depending on features used (tree-shakable). Current version: checked from official docs (no specific version pinned in README — use latest stable).

### Core Exports

```typescript
import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  StreamTarget,
  CanvasSource,
  EncodedVideoPacketSource,
  EncodedPacket,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  QUALITY_LOW,
  canEncodeVideo,
  getEncodableVideoCodecs,
  getFirstEncodableVideoCodec,
} from 'mediabunny';
```

### Output and Target Configuration

```typescript
// BufferTarget — accumulates entire MP4 in memory, accessible after finalize()
const target = new BufferTarget();

const output = new Output({
  format: new Mp4OutputFormat(),
  target,
});

// After finalize():
const arrayBuffer: ArrayBuffer = target.buffer; // non-null only after finalize()
```

`StreamTarget` accepts a standard `WritableStream` (Web Streams API):

```typescript
const target = new StreamTarget(
  new WritableStream({
    write(chunk: Uint8Array) {
      // Stream data as it's produced — useful for large files
    },
  })
);
```

Note: `FileSystemWritableFileStreamTarget` from mp4-muxer no longer exists. Route the File System Access API through `StreamTarget` instead.

### CanvasSource — High-Level Canvas Integration

`CanvasSource` is the purpose-built abstraction for StoryGrid's render loop. Pass it the canvas element once; call `add(timestamp, duration)` per frame. The library reads the current canvas pixel data at that moment and encodes it.

```typescript
const videoSource = new CanvasSource(canvasElement, {
  codec: 'avc',       // 'avc' | 'hevc' | 'vp9' | 'av1' | 'vp8'
  bitrate: QUALITY_HIGH,  // or a numeric bits-per-second value
});

output.addVideoTrack(videoSource);

await output.start();

// For each frame at 30fps:
const timestamp = frameIndex / 30;   // seconds
const duration  = 1 / 30;            // seconds
await videoSource.add(timestamp, duration);
// CanvasSource reads current canvas state at call time

await output.finalize();
const mp4Buffer = target.buffer; // ArrayBuffer
```

**Timestamp and duration units are SECONDS** (not microseconds) in Mediabunny's high-level API. This differs from raw WebCodecs `VideoFrame` timestamps which are in microseconds.

**`add()` returns `Promise<void>`.** Always `await` it — Mediabunny uses backpressure internally. Calling `add()` without awaiting will produce frames out of order under memory pressure.

### EncodedVideoPacketSource — Low-Level Manual Pipeline

Use this only if you need direct `VideoEncoder` control (custom keyframe intervals, bitrate control, etc.).

```typescript
const packetSource = new EncodedVideoPacketSource('vp9');

output.addVideoTrack(packetSource);
await output.start();

const encoder = new VideoEncoder({
  output: async (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => {
    const packet = EncodedPacket.fromEncodedChunk(chunk);
    // First packet MUST carry decoderConfig
    await packetSource.add(packet, meta ? { decoderConfig: meta.decoderConfig } : undefined);
  },
  error: (e) => console.error('VideoEncoder error:', e),
});

encoder.configure({ /* ... see VideoEncoder Setup below */ });

// Encode frames...
await encoder.flush();
await output.finalize();
```

`EncodedPacket.fromEncodedChunk(chunk)` converts a `EncodedVideoChunk` (WebCodecs) into Mediabunny's `EncodedPacket`. The reverse is `packet.toEncodedVideoChunk()`.

### Runtime Codec Capability Detection

Mediabunny exposes helpers that wrap `VideoEncoder.isConfigSupported()`:

```typescript
const supportedCodecs = await getEncodableVideoCodecs(['avc', 'vp9', 'av1']);
// Returns string[] of supported codec short-names

const firstSupported = await getFirstEncodableVideoCodec(['avc', 'vp9']);
// Returns 'avc' | 'vp9' | null

const ok = await canEncodeVideo('avc');
// Returns boolean
```

**Use `getFirstEncodableVideoCodec` to select codec at runtime.** However, see the Firefox H.264 gotcha in the Gotchas section — `isConfigSupported()` may lie for H.264 on Firefox. Consider hardcoding VP9 for Firefox via `navigator.userAgent` or using a test-encode probe.

### Finalize and Blob Construction

```typescript
await output.finalize();
const arrayBuffer = (output.target as BufferTarget).buffer;
const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
const url = URL.createObjectURL(blob);
```

---

## VideoEncoder Setup

### H.264 Codec String for 1080x1920

The codec string format is `avc1.<profile_idc_hex><constraint_flags_hex><level_idc_hex>`.

For StoryGrid's 1080x1920 at 30fps:

| Field | Value | Meaning |
|-------|-------|---------|
| Profile | `42` | Baseline Profile (0x42) |
| Constraint flags | `E0` | Constrained Baseline (sets constraint_set1_flag) |
| Level | `28` | Level 4.0 (hex 0x28 = decimal 40) |

```
avc1.42E028   ← H.264 Constrained Baseline Profile, Level 4.0
avc1.4D0029   ← H.264 Main Profile, Level 4.1  (better quality, slightly less compatible)
avc1.640029   ← H.264 High Profile, Level 4.1  (best quality, Chrome handles fine)
```

**H.264 Level requirements:** 1080p (1920×1080) at 30fps sits at Level 4.0. 1080×1920 (portrait) is the same pixel area (~2 megapixels), also Level 4.0. Level 4.1 adds headroom for higher bitrates and is widely supported.

**Recommended codec string for StoryGrid:** `'avc1.4D0029'` (Main Profile, Level 4.1) for Chrome. Good quality and broad MP4 player compatibility.

### VideoEncoder configure() — Full Call

```typescript
const encoder = new VideoEncoder({
  output: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => {
    // Pass to muxer here
  },
  error: (e: DOMException) => {
    console.error('VideoEncoder error:', e.message);
  },
});

encoder.configure({
  codec: 'avc1.4D0029',     // H.264 Main Profile Level 4.1
  width: 1080,
  height: 1920,
  bitrate: 8_000_000,        // 8 Mbps — reasonable for 1080×1920 at 30fps
  framerate: 30,
  latencyMode: 'quality',    // offline encoding — always use 'quality', not 'realtime'
  hardwareAcceleration: 'prefer-hardware',
  bitrateMode: 'variable',   // default — better quality than constant
});
```

**`latencyMode: 'quality'`** is mandatory for offline rendering. The `'realtime'` mode may drop frames to hit frame rate targets — unacceptable for a pre-rendered export pipeline.

### VP9 Codec String

```typescript
encoder.configure({
  codec: 'vp09.00.41.08',    // VP9 Profile 0, Level 4.1, 8-bit
  width: 1080,
  height: 1920,
  bitrate: 8_000_000,
  framerate: 30,
  latencyMode: 'quality',
});
```

VP9 codec string format: `vp09.<profile>.<level>.<bitDepth>`. Profile 0 = 4:2:0 chroma subsampling with 8-bit color. Level 41 = Level 4.1. This is safe for Chrome and is the Firefox fallback.

### VideoFrame Creation from HTMLCanvasElement

```typescript
// Timestamps MUST be in microseconds for raw WebCodecs API
const timestampMicros = frameIndex * (1_000_000 / 30); // microseconds at 30fps
const durationMicros  = 1_000_000 / 30;               // ~33333 microseconds

const frame = new VideoFrame(canvas, {
  timestamp: timestampMicros,
  duration: durationMicros,
});

encoder.encode(frame, {
  keyFrame: frameIndex % 60 === 0,  // keyframe every 2 seconds at 30fps
});

frame.close(); // CRITICAL — must be called immediately after encode()
```

**`frame.close()` must be called after `encode()`.** `VideoFrame` holds a reference to the canvas's GPU texture. Failing to close it exhausts the browser's VideoFrame pool (typically 4–8 frames) and causes encode stalls or crashes. The pattern `encode(frame, opts); frame.close();` must be synchronous — do not await between encode and close.

Both `HTMLCanvasElement` and `OffscreenCanvas` are valid `VideoFrame` sources.

### Flushing the Encoder

```typescript
// After the last frame is encoded:
await encoder.flush();
// All pending encode() calls complete before the promise resolves.
// After flush(), all EncodedVideoChunk callbacks have fired.
// Safe to call muxer.finalize() after this.
```

### EncodedVideoChunk and Metadata

```typescript
// output callback signature:
(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => void

// EncodedVideoChunk properties:
chunk.type        // 'key' | 'delta'
chunk.timestamp   // microseconds (number)
chunk.duration    // microseconds (number | null)
chunk.byteLength  // number

// EncodedVideoChunkMetadata (only present on first chunk and keyframes):
meta?.decoderConfig   // VideoDecoderConfig — pass to muxer on first chunk
meta?.svc             // scalability info (ignore for this use case)
```

The `decoderConfig` inside metadata is required by the muxer to write the codec parameter box (avcC or vpcC atom) in the MP4 container. It will be present on the **first encoded chunk** and on subsequent keyframes. Always forward `meta` to the muxer; the muxer ignores it when absent.

---

## Full Integration Example

Two variants are shown: the high-level `CanvasSource` path (recommended) and the manual `EncodedVideoPacketSource` path (for reference).

### Variant A — CanvasSource (Recommended for StoryGrid)

```typescript
import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  QUALITY_HIGH,
  getFirstEncodableVideoCodec,
} from 'mediabunny';

export async function exportVideoFromCanvas(
  canvas: HTMLCanvasElement,
  renderFrame: (frameIndex: number) => Promise<void>,
  totalFrames: number,
  fps: number = 30,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  // Codec selection: try H.264 first (Chrome), fall back to VP9 (Firefox)
  const codec = await getFirstEncodableVideoCodec(['avc', 'vp9']);
  if (!codec) {
    throw new Error('No supported video encoder found in this browser.');
  }

  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat(),
    target,
  });

  const videoSource = new CanvasSource(canvas, {
    codec,              // 'avc' or 'vp9' short name
    bitrate: QUALITY_HIGH,
  });
  output.addVideoTrack(videoSource);

  await output.start();

  const frameDuration = 1 / fps; // seconds
  for (let i = 0; i < totalFrames; i++) {
    await renderFrame(i);          // draws into canvas
    const timestamp = i * frameDuration;
    await videoSource.add(timestamp, frameDuration);
    onProgress?.(i / totalFrames);
  }

  await output.finalize();

  const arrayBuffer = target.buffer as ArrayBuffer;
  return new Blob([arrayBuffer], { type: 'video/mp4' });
}
```

### Variant B — Manual VideoEncoder + EncodedVideoPacketSource

Use this if you need explicit keyframe control or custom bitrate per segment.

```typescript
import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  EncodedVideoPacketSource,
  EncodedPacket,
} from 'mediabunny';

export async function exportVideoManual(
  canvas: HTMLCanvasElement,
  renderFrame: (frameIndex: number) => Promise<void>,
  totalFrames: number,
  fps: number = 30,
): Promise<Blob> {
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });

  const packetSource = new EncodedVideoPacketSource('vp9');
  output.addVideoTrack(packetSource);
  await output.start();

  let firstChunk = true;

  const encoder = new VideoEncoder({
    output: async (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => {
      const packet = EncodedPacket.fromEncodedChunk(chunk);
      if (firstChunk && meta?.decoderConfig) {
        await packetSource.add(packet, { decoderConfig: meta.decoderConfig });
        firstChunk = false;
      } else {
        await packetSource.add(packet);
      }
    },
    error: (e) => { throw e; },
  });

  encoder.configure({
    codec: 'vp09.00.41.08',
    width: canvas.width,
    height: canvas.height,
    bitrate: 8_000_000,
    framerate: fps,
    latencyMode: 'quality',
  });

  const frameDuration = 1_000_000 / fps; // microseconds

  for (let i = 0; i < totalFrames; i++) {
    await renderFrame(i);
    const frame = new VideoFrame(canvas, {
      timestamp: i * frameDuration,
      duration: frameDuration,
    });
    encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 }); // keyframe every 2s
    frame.close(); // MUST be synchronous immediately after encode()
  }

  await encoder.flush();
  await output.finalize();

  return new Blob([target.buffer as ArrayBuffer], { type: 'video/mp4' });
}
```

---

## Gotchas

### Gotfall 1: Firefox H.264 VideoEncoder Bug (BLOCKING)

**What goes wrong:** `VideoEncoder.isConfigSupported({ codec: 'avc1.*' })` returns `{ supported: true }` in Firefox 130–145+, but calling `encoder.configure()` with any `avc1.*` codec string throws `DOMException: The given encoding is not supported` when the first frame is encoded.

**Why it happens:** Firefox's WebCodecs implementation conditionally depends on OpenH264 or a platform H.264 encoder. On many Linux configurations and some Windows setups without the appropriate media plugins, the encoder path is absent even though the API claims support. This is an active Mozilla bug (Bugzilla #1918769).

**How to avoid:**
- Do NOT rely solely on `isConfigSupported()` for H.264 in Firefox.
- Use a codec priority list: `['avc', 'vp9']` — Mediabunny's `getFirstEncodableVideoCodec` will return the first one for which `isConfigSupported` is true. **If this returns `'avc'` but you're on Firefox, it may still fail at encode time.**
- Safer approach: detect Firefox via UA string or feature-probe, and force `'vp9'` on Firefox regardless of what `isConfigSupported` reports.
- Alternatively, use a test-encode probe: configure the encoder, encode one 1×1 frame, and `await encoder.flush()`. If it succeeds, the codec is genuinely available. Fall back to VP9 on error.

```typescript
// Conservative Firefox workaround
const isFirefox = navigator.userAgent.includes('Firefox');
const codec = isFirefox ? 'vp9' : 'avc';
```

**Warning signs:** `DOMException: The given encoding is not supported` on `encode()` call, not on `configure()`.

### Gotcha 2: VideoFrame Pool Exhaustion

**What goes wrong:** After encoding 4–8 frames, encode stalls or throws because the browser's VideoFrame pool is exhausted.

**Why it happens:** Each `new VideoFrame(canvas, ...)` acquires a GPU texture slot. The browser limits these to prevent OOM. `VideoEncoder.encode()` is asynchronous — if you don't call `frame.close()` before the next iteration, frames pile up.

**How to avoid:** Call `frame.close()` synchronously in the same microtask as `encode()`. Never await anything between `encode()` and `close()`.

```typescript
encoder.encode(frame, opts);
frame.close(); // do NOT put await before this
```

### Gotcha 3: EncodedVideoPacketSource Requires decoderConfig on First Packet

**What goes wrong:** Muxer produces an MP4 that cannot be decoded — missing codec parameter box (avcC/vpcC atom).

**Why it happens:** MP4 containers store codec initialization data in a separate box. Mediabunny writes this box from the `decoderConfig` metadata only present on the first encoded chunk.

**How to avoid:** Always pass `meta` to `packetSource.add()` for the first chunk. Use a `firstChunk` boolean flag (as shown in Variant B above).

### Gotcha 4: Await `videoSource.add()` — Never Fire-and-Forget

**What goes wrong:** Frames arrive at the muxer out of order, producing corrupted MP4.

**Why it happens:** Mediabunny uses internal backpressure. If `add()` is not awaited, the next frame may start encoding before the previous one has been muxed.

**How to avoid:** `await videoSource.add(...)` on every call. The `for` loop must be `async` and each iteration must `await`.

### Gotcha 5: Timestamp Units Differ Between Layers

**What goes wrong:** Video plays at wrong speed or muxer throws on out-of-order timestamps.

**Why it happens:** There are two different timestamp coordinate systems in play:
- **Mediabunny `CanvasSource.add(timestamp, duration)`** — both values are **seconds** (floating point)
- **Raw WebCodecs `new VideoFrame(canvas, { timestamp })`** — timestamp is **microseconds** (integer)

If you mix these up when switching between the high-level and low-level API, everything breaks.

**How to avoid:** Comment the units at the call site. Use named constants:

```typescript
const FRAME_DURATION_SEC  = 1 / 30;             // for CanvasSource
const FRAME_DURATION_US   = 1_000_000 / 30;     // for raw VideoFrame
```

### Gotcha 6: `output.start()` Must Be Called Before `add()`

**What goes wrong:** Calling `videoSource.add()` before `output.start()` throws or silently drops frames.

**How to avoid:** Always follow the sequence: `output.addVideoTrack()` → `await output.start()` → `add()` loop → `await output.finalize()`.

### Gotcha 7: BufferTarget.buffer Is Null Until finalize()

**What goes wrong:** Accessing `target.buffer` before `finalize()` returns `null`.

**How to avoid:** Only access `target.buffer` after `await output.finalize()` completes.

### Gotcha 8: OffscreenCanvas vs HTMLCanvasElement

Both are valid `VideoFrame` sources. `CanvasSource` accepts `HTMLCanvasElement`. If you move rendering to a Web Worker (using `OffscreenCanvas`), you must use the manual `VideoEncoder` + `EncodedVideoPacketSource` path, since `CanvasSource` is designed for main-thread canvas elements. Transferring `VideoFrame` objects between workers via `postMessage` with `transfer` array is supported by the WebCodecs spec.

---

## Recommendation

### Use Mediabunny (not mp4-muxer)

mp4-muxer is **officially deprecated** (July 2025, v5.2.2 final). The author's own announcement recommends migrating to Mediabunny. For a new implementation, use Mediabunny directly.

### Use CanvasSource (not manual VideoEncoder) for StoryGrid

StoryGrid's export loop follows exactly the pattern `CanvasSource` is designed for: a canvas element that is updated each frame in sequence. The high-level API handles `VideoFrame` lifecycle, `VideoEncoder` configuration, keyframe scheduling, and `EncodedVideoPacketSource` routing internally. This eliminates the `frame.close()` footgun and the `decoderConfig` first-packet requirement from application code.

### Codec Strategy

| Browser | Use Codec | Short Name | Full Codec String |
|---------|-----------|------------|-------------------|
| Chrome 94+ | H.264 Main Profile Level 4.1 | `'avc'` | `avc1.4D0029` |
| Firefox 130+ | VP9 Profile 0 Level 4.1 | `'vp9'` | `vp09.00.41.08` |

Both codecs produce valid `.mp4` files (VP9-in-MP4 is part of the ISO base media file format spec and plays in all modern players and Chrome/Firefox natively). For maximum compatibility with external players, prefer H.264 on Chrome and accept VP9-only MP4 on Firefox — or detect Firefox and warn the user that the file may not play in all players.

Do NOT attempt H.264 on Firefox. The bug is unresolved as of April 2026.

### mp4-muxer as Emergency Fallback

If Mediabunny introduces an unexpected issue at integration time, mp4-muxer v5.2.2 remains functional (it is deprecated but not removed from npm). The API is nearly identical for the WebCodecs pipeline:

```typescript
// mp4-muxer fallback (deprecated but functional)
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
const muxer = new Muxer({
  target: new ArrayBufferTarget(),
  video: { codec: 'avc', width: 1080, height: 1920 },
  fastStart: 'in-memory',
  firstTimestampBehavior: 'offset', // normalizes non-zero start timestamps
});
const encoder = new VideoEncoder({
  output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
  error: console.error,
});
// ... same VideoEncoder.configure() call ...
await encoder.flush();
muxer.finalize();
const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
```

The primary difference: mp4-muxer uses `ArrayBufferTarget` (Mediabunny renamed it to `BufferTarget`), and `addVideoChunk(chunk, meta)` is a direct method call (not async).

---

## Sources

### Primary (HIGH confidence)
- [Mediabunny official docs — mediabunny.dev](https://mediabunny.dev) — Output, BufferTarget, CanvasSource, EncodedVideoPacketSource, utility functions
- [Mediabunny — Media Sources guide](https://mediabunny.dev/guide/media-sources) — CanvasSource.add() signature, VideoSampleSource, EncodedVideoPacketSource
- [Mediabunny — Quick Start guide](https://mediabunny.dev/guide/quick-start) — canvas-to-MP4 full pipeline
- [Mediabunny — API reference](https://mediabunny.dev/api/) — all exports
- [Mediabunny — Supported formats and codecs](https://mediabunny.dev/guide/supported-formats-and-codecs) — codec short names for MP4
- [EncodedPacket API](https://mediabunny.dev/api/EncodedPacket) — fromEncodedChunk(), toEncodedVideoChunk()
- [mp4-muxer migration guide](https://github.com/Vanilagy/mp4-muxer/blob/main/MIGRATION-GUIDE.md) — ArrayBufferTarget → BufferTarget, addVideoChunk → EncodedVideoPacketSource.add()
- [mp4-muxer archived README](https://github.com/Vanilagy/mp4-muxer/blob/2c611c5932d3b8054c8968320cf9b6b7db094d30/README.md) — complete mp4-muxer API
- [MDN VideoEncoder](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder) — configure(), encode(), flush(), output callback
- [MDN VideoEncoder.configure()](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder/configure) — latencyMode, hardwareAcceleration, bitrateMode options
- [W3C AVC WebCodecs Registration](https://www.w3.org/TR/webcodecs-avc-codec-registration/) — avc1 codec string spec

### Secondary (MEDIUM confidence — verified against MDN/spec)
- [WebCodecs Fundamentals — codec support dataset](https://webcodecsfundamentals.org/datasets/codec-support/) — H.264 99%+ support claim (dataset, not authoritative spec)
- [DEV.to — WebCodecs canvas export pipeline](https://dev.to/nareshipme/how-to-render-and-export-video-in-the-browser-with-webcodecs-offscreencanvas-and-a-web-worker-mm3) — OffscreenCanvas + mediabunny integration pattern

### Tertiary (MEDIUM-LOW — community reports, verify before shipping)
- [Mozilla Bugzilla #1918769](https://bugzilla.mozilla.org/show_bug.cgi?id=1918769) — Firefox VideoDecoder H.264 failure (related encoder issue)
- [Phoronix — Firefox 130 WebCodecs launch](https://www.phoronix.com/news/Firefox-130) — confirmation of WebCodecs desktop availability in Firefox 130
- Community reports (multiple sources): Firefox VideoEncoder H.264 `DOMException: The given encoding is not supported` — observed in Firefox 130–145, as of April 2026 unresolved

---

## Confidence Breakdown

| Area | Level | Reason |
|------|-------|--------|
| Mediabunny API | HIGH | Fetched from official mediabunny.dev docs directly |
| mp4-muxer deprecation | HIGH | Author's own migration guide confirms it |
| VideoEncoder configure() params | HIGH | MDN official reference |
| H.264 codec string format | HIGH | W3C spec + RFC 6381 referenced |
| Firefox H.264 bug | MEDIUM | Community reports + Bugzilla ticket; no official Mozilla fix announcement found |
| VP9 Firefox fallback | MEDIUM | VP9 encoder support implied by WebCodecs meta-bug; no dedicated Firefox VP9 encoder test result found |
| `CanvasSource.add()` timestamp units (seconds) | HIGH | Official quick-start example uses `canvasSource.add(0.0, 0.1)` confirming seconds |

**Research date:** 2026-04-05
**Valid until:** ~2026-05-05 (Mediabunny actively developed; Firefox WebCodecs bugs may resolve)
