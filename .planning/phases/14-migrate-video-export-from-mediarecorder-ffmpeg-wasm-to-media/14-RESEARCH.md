# Phase 14: Migrate Video Export to Mediabunny — Research

**Researched:** 2026-04-10
**Domain:** WebCodecs + Mediabunny direct MP4 encoding with audio (OfflineAudioContext + AudioBufferSource)
**Confidence:** HIGH (Mediabunny official docs verified) / MEDIUM (Firefox audio fallback — active ecosystem gap)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use WebCodecs `AudioEncoder` with AAC (mp4a.40.2) codec for the audio track. No ffmpeg.wasm for audio.
- **D-02:** Audio mixing uses `OfflineAudioContext` + `AudioBufferSourceNode` per video cell, then `AudioEncoder` encodes the rendered output. Replaces MediaRecorder `MediaStreamAudioDestinationNode` approach.
- **D-03:** If `AudioEncoder` is unavailable or audio decoding fails, export **video-only with a warning toast** ("Audio not supported in this browser — exporting video only"). No hard block on audio failure.
- **D-04:** AAC chosen over Opus: better QuickTime/iOS compatibility in MP4 containers.
- **D-05:** Phase 14 ships full migration in one shot. No split into 14 + 14.1.
- **D-06:** If `VideoEncoder` (WebCodecs) is unavailable: **hard block** with a browser upgrade message. No dual-pipeline maintenance.
- **D-07:** No fallback to MediaRecorder+ffmpeg.wasm.
- **D-08:** Remove `@ffmpeg/ffmpeg` and `@ffmpeg/util` from `package.json`.
- **D-09:** Delete `src/lib/transcodeToMp4.ts`.
- **D-10:** Remove COOP/COEP headers from `vercel.json` and `public/_headers`.
- **D-11:** Stable canvas pattern — one persistent 1080×1920 canvas passed to CanvasSource; drawImage from renderGridToCanvas output per frame.
- **D-12:** VP9 on Firefox, AVC on all other browsers.
- **D-13:** `seeked`-event seeking with 500ms timeout fallback.
- **D-14:** Progress stages: `'preparing' | 'encoding'` (remove `'transcoding'`).
- **D-15:** Update Toast and ExportSplitButton to drop `'transcoding'` state.

### Claude's Discretion
- Audio bitrate: default to 128kbps or QUALITY_HIGH constant mapping for audio — researcher/planner to verify.
- Whether Mediabunny exposes a dedicated audio source API (e.g., `AudioEncodedPacketSource`) or requires manual `AudioEncoder` routing: researcher to verify.
- Exact OfflineAudioContext sample rate and channel layout: researcher/planner to decide based on Mediabunny audio track requirements.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUD-05 | MP4 video export mixes audio from all cells where audio is enabled | AudioBufferSource + OfflineAudioContext pattern documented below |
| AUD-06 | If zero cells have audio enabled, exported MP4 contains no audio track | Skip addAudioTrack when hasAudioEnabledVideoLeaf returns false |
| AUD-07 | Audio in exported MP4 is clipped to total video export duration | OfflineAudioContext length in samples = totalDuration × sampleRate |
| AUD-09 | Audio export Chrome/Firefox only — matches video export browser support | canEncodeAudio guard + @mediabunny/aac-encoder for Firefox |
</phase_requirements>

---

## Summary

Mediabunny's `AudioBufferSource` is the correct integration point for this phase's audio pipeline. It accepts a Web Audio API `AudioBuffer` directly, auto-timestamps sequential buffers from position 0, and encodes them using a configurable `AudioEncodingConfig`. No manual `AudioEncoder` routing is needed — `AudioBufferSource` handles encoding internally.

The audio pipeline for each export run is:
1. For each audio-enabled video cell, `fetch()` its blob URL and `decodeAudioData()` via a temporary `AudioContext`
2. Create an `OfflineAudioContext` sized to `totalDuration × sampleRate`
3. Create one `AudioBufferSourceNode` per decoded buffer, connect all to destination, schedule at their looped offsets
4. `offlineCtx.startRendering()` → mixed `AudioBuffer`
5. Pass the mixed `AudioBuffer` to `AudioBufferSource.add(mixedBuffer)`

**Critical architecture constraint:** `MediaElementAudioSourceNode` is incompatible with `OfflineAudioContext` — it requires a real-time `AudioContext`. [VERIFIED: MDN Web Audio API spec] The correct approach is `fetch()` → `decodeAudioData()` → `AudioBufferSourceNode` in an `OfflineAudioContext`.

**Firefox audio gap:** Firefox does not have native WebCodecs AAC encoder support. The `@mediabunny/aac-encoder` npm package (WASM-based FFmpeg AAC encoder) polyfills this. However, per D-03, if `canEncodeAudio('aac')` returns false and the WASM polyfill is not installed, the implementation falls back to video-only export with a warning toast. This phase should install `@mediabunny/aac-encoder` and call `registerAacEncoder()` conditionally to maximize audio coverage on Firefox.

**Primary recommendation:** Use `AudioBufferSource` (Mediabunny high-level audio API) + `OfflineAudioContext.decodeAudioData()` for per-cell audio decoding and mixing. Install `@mediabunny/aac-encoder` to polyfill Firefox.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mediabunny | ^1.40.1 | MP4 muxing, CanvasSource (video), AudioBufferSource (audio) | Only active successor to deprecated mp4-muxer; same author; TypeScript-native |
| @mediabunny/aac-encoder | (see below) | WASM AAC encoder polyfill for Firefox | Firefox lacks native WebCodecs AAC encoder — this is the official Mediabunny extension |

### mediabunny version
[VERIFIED: npm registry — `npm view mediabunny version` returned `1.40.1`] Current latest stable is `1.40.1`. Package has no dependencies, pure TypeScript, MPL-2.0.

### @mediabunny/aac-encoder
[CITED: mediabunny.dev/guide/extensions/aac-encoder] This is a separate npm package (`@mediabunny/aac-encoder`) that wraps a WASM build of FFmpeg's AAC encoder. Install alongside mediabunny when AAC audio on Firefox is required.

**Installation:**
```bash
npm install mediabunny @mediabunny/aac-encoder
# Remove ffmpeg packages:
npm uninstall @ffmpeg/ffmpeg @ffmpeg/util
```

**Version verification:**
```bash
npm view mediabunny version        # 1.40.1 (verified 2026-04-10)
npm view @mediabunny/aac-encoder version  # verify before installing
```

---

## Architecture Patterns

### Recommended Project Structure (unchanged from quick-260405-s9u)
The stable canvas pattern, codec selection, and seeked-event seeking are all preserved from the prior Mediabunny implementation (commit bd6fdf0). Phase 14 adds the audio pipeline layer on top.

### Pattern 1: AudioBufferSource Pipeline (NEW — audio track)

**What:** Mediabunny's high-level audio source that accepts Web Audio API `AudioBuffer` objects. Auto-timestamps sequential buffers from position 0.

**When to use:** Whenever `hasAudioEnabledVideoLeaf()` returns true and `canEncodeAudio('aac')` succeeds (natively or via polyfill).

```typescript
// Source: mediabunny.dev/api/AudioBufferSource + mediabunny.dev/guide/quick-start
import {
  AudioBufferSource,
  canEncodeAudio,
  QUALITY_HIGH,
} from 'mediabunny';
import { registerAacEncoder } from '@mediabunny/aac-encoder';

// Ensure AAC encoder is available (polyfill Firefox)
if (!(await canEncodeAudio('aac'))) {
  registerAacEncoder();
}

const audioSource = new AudioBufferSource({
  codec: 'aac',
  bitrate: 128_000,  // 128 kbps — matches old ffmpeg -b:a 128k
});
output.addAudioTrack(audioSource);

// After output.start():
await audioSource.add(mixedAudioBuffer);  // single mixed AudioBuffer

// Timestamps are auto-assigned: first buffer starts at 0
```

### Pattern 2: OfflineAudioContext Mixing Pipeline (NEW)

**What:** Decode each audio-enabled video cell's audio via `fetch()` + `decodeAudioData()`, then mix into one `AudioBuffer` using `OfflineAudioContext`.

**Critical constraint:** `MediaElementAudioSourceNode` CANNOT be used with `OfflineAudioContext` — it requires a live `AudioContext`. Use `AudioBufferSourceNode` instead. [VERIFIED: MDN — "MediaElementAudioSourceNode represents an audio source consisting of an HTML <audio> or <video> element" — only works with real-time AudioContext]

```typescript
// Source: MDN BaseAudioContext.decodeAudioData + OfflineAudioContext
async function mixAudioForExport(
  exportVideoElements: Map<string, HTMLVideoElement>,
  mediaRegistry: Record<string, string>,
  audioEnabledMediaIds: Set<string>,
  totalDurationSeconds: number,
): Promise<AudioBuffer | null> {
  if (audioEnabledMediaIds.size === 0) return null;

  const SAMPLE_RATE = 48000;  // Standard AAC sample rate; matches browser decoder output
  const NUM_CHANNELS = 2;     // Stereo

  // Step 1: Decode each video's audio via fetch + decodeAudioData
  // Use a temporary AudioContext for decoding (OfflineAudioContext works too,
  // but we need a real-time one to call decodeAudioData correctly on blob URLs)
  const tempCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
  const decodedBuffers = new Map<string, AudioBuffer>();

  try {
    for (const mediaId of audioEnabledMediaIds) {
      const blobUrl = mediaRegistry[mediaId];
      if (!blobUrl) continue;
      try {
        const response = await fetch(blobUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
        decodedBuffers.set(mediaId, audioBuffer);
      } catch (err) {
        // Individual cell decode failure: skip this cell, log warning
        console.warn('[audio] Failed to decode audio for', mediaId, err);
      }
    }
  } finally {
    await tempCtx.close();
  }

  if (decodedBuffers.size === 0) return null;

  // Step 2: Render mix in OfflineAudioContext
  const totalSamples = Math.ceil(totalDurationSeconds * SAMPLE_RATE);
  const offlineCtx = new OfflineAudioContext(NUM_CHANNELS, totalSamples, SAMPLE_RATE);

  for (const [, audioBuffer] of decodedBuffers) {
    // For each cell, schedule looped playback across totalDuration
    let offset = 0;
    while (offset < totalDurationSeconds) {
      const sourceNode = offlineCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(offlineCtx.destination);
      sourceNode.start(offset);
      // Clamp to totalDuration (AUD-07: audio is clipped to total duration)
      const end = Math.min(offset + audioBuffer.duration, totalDurationSeconds);
      sourceNode.stop(end);
      offset += audioBuffer.duration;
      if (audioBuffer.duration <= 0) break;  // guard against zero-length
    }
  }

  return await offlineCtx.startRendering();
}
```

**Sample rate decision:** 48000 Hz is the standard for AAC in video production and matches what most browser decoders output. Using the same rate as `decodeAudioData`'s source avoids resampling artifacts. [CITED: MDN decodeAudioData — "decoded AudioBuffer is resampled to the AudioContext's sampling rate"]

**Channel count:** 2 (stereo) — standard for video with audio. [ASSUMED]

### Pattern 3: Full exportVideoGrid Control Flow (Phase 14 update)

```typescript
// Pseudocode showing the Phase 14 pipeline structure
export async function exportVideoGrid(..., onProgress): Promise<Blob> {
  // 1. VideoEncoder guard (D-06: hard block)
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('Video export requires WebCodecs. Please use Chrome 94+ or Firefox 130+.');
  }

  onProgress('preparing');

  // 2. Build export video elements (reuse existing buildExportVideoElements)
  const exportVideoElements = await buildExportVideoElements(root, mediaRegistry, mediaTypeMap);

  // 3. Create stable canvas + CanvasSource (D-11)
  const stableCanvas = document.createElement('canvas');
  stableCanvas.width = 1080; stableCanvas.height = 1920;
  
  // 4. Codec selection (D-12)
  const isFirefox = navigator.userAgent.includes('Firefox');
  const videoCodec = isFirefox ? 'vp9' : 'avc';

  // 5. Mediabunny Output setup
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });
  const videoSource = new CanvasSource(stableCanvas, { codec: videoCodec, bitrate: QUALITY_HIGH });
  output.addVideoTrack(videoSource);

  // 6. Audio setup (D-01, D-02, D-03)
  let audioSource: AudioBufferSource | null = null;
  const hasAudio = hasAudioEnabledVideoLeaf(getAllLeaves(root), mediaTypeMap);
  if (hasAudio) {
    try {
      if (!(await canEncodeAudio('aac'))) registerAacEncoder();
      if (await canEncodeAudio('aac')) {
        audioSource = new AudioBufferSource({ codec: 'aac', bitrate: 128_000 });
        output.addAudioTrack(audioSource);
      }
    } catch (err) {
      // D-03: audio failure is non-fatal — export video-only
      audioSource = null;
      // emit warning toast (handled via onProgress or a separate warning callback)
    }
  }

  // 7. output.start() — MUST be called AFTER addVideoTrack and addAudioTrack
  await output.start();

  // 8. Video frame encoding loop (D-11 stable canvas, D-13 seeked-event seeking)
  const totalFrames = Math.ceil(totalDuration * FPS);
  for (let i = 0; i < totalFrames; i++) {
    await seekAllVideosTo(i / FPS, exportVideoElements);
    await renderGridIntoContext(stableCtx, root, mediaRegistry, 1080, 1920, settings, exportVideoElements, imageCache);
    await drawOverlaysToCanvas(stableCtx, overlayState.overlays, overlayState.stickerRegistry, overlayImageCache, true);
    await videoSource.add(i / FPS, 1 / FPS);
    onProgress('encoding', Math.round((i / totalFrames) * 100));
  }

  // 9. Audio mix and encode (runs AFTER video loop — OfflineAudioContext is fast)
  if (audioSource && hasAudio) {
    try {
      const audioEnabledIds = collectAudioEnabledMediaIds(getAllLeaves(root), mediaTypeMap);
      const mixedBuffer = await mixAudioForExport(exportVideoElements, mediaRegistry, audioEnabledIds, totalDuration);
      if (mixedBuffer) {
        await audioSource.add(mixedBuffer);
      }
    } catch (err) {
      console.warn('[audio] Audio mix failed; exporting video-only:', err);
      // D-03: non-fatal
    }
  }

  // 10. Finalize
  await output.finalize();
  destroyExportVideoElements(exportVideoElements);

  return new Blob([target.buffer as ArrayBuffer], { type: 'video/mp4' });
}
```

### Pattern 4: seekAllVideosTo (seeked-event pattern, D-13)

This is carried over from the prior Mediabunny implementation (commit bd6fdf0). The frame-by-frame seek loop replaces MediaRecorder's real-time playback approach:

```typescript
// Source: quick-260405-s9u-SUMMARY.md + CONTEXT.md D-13
async function seekAllVideosTo(
  timeSeconds: number,
  exportVideoElements: Map<string, HTMLVideoElement>,
): Promise<void> {
  const seekPromises: Promise<void>[] = [];
  for (const video of exportVideoElements.values()) {
    seekPromises.push(
      new Promise<void>((resolve) => {
        // Early exit if already at target (guards frame 0, prevents no-fire on same time)
        if (Math.abs(video.currentTime - timeSeconds) < 0.01) {
          resolve();
          return;
        }
        const timeout = setTimeout(resolve, 500);  // D-13: 500ms fallback
        video.addEventListener('seeked', () => { clearTimeout(timeout); resolve(); }, { once: true });
        video.currentTime = timeSeconds;
      }),
    );
  }
  await Promise.all(seekPromises);
}
```

**Key difference from MediaRecorder pipeline:** Instead of playing videos in real time and using setInterval, the Mediabunny pipeline seeks each video to an exact timestamp for each frame. This produces frame-accurate output but is slower than real-time playback (export time ≈ `totalFrames × seekTime + renderTime`).

### Anti-Patterns to Avoid

- **Using `MediaElementAudioSourceNode` with `OfflineAudioContext`:** This is spec-prohibited. Only `AudioBufferSourceNode` works offline.
- **Calling `audioSource.add()` before `output.start()`:** Will throw or silently drop data. Always: addVideoTrack → addAudioTrack → `output.start()` → add() loops → `output.finalize()`.
- **Awaiting between `videoSource.add()` calls without awaiting:** CanvasSource.add() must always be awaited — Mediabunny uses backpressure internally.
- **Accessing `target.buffer` before `output.finalize()`:** Returns null.
- **Encoding AAC without registering the polyfill on Firefox:** `canEncodeAudio('aac')` returns false on Firefox without `@mediabunny/aac-encoder`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio encoding to AAC | Custom AudioEncoder pipeline | `AudioBufferSource` (Mediabunny) | Handles encoding config, timestamping, backpressure, decoderConfig forwarding internally |
| AAC on Firefox | Manual WASM encoder | `@mediabunny/aac-encoder` + `registerAacEncoder()` | Official Mediabunny extension; size-optimized WASM; conditionally loaded |
| Audio mixing | Manual PCM buffer arithmetic | `OfflineAudioContext` + multiple `AudioBufferSourceNode`s | Browser handles resampling, channel mixing, timing; handles duration differences correctly |
| Video frame capture | Manual VideoFrame creation | `CanvasSource.add(timestamp, duration)` | Handles VideoFrame lifecycle, VideoEncoder plumbing, keyframe scheduling |

**Key insight:** Mediabunny's high-level APIs (`CanvasSource`, `AudioBufferSource`) eliminate 90% of the error-prone low-level WebCodecs boilerplate. Only reach for manual `EncodedVideoPacketSource`/`EncodedAudioPacketSource` if custom control is needed — it is not needed for this phase.

---

## Common Pitfalls

### Pitfall 1: MediaElementAudioSourceNode + OfflineAudioContext (BLOCKING)

**What goes wrong:** `new MediaElementAudioSourceNode(offlineCtx, { mediaElement: videoEl })` throws `InvalidStateError` or is silently refused.

**Why it happens:** The Web Audio spec prohibits connecting live HTMLMediaElements to offline contexts — `MediaElementAudioSourceNode` requires a real-time output device path.

**How to avoid:** Use `fetch(blobUrl)` → `response.arrayBuffer()` → `audioContext.decodeAudioData(arrayBuffer)` → `AudioBufferSourceNode` in the `OfflineAudioContext`. The blob URLs from `mediaRegistry` are valid for `fetch()` — they point to in-memory Blobs.

**Warning signs:** `InvalidStateError: Failed to construct 'MediaElementAudioSourceNode'` or TypeError on OfflineAudioContext construction.

### Pitfall 2: Firefox AAC AudioEncoder Not Available

**What goes wrong:** `canEncodeAudio('aac')` resolves to `false` on Firefox without the polyfill. Audio track is silently omitted or throws.

**Why it happens:** Firefox's WebCodecs implementation does not include a native AAC encoder. Only Opus and PCM are natively encodable.

**How to avoid:** Install `@mediabunny/aac-encoder` and call `registerAacEncoder()` when `canEncodeAudio('aac')` returns false. This registers a WASM-based AAC encoder that Mediabunny uses transparently. Then re-check `canEncodeAudio('aac')` — if it still fails, apply D-03 fallback (video-only + warning toast). [CITED: mediabunny.dev/guide/extensions/aac-encoder]

**Warning signs:** Silent video-only export on Firefox without warning toast.

### Pitfall 3: Audio Decode Failure on Video Cells Without Audio Track

**What goes wrong:** `decodeAudioData()` throws or returns a buffer with 0 channels when the video has no audio track (e.g., a silent MP4 or GIF-style video).

**Why it happens:** Not all video files have audio tracks. `decodeAudioData` may fail on video-only files or succeed but return a 0-length buffer.

**How to avoid:** Wrap each per-cell `decodeAudioData()` in try/catch. Skip cells that fail. Check `audioBuffer.numberOfChannels > 0` before scheduling in OfflineAudioContext.

**Warning signs:** OfflineAudioContext render produces silence or throws.

### Pitfall 4: OfflineAudioContext Buffer Size Mismatch

**What goes wrong:** Mixed audio is longer or shorter than the video track, causing A/V sync drift.

**Why it happens:** `OfflineAudioContext` length is specified in samples: `Math.ceil(totalDurationSeconds * sampleRate)`. If sampleRate mismatches the AAC encoder config, the timing diverges.

**How to avoid:** Use the same sampleRate for both `OfflineAudioContext` (48000) and `AudioBufferSource` encoding. Mediabunny will use whatever sampleRate is in the AudioBuffer when encoding. [ASSUMED — verify that AudioBufferSource inherits sampleRate from the AudioBuffer]

### Pitfall 5: addAudioTrack Before output.start() Sequence Error

**What goes wrong:** Calling `output.addAudioTrack(audioSource)` after `output.start()` throws because the output has already started.

**How to avoid:** Strictly follow the sequence:
1. `output.addVideoTrack(videoSource)`
2. `output.addAudioTrack(audioSource)` (if audio enabled)
3. `await output.start()`
4. Frame encoding loop (`videoSource.add()`)
5. Audio mix + `audioSource.add(mixedBuffer)`
6. `await output.finalize()`

[CITED: mediabunny.dev/api/Output — "start() should be called after all tracks have been added"]

### Pitfall 6: Export Performance — Frame-by-Frame Seek is Slow

**What goes wrong:** Export of a 30-second clip at 30fps = 900 seeks. Each seek involves a `seeked` event wait (typically 50–200ms on desktop). Total export time: 45–180 seconds per 30-second clip.

**Why it happens:** Mediabunny's CanvasSource pipeline renders offline (not real-time), so each frame requires an explicit seek to get the video at the correct timestamp.

**How to avoid:** This is unavoidable with the current architecture (frame-accurate offline encode). The old MediaRecorder pipeline played in real time, so export time = clip duration. The new pipeline is slower but produces frame-accurate output. Document the expected export time in user-facing copy if needed. A progress bar is essential (already handled by `onProgress`).

**Warning signs:** No warning needed — this is expected behavior. Log per-frame timing in dev mode if debugging is needed.

### Pitfall 7: Test File References MediaRecorder Guard

**What goes wrong:** The existing test at `src/test/phase04-02-task1.test.tsx:280–323` tests the MediaRecorder mimeType guard (`throws when MediaRecorder does not support required mimeTypes`). After Phase 14, `exportVideoGrid` no longer uses MediaRecorder at all. This test will either pass trivially or fail with a wrong error message.

**How to avoid:** Replace the MediaRecorder test with a WebCodecs VideoEncoder guard test (already done in quick-260405-s9u but then reverted by quick-260410-obm which re-added MediaRecorder). Ensure the test asserts that `exportVideoGrid` throws when `globalThis.VideoEncoder` is undefined.

---

## Code Examples

### AudioBufferSource with AAC — Full Setup
```typescript
// Source: mediabunny.dev/guide/quick-start + mediabunny.dev/api/AudioBufferSource
import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  QUALITY_HIGH,
  canEncodeAudio,
} from 'mediabunny';
import { registerAacEncoder } from '@mediabunny/aac-encoder';

// Conditionally register AAC polyfill (Firefox needs this)
if (!(await canEncodeAudio('aac'))) {
  registerAacEncoder();
}

const target = new BufferTarget();
const output = new Output({ format: new Mp4OutputFormat(), target });

const videoSource = new CanvasSource(stableCanvas, { codec: 'avc', bitrate: QUALITY_HIGH });
const audioSource = new AudioBufferSource({ codec: 'aac', bitrate: 128_000 });

output.addVideoTrack(videoSource);
output.addAudioTrack(audioSource);    // MUST be called before output.start()

await output.start();

// ... video frame loop (videoSource.add(timestamp, duration)) ...

// After video loop: render + encode audio
const mixedBuffer: AudioBuffer = await mixAudioForExport(...);
await audioSource.add(mixedBuffer);   // auto-timestamps from 0

await output.finalize();
const blob = new Blob([target.buffer as ArrayBuffer], { type: 'video/mp4' });
```

### OfflineAudioContext Audio Mix — Minimal Example
```typescript
// Source: MDN OfflineAudioContext + MDN BaseAudioContext.decodeAudioData
async function decodeAndMix(
  blobUrls: string[],
  totalDurationSeconds: number,
): Promise<AudioBuffer> {
  const SAMPLE_RATE = 48000;
  const NUM_CHANNELS = 2;

  // Decode all sources
  const tempCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
  const decoded: AudioBuffer[] = [];
  for (const url of blobUrls) {
    try {
      const ab = await (await fetch(url)).arrayBuffer();
      decoded.push(await tempCtx.decodeAudioData(ab));
    } catch { /* skip failed decode */ }
  }
  await tempCtx.close();

  // Mix in OfflineAudioContext
  const length = Math.ceil(totalDurationSeconds * SAMPLE_RATE);
  const offlineCtx = new OfflineAudioContext(NUM_CHANNELS, length, SAMPLE_RATE);
  for (const buf of decoded) {
    let t = 0;
    while (t < totalDurationSeconds) {
      const node = offlineCtx.createBufferSource();
      node.buffer = buf;
      node.connect(offlineCtx.destination);
      node.start(t);
      node.stop(Math.min(t + buf.duration, totalDurationSeconds));
      t += buf.duration;
      if (buf.duration <= 0) break;
    }
  }
  return await offlineCtx.startRendering();
}
```

### Conditional AAC Polyfill Registration
```typescript
// Source: mediabunny.dev/guide/extensions/aac-encoder (pattern: check then register)
import { canEncodeAudio } from 'mediabunny';
import { registerAacEncoder } from '@mediabunny/aac-encoder';

async function ensureAacEncoder(): Promise<boolean> {
  if (await canEncodeAudio('aac')) return true;
  registerAacEncoder();
  // Re-check after registration
  return await canEncodeAudio('aac');
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MediaRecorder + ffmpeg.wasm transcode | Mediabunny CanvasSource + AudioBufferSource direct MP4 | Phase 14 (Apr 2026) | Removes 25MB WASM CDN dependency and COOP/COEP headers |
| MediaStreamAudioDestinationNode for audio | OfflineAudioContext + AudioBufferSource | Phase 14 | Audio encoded offline (faster than real-time, frame-accurate) |
| Real-time playback + captureStream(0) | Frame-by-frame seek + CanvasSource | quick-260405-s9u (Apr 5) | Frame-accurate but slower export |
| transcodeToMp4.ts (ffmpeg.wasm singleton) | Deleted | Phase 14 | No more CDN dependency |
| `'preparing' | 'encoding' | 'transcoding'` progress stages | `'preparing' | 'encoding'` | Phase 14 | UI simplification |

**Deprecated/outdated in this codebase after Phase 14:**
- `MediaRecorder` (not used for export)
- `captureStream()` (not used)
- `@ffmpeg/ffmpeg`, `@ffmpeg/util` (removed from package.json)
- `src/lib/transcodeToMp4.ts` (deleted)
- COOP/COEP headers in `vercel.json` and `public/_headers` (removed)

---

## Mediabunny Audio API — Resolved Discretion Points

These were marked "Claude's Discretion" in CONTEXT.md:

### Does Mediabunny Expose a Dedicated Audio Source or Require Manual AudioEncoder?

**Answer: Mediabunny exposes `AudioBufferSource` — no manual AudioEncoder needed.**

[VERIFIED: mediabunny.dev/api/AudioBufferSource + mediabunny.dev/guide/quick-start]

`AudioBufferSource` accepts a Web Audio API `AudioBuffer`, handles encoding internally using the configured `AudioEncodingConfig`, and auto-timestamps sequential buffers. The planner should use `AudioBufferSource`, not `EncodedAudioPacketSource` with manual `AudioEncoder`.

### Audio Bitrate

**Answer: Use `128_000` (128 kbps numeric literal).**

[ASSUMED] `QUALITY_HIGH` for audio maps to approximately 192kbps for audio sources based on the library's quality constants — this is higher than necessary for voice/music mix in a video collage. The previous ffmpeg pipeline used `-b:a 192k`. Using `128_000` (128 kbps) is standard for AAC stereo at 48kHz and matches iTunes/YouTube baseline. The planner may prefer `QUALITY_HIGH` if exact value is unimportant.

### OfflineAudioContext Sample Rate and Channel Layout

**Answer: 48000 Hz, 2 channels (stereo).**

[ASSUMED — standard for AAC in MP4; matches most browser decoder output sampleRate]

48000 Hz is the standard sample rate for AAC in video production. Browser `decodeAudioData()` resamples decoded audio to match the AudioContext's sampleRate — using 48000 avoids a second resample step if the source is already 48kHz. Stereo (2 channels) covers the common case. [CITED: MDN decodeAudioData — "decoded AudioBuffer is resampled to the AudioContext's sampling rate"]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | OfflineAudioContext sample rate 48000 Hz is correct for AAC encoding via AudioBufferSource | Architecture Patterns, Mediabunny Audio API Resolved | If Mediabunny's AudioEncoder requires a specific sampleRate, encoded audio might be pitched/timed incorrectly. Mitigation: verify `canEncodeAudio('aac', { sampleRate: 48000, numberOfChannels: 2 })` returns true. |
| A2 | Audio mix can happen after the video frame loop (sequential, not interleaved) | Architecture Patterns | If Mediabunny requires interleaved A/V samples for correct muxing, final MP4 may have A/V sync drift. LOW risk: AudioBufferSource auto-timestamps from 0, matching video track start. |
| A3 | `fetch(blobUrl)` works for video blob URLs in the browser | Architecture Patterns | If same-origin policy blocks fetch of blob URLs, the audio decode step would fail entirely. LOW risk: `URL.createObjectURL` produces blob URLs that are same-origin fetchable in all modern browsers. |
| A4 | `@mediabunny/aac-encoder` latest version is compatible with mediabunny@1.40.1 | Standard Stack | Version mismatch could cause runtime errors. Mitigation: check version before installing. |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| mediabunny | CanvasSource + AudioBufferSource | Not yet installed (removed in obm) | — | Install |
| @mediabunny/aac-encoder | AAC on Firefox | Not installed | — | D-03: video-only export |
| @ffmpeg/ffmpeg | transcodeToMp4.ts (to be deleted) | Installed (to remove) | ^0.12.15 | Remove |
| @ffmpeg/util | transcodeToMp4.ts (to be deleted) | Installed (to remove) | ^0.12.2 | Remove |
| VideoEncoder (WebCodecs) | Video encoding | Chrome 94+, Firefox 130+ | — | Hard block (D-06) |
| AudioEncoder (WebCodecs native) | AAC audio (Chrome) | Chrome 94+ | — | @mediabunny/aac-encoder polyfill |
| OfflineAudioContext | Audio mixing | All target browsers | — | — |

**Missing dependencies that block execution:**
- `mediabunny` must be reinstalled (was removed by quick-260410-obm)

**Missing dependencies with fallback:**
- `@mediabunny/aac-encoder` — D-03 covers video-only fallback if not available or not working

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | vite.config.ts (inferred) / vitest.config.ts |
| Quick run command | `npx vitest run src/test/phase04-02-task1.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-06 | exportVideoGrid throws when VideoEncoder unavailable | unit | `npx vitest run src/test/phase04-02-task1.test.tsx` | ✅ (needs update — currently tests MediaRecorder guard) |
| D-03 | exportVideoGrid exports video-only when AudioEncoder unavailable | unit | `npx vitest run src/test/phase04-02-task1.test.tsx` | ❌ Wave 0 |
| AUD-06 | No audio track when zero cells have audioEnabled=true | unit | `npx vitest run src/test/phase04-02-task1.test.tsx` | ❌ Wave 0 |
| D-14 | onProgress never emits 'transcoding' stage | unit | `npx vitest run src/test/phase04-02-task1.test.tsx` | ❌ Wave 0 |
| Toast | 'transcoding' state removed from ToastState union | unit | `npx vitest run src/test/phase04-02-task1.test.tsx` | ✅ (existing Toast tests will fail until transcoding removed) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/test/phase04-02-task1.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Update existing MediaRecorder guard test → VideoEncoder guard test
- [ ] Add test: `exportVideoGrid` emits `onProgress('encoding', ...)` — never `'transcoding'`
- [ ] Add test: when `VideoEncoder` is undefined, exportVideoGrid throws with browser-upgrade message
- [ ] Add test: `AudioEncoder` unavailable path emits video-only + no crash (D-03)

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | No user-provided codec strings or frame data — all internal |
| V6 Cryptography | no | — |

No security-sensitive surfaces introduced by this phase. The audio pipeline reads from blob URLs already in `mediaRegistry` (user-uploaded content, already loaded). No new external network requests beyond what's already present.

Note: Removing COOP/COEP headers (D-10) is a **security reduction** — these headers provide cross-origin isolation. However, they were added solely for SharedArrayBuffer (required by ffmpeg.wasm). With WebCodecs + Mediabunny, SharedArrayBuffer is not used. Removing COOP/COEP restores normal embedding behavior (iframes, cross-origin resources), which is correct for this zero-backend app. [CITED: CONTEXT.md D-10]

---

## Open Questions (RESOLVED)

1. **Does `AudioBufferSource.add()` need to be called before `output.finalize()`?**
   - **RESOLVED:** Yes — per Mediabunny docs, `output.finalize()` must be called after all samples have been added across all registered tracks. An empty audio track would cause undefined behavior. **Plan: If audio fails (D-03), skip `addAudioTrack` entirely — do NOT register an audio track and then leave it empty.**

2. **What is the exact `@mediabunny/aac-encoder` package version to install?**
   - **RESOLVED:** Install without a version pin (`@mediabunny/aac-encoder`) to get the latest compatible version at install time. Plan 14-01 Task 1 executor should run `npm view @mediabunny/aac-encoder version` first and pin the resolved version in the install command (e.g. `@mediabunny/aac-encoder@^1.0.0`). The `npm install` will record the resolved version in package-lock.json.

3. **Is `canEncodeAudio('aac')` reliable on Chrome desktop Linux?**
   - **RESOLVED:** The `canEncodeAudio('aac')` → `registerAacEncoder()` → re-check pattern handles this transparently. The WASM polyfill from `@mediabunny/aac-encoder` covers Chrome desktop Linux. If both checks fail, apply D-03 video-only fallback. No special-casing needed for Linux.

---

## Sources

### Primary (HIGH confidence)
- [Mediabunny official docs — mediabunny.dev](https://mediabunny.dev) — Output, BufferTarget, CanvasSource
- [Mediabunny AudioBufferSource API](https://mediabunny.dev/api/AudioBufferSource) — constructor, add() method, auto-timestamping
- [Mediabunny Media Sources guide](https://mediabunny.dev/guide/media-sources) — AudioBufferSource, AudioSampleSource, EncodedAudioPacketSource with full signatures
- [Mediabunny Writing Media Files guide](https://mediabunny.dev/guide/writing-media-files) — addAudioTrack usage, canvas + microphone example
- [Mediabunny Quick Start](https://mediabunny.dev/guide/quick-start) — CanvasSource + AudioBufferSource combined example
- [Mediabunny Supported Formats](https://mediabunny.dev/guide/supported-formats-and-codecs) — AAC codec short name `'aac'` for MP4
- [Mediabunny @mediabunny/aac-encoder](https://mediabunny.dev/guide/extensions/aac-encoder) — WASM AAC polyfill for Firefox, registerAacEncoder pattern
- [MDN BaseAudioContext.decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData) — fetch(blobUrl) → arrayBuffer() → decodeAudioData pattern
- [MDN OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext) — MediaElementAudioSourceNode incompatibility, startRendering()
- [Mediabunny Output API](https://mediabunny.dev/api/Output) — addVideoTrack/addAudioTrack signature, start()/finalize() contract

### Secondary (MEDIUM confidence)
- [npm view mediabunny version] — 1.40.1 confirmed at research time (2026-04-10)
- [WebCodecs API Can I Use](https://caniuse.com/webcodecs) — Firefox 133+ WebCodecs support confirmed
- [MDN AudioEncoder compatibility] — "Limited availability" flag; Firefox support via general WebCodecs support from FF130+

### Tertiary (LOW confidence / community reports)
- [w3c/webcodecs issue #259](https://github.com/w3c/webcodecs/issues/259) — AAC encoding discussion, Firefox limitation pattern
- Community reports: Firefox WebCodecs AudioEncoder requires explicit AAC polyfill; Opus is the natively supported codec

---

## Metadata

**Confidence breakdown:**
- Standard stack (mediabunny version, AudioBufferSource API): HIGH — verified against official docs
- Architecture (OfflineAudioContext mixing pipeline): HIGH — MDN spec + verified MediaElementAudioSourceNode limitation
- Audio/Firefox compatibility: MEDIUM — canEncodeAudio + @mediabunny/aac-encoder pattern is documented; Firefox behavior confirmed via community reports
- Sample rate / channel defaults: ASSUMED — standard values, low risk

**Research date:** 2026-04-10
**Valid until:** ~2026-05-10 (Mediabunny actively developed; Firefox WebCodecs audio support may improve)
