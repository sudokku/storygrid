# Phase 15 Option 2 — WebCodecs VideoDecoder Sequential Decode

## Summary

Replace `HTMLVideoElement` + `seekAllVideosTo` with `VideoDecoder` (WebCodecs API) fed by
Mediabunny's own demux path. Decode all video frames in a single forward pass per video — no
seeking, no browser-process IPC. This is the architecturally correct solution and the path
Remotion, DiffusionStudio, and the W3C reference sample all converged on.

## Performance Expectation

| Scenario | Current | Option 2 |
|---|---|---|
| 24s export, 4 videos | ~3 minutes | ~10–25 seconds |
| Encode time target (20–45s) | ❌ | ✅ |

WebCodecs `VideoDecoder` with hardware acceleration decodes H.264 at 10–20× real-time on modern
hardware. A 24-second video at 30fps (720 frames) decodes in ~2–5 seconds. With 4 videos decoded
sequentially (or pipelined), plus ~1s render+encode overhead, total export is ~10–25 seconds.

---

## Root Cause (for reference)

`video.currentTime = t` triggers a renderer→browser-process IPC round-trip for every frame.
Chrome's internal media pipeline must seek to a keyframe, decode forward, and send the result
back across the IPC boundary. At 30fps × 749 frames × 4 videos, this is ~2996 IPC calls =
185 seconds.

`VideoDecoder` runs entirely in the renderer process. No IPC. The decoder receives `EncodedVideoChunk`
objects directly and outputs `VideoFrame` objects synchronously (via callback). The GPU-accelerated
decode path runs at hardware speeds.

---

## 🔬 RESEARCHER AGENT: Priority Question

Before any implementation planning, validate this in the Mediabunny source/docs/types:

> **Does `mediabunny`'s `VideoSampleSink` / `Input` API expose raw `EncodedVideoChunk`-compatible
> data (byte payload in AVCC format) AND the codec description (avcC box as ArrayBuffer) needed
> for `VideoDecoder.configure()`?**

Check `node_modules/mediabunny/dist/mediabunny.d.ts` for `VideoSampleSink`, `Input`, `BlobSource`,
and any demux-side types. If yes → zero new dependencies. If no → add `mp4box.js` (~37kB gzip).
This single answer determines the entire dependency strategy for Phase 15.

---

## Key Design Decision: Mediabunny as Demuxer

StoryGrid already depends on `mediabunny` for encoding (`CanvasSource`, `Output`). Mediabunny also
has a **read/demux path** (`VideoSampleSink`, `Input`) capable of extracting encoded video chunks
from MP4 blobs at 10,800 packets/s.

Using Mediabunny for both demux and mux:
- **Zero new dependencies** (mp4box.js ~37kB would otherwise be required)
- Mediabunny benchmarks 10,800 packets/s vs mp4box.js's 2,390 packets/s
- Remotion's production app migrated from `@remotion/webcodecs` to Mediabunny — strong signal

If Mediabunny's VideoSampleSink API proves insufficient for raw chunk extraction with codec
description access, fall back to **mp4box.js** (~37kB gzip, well-tested, W3C reference sample
uses it). This should be validated in research/implementation.

---

## Architecture

### Current
```
buildExportVideoElements() → Map<mediaId, HTMLVideoElement>

for each frame i:
  seekAllVideosTo(i/FPS)          // 250ms avg, IPC bottleneck
  renderGridIntoContext()          // reads live video elements
  videoSource.add()
```

### Option 2
```
// Phase A: Decode all frames for all videos (fast — no IPC)
const decodedFrames = await decodeAllVideoFrames(mediaRegistry, videoLeaves, totalFrames, FPS)
// Map<mediaId, VideoFrame[]>  — indexed by frame number

// Phase B: Encode loop (no seeking, reads from decoded frame arrays)
for each frame i:
  const frameBitmaps = extractBitmapsForFrame(decodedFrames, i)
  renderGridIntoContext(frameBitmaps)
  videoSource.add()
  closeFrames(frameBitmaps)       // release GPU memory
```

---

## Implementation Plan

### Step 1 — `decodeVideoToFrames` (new function)

Decodes a single video blob to an array of VideoFrames using WebCodecs VideoDecoder.

```typescript
async function decodeVideoToFrames(
  blob: Blob,
  neededFrameCount: number,
  fps: number,
): Promise<VideoFrame[]> {
  const frames: VideoFrame[] = [];

  // 1. Demux: extract encoded chunks via Mediabunny Input/VideoSampleSink
  //    (or mp4box.js if Mediabunny doesn't expose raw chunk + codec description)
  const { chunks, codecConfig } = await demuxVideo(blob);
  // codecConfig: { codec, codedWidth, codedHeight, description, ... }

  // 2. Configure VideoDecoder
  const decoder = new VideoDecoder({
    output: (frame) => frames.push(frame),   // collect all output frames
    error: (e) => { throw e; },
  });

  const support = await VideoDecoder.isConfigSupported(codecConfig);
  if (!support.supported) throw new Error(`Codec not supported: ${codecConfig.codec}`);

  decoder.configure({ ...codecConfig, hardwareAcceleration: 'prefer-hardware' });

  // 3. Feed all chunks in decode order (no seeking, no flush between frames)
  for (const chunk of chunks) {
    // Backpressure: don't let queue grow unbounded
    while (decoder.decodeQueueSize > 10) {
      await new Promise<void>(r => decoder.addEventListener('dequeue', r, { once: true }));
    }
    decoder.decode(chunk);
  }

  // 4. Single flush at the end — drains all remaining frames
  await decoder.flush();
  decoder.close();

  // Frames are in presentation order (sorted by timestamp) — sort to be safe
  frames.sort((a, b) => a.timestamp - b.timestamp);

  return frames;
}
```

### Step 2 — `demuxVideo` (new function, critical path)

This is the hardest part. Two implementation paths:

**Path A: Mediabunny VideoSampleSink (preferred)**
```typescript
async function demuxVideo(blob: Blob): Promise<DemuxResult> {
  // Use Mediabunny's Input + VideoSampleSink to extract encoded chunks
  // Needs validation: does Mediabunny expose raw EncodedVideoChunk data + avcC description?
  // Check mediabunny.d.ts: VideoSampleSink, Input, BlobSource classes
}
```

**Path B: mp4box.js fallback (~37kB gzip)**
```typescript
import MP4Box from 'mp4box';

async function demuxVideo(blob: Blob): Promise<DemuxResult> {
  const arrayBuffer = await blob.arrayBuffer();
  (arrayBuffer as any).fileStart = 0;

  return new Promise((resolve, reject) => {
    const file = MP4Box.createFile();
    const chunks: EncodedVideoChunk[] = [];
    let codecConfig: VideoDecoderConfig;

    file.onReady = (info) => {
      const track = info.videoTracks[0];
      codecConfig = {
        codec: track.codec,
        codedWidth: track.video.width,
        codedHeight: track.video.height,
        description: extractAvcC(track),  // serialize avcC box to ArrayBuffer
        hardwareAcceleration: 'prefer-hardware',
      };
      file.setExtractionOptions(track.id, null, { nbSamples: Infinity });
      file.start();
    };

    file.onSamples = (_, __, samples) => {
      for (const s of samples) {
        chunks.push(new EncodedVideoChunk({
          type: s.is_sync ? 'key' : 'delta',
          timestamp: s.cts * 1_000_000 / s.timescale,   // microseconds
          duration: s.duration * 1_000_000 / s.timescale,
          data: s.data,
        }));
      }
    };

    file.onFlush = () => resolve({ chunks, codecConfig });
    file.appendBuffer(arrayBuffer);
    file.flush();
  });
}

function extractAvcC(track: any): ArrayBuffer {
  // Serialize the avcC box from mp4box track info
  // ~20 lines; copied from vjeux/mp4-h264-re-encode reference
  const entry = track.mdia.minf.stbl.stsd.entries[0];
  const avcC = entry.avcC;
  // ... serialize to ArrayBuffer ...
}
```

### Step 3 — `decodeAllVideoFrames` (orchestrator)

```typescript
async function decodeAllVideoFrames(
  mediaRegistry: MediaRegistry,
  videoLeafIds: string[],      // unique mediaIds of video cells
  totalFrames: number,
  fps: number,
): Promise<Map<string, VideoFrame[]>> {
  const result = new Map<string, VideoFrame[]>();

  // Decode all videos in parallel (4 VideoDecoder instances simultaneously)
  await Promise.all(
    videoLeafIds.map(async (mediaId) => {
      const blob = mediaRegistry.getBlob(mediaId); // or however blob is retrieved
      const frames = await decodeVideoToFrames(blob, totalFrames, fps);
      result.set(mediaId, frames);
    })
  );

  return result;
}
```

### Step 4 — Frame lookup by timestamp

Decoded frames are sorted by `frame.timestamp` (microseconds). For export frame `i`:
```typescript
function getFrameAtTime(frames: VideoFrame[], timeSeconds: number): VideoFrame | null {
  const targetUs = timeSeconds * 1_000_000;
  // Find the frame with timestamp closest to (and not exceeding) targetUs
  // Account for video duration looping via modulo
  return frames.reduce((best, f) => {
    const diff = Math.abs(f.timestamp - targetUs);
    return diff < Math.abs((best?.timestamp ?? Infinity) - targetUs) ? f : best;
  }, null as VideoFrame | null);
}
```

### Step 5 — `renderGridIntoContext` extension

Same as Option 1 Step 2: accept `Map<string, VideoFrame>` (or `Map<string, ImageBitmap>`)
for video cells in addition to `Map<string, HTMLVideoElement>`. `drawImage(videoFrame, ...)` is
natively supported on canvas 2D context.

### Step 6 — Export loop refactor

```typescript
// Build decoder-based frame store (replaces buildExportVideoElements)
onProgress('encoding', 0);
const videoLeafIds = getUniqueVideoMediaIds(getAllLeaves(root), mediaTypeMap);
const decodedFrames = await decodeAllVideoFrames(mediaRegistry, videoLeafIds, totalFrames, FPS);

// Encode loop — reads from decoded frames, zero seeking
for (let i = 0; i < totalFrames; i++) {
  const timeSeconds = computeLoopedExportTime(i / FPS, decodedFrames); // per-video loop
  const frameMap = new Map(
    Array.from(decodedFrames.entries()).map(([id, frames]) => [
      id, getFrameAtTime(frames, timeSeconds)
    ])
  );

  await renderGridIntoContext(stableCtx, root, mediaRegistry, 1080, 1920, settings, frameMap, imageCache);
  await drawOverlaysToCanvas(stableCtx, overlayState.overlays, overlayState.stickerRegistry, overlayImageCache, true);
  await videoSource.add(i / FPS, 1 / FPS);

  onProgress('encoding', Math.round((i / totalFrames) * 100));
  // Note: do NOT close frames here — they are reused across multiple export frames (looping)
}

// Close all decoded frames after export loop
for (const frames of decodedFrames.values()) {
  for (const frame of frames) frame.close();
}
```

---

## Files to Change

| File | Change |
|---|---|
| `src/lib/videoExport.ts` | Replace `buildExportVideoElements` + `seekAllVideosTo` with `decodeAllVideoFrames` |
| `src/lib/videoExport.ts` | Add `demuxVideo`, `decodeVideoToFrames`, `decodeAllVideoFrames`, `getFrameAtTime` |
| `src/lib/export.ts` | Extend `renderGridIntoContext` to accept `Map<string, VideoFrame>` |
| `src/lib/videoExport.ts` | Remove `buildExportVideoElements`, `seekAllVideosTo`, `destroyExportVideoElements` |
| `package.json` (maybe) | Add `mp4box` if Mediabunny demux path proves insufficient |

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Mediabunny VideoSampleSink doesn't expose raw chunks | Medium | Fall back to mp4box.js (37kB, well-tested) |
| avcC description serialisation bugs | Medium | Use vjeux reference implementation; unit test with sample videos |
| H.264 Annex B vs AVCC format mismatch | Low | Most phone videos are AVCC; detect and handle |
| B-frame reordering corrupts frame order | Low | Sort by `frame.timestamp` after decode |
| OOM holding all VideoFrames in memory | Medium | GPU-resident frames; 749 frames × 4 videos. Mitigate: decode one video at a time, not all in parallel |
| Memory strategy varies by device tier | High | **See planner note below** — device capability detection required |
| Safari VideoDecoder partial support | Low | Export already Chrome/Firefox-only for video; same constraint |
| `VideoDecoder.isConfigSupported` returns false | Low | Codec probe before decode; error message to user |
| Looping videos produce wrong frame indices | Medium | `computeLoopedTime` already in codebase; adapt for VideoFrame timestamp lookup |

---

## Estimated Effort

~6–8 hours implementation, ~2 hours testing across video formats.
New code: ~200–250 lines. Deleted code: ~80 lines (seekAllVideosTo, buildExportVideoElements).

---

## Reference Implementations

- W3C official WebCodecs sample: `github.com/w3c/webcodecs/tree/main/samples/video-decode-display`
- vjeux/mp4-h264-re-encode: complete mp4box.js + VideoDecoder pipeline in ~120 lines
- DiffusionStudio/webcodecs-scroll-sync: Mediabunny demux + VideoDecoder with seeking
- Chrome for Developers: `developer.chrome.com/docs/web-platform/best-practices/webcodecs`

---

## Verdict

**Choose Option 2 if**: You want to consistently hit 20–45s encode time, this is the correct
architectural solution. Eliminates the IPC bottleneck entirely. Also unlocks future features
(frame-accurate trimming, per-frame effects, WebGL compositing). More code than Option 1 but
Mediabunny potentially eliminates the hardest part (avcC demux).

**The key research question for Phase 15**: Does `mediabunny`'s `VideoSampleSink` / `Input` API
expose raw `EncodedVideoChunk` data + the codec description (avcC box) needed for `VideoDecoder.configure()`?
If yes, zero new dependencies. If no, add mp4box.js (~37kB).

---

## 🗂️ PLANNER AGENT: Open Architecture Decision — Memory Strategy by Device Tier

The pre-decode approach (holding all VideoFrames in memory before the encode loop) has different
risk profiles depending on user hardware. **This must be an explicit design decision during
planning, not discovered at runtime.**

The three strategies to choose between:

| Strategy | How it works | Memory use | Complexity |
|---|---|---|---|
| **Pre-decode all** | Decode all frames for all videos before encode loop | High (~1–3GB GPU) | Low |
| **Sequential per-video** | Decode video 1 fully → encode its frames → decode video 2… | Medium (~300–800MB) | Medium |
| **Sliding window** | Keep only N frames decoded ahead of encode position; discard as encoded | Low (~50–150MB) | High |

**The question for the planner**: Should the implementation detect device capability at runtime
and pick a strategy automatically, or should we pick one strategy that's safe for the lowest
common denominator (mid-range phone/laptop)?

Signals available at runtime:
- `navigator.deviceMemory` — RAM in GB (Chrome only; 0.25–8)
- `navigator.hardwareConcurrency` — CPU core count
- `VideoDecoder.isConfigSupported()` — confirms HW decode path

Suggested discussion question: *"Is StoryGrid's target user on a phone, mid-range laptop, or
high-end PC — and should the memory strategy adapt, or should we assume a safe minimum?"*

This decision affects Step 3 of the implementation plan above and the progress UX
(pre-decode all = no progress until encode starts vs. sliding window = smooth progress bar).
