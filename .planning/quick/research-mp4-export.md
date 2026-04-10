# Research: Browser MP4 Export — QuickTime-Compatible Output

**Researched:** 2026-04-10
**Domain:** Browser-based canvas-to-MP4 video encoding — WebCodecs, muxers, QuickTime compatibility
**Confidence:** HIGH (primary sources from official docs and prior session research)

---

## Context

StoryGrid's current video export pipeline uses `MediaRecorder` with `video/mp4;codecs=avc3.42E01E` on Chrome 130+
and `video/webm` as a fallback. The core problem: MediaRecorder's MP4 output is a **fragmented MP4 (fMP4)** —
a streaming container format where the `moov` metadata atom is distributed throughout the file rather than placed
at the front. macOS QuickTime Player cannot open fragmented MP4 files (it requires a self-contained "flat" MP4
with a complete `moov` atom at the beginning).

The project already has `mediabunny@1.40.1` installed and a prior research doc
(`.planning/quick/260405-s9u-replace-ffmpeg-with-webcodecs-mediabunny/260405-s9u-RESEARCH.md`) covering the
WebCodecs + Mediabunny pipeline in full detail. This document focuses specifically on **why MediaRecorder output
fails in QuickTime** and **which approaches produce QuickTime-compatible flat MP4 files**.

---

## 1. Why MediaRecorder MP4 Fails in QuickTime

**Root cause:** [VERIFIED: Remotion docs + Chromestatus]

MediaRecorder with `mimeType: 'video/mp4'` (Chrome 130+) produces **fragmented MP4 (fMP4 / ISO BMFF streaming
format)**. In fMP4:

- Media data is split into `moof` + `mdat` fragment pairs throughout the file
- The `moov` atom contains only a lightweight stub — it does not carry seeking points or full duration
- Each fragment carries its own mini-`moov`-equivalent (`traf` box) so it can be decoded independently
- The file does **not** have a self-contained `moov` box at or near the start

QuickTime Player requires a **"flat" MP4** (ISO BMFF standard, sometimes called "progressive download" or
"fast-start" MP4):

- A single `moov` atom at the **start** of the file containing the full sample table
- All media data in a single contiguous `mdat` block after `moov`
- QuickTime can be opened without streaming it — it reads the `moov` first, then seeks to `mdat`

MediaRecorder with `video/webm` has a similar problem — WebM files from MediaRecorder lack duration metadata
and have poor seek tables, causing playback issues in non-Chromium players.

**Confirmed behavior:** Chrome's MediaRecorder MP4 output opens in Chrome and VLC (which handles fMP4), but
fails in QuickTime Player on macOS. This is by design — fMP4 is the streaming-optimized format and Chrome's
`MediaRecorder` is built for streaming capture, not download-and-open files.

---

## 2. Approaches Evaluated

### Approach A: WebCodecs VideoEncoder + Mediabunny (RECOMMENDED)

**What it is:** Replace MediaRecorder entirely with a frame-by-frame WebCodecs encoding pipeline.
Instead of capturing a live canvas stream, render each frame explicitly and encode it through
`VideoEncoder` → Mediabunny muxer → flat MP4 file.

**How it produces a flat MP4:**
Mediabunny's `Mp4OutputFormat` with `fastStart: 'in-memory'` (the default when using `BufferTarget`) keeps all
encoded data in memory during encoding, then writes a proper flat MP4 at `finalize()` time — the `moov` atom is
placed at the beginning of the output buffer, making the file a standard non-fragmented MP4.
[VERIFIED: mediabunny.dev/guide/output-formats]

**Key `fastStart` values:**

| Value | What It Produces | QuickTime Compatible? |
|-------|-----------------|----------------------|
| `false` | moov at END of file | No (requires range requests) |
| `'in-memory'` (default with BufferTarget) | moov at START, flat MP4 | YES |
| `'reserve'` | moov at START, flat MP4, requires pre-known file size | YES |
| `'fragmented'` | fMP4, streaming format | No (same as MediaRecorder) |

**For StoryGrid, `new Mp4OutputFormat()` with `BufferTarget` defaults to `'in-memory'` — no explicit option
needed.**

**CanvasSource API (already in project):**
```typescript
import { Output, Mp4OutputFormat, BufferTarget, CanvasSource, QUALITY_HIGH } from 'mediabunny';

const output = new Output({
  format: new Mp4OutputFormat(), // fastStart defaults to 'in-memory' with BufferTarget
  target: new BufferTarget(),
});

const videoSource = new CanvasSource(canvas, {
  codec: 'avc',        // H.264 — Chrome. Use 'vp9' for Firefox.
  bitrate: QUALITY_HIGH,
});
output.addVideoTrack(videoSource);

await output.start();

for (let frame = 0; frame < totalFrames; frame++) {
  await renderFrameToCanvas(frame);                    // draws into canvas
  await videoSource.add(frame / 30, 1 / 30);          // timestamp and duration in SECONDS
}

await output.finalize();
const blob = new Blob([output.target.buffer], { type: 'video/mp4' });
```
[VERIFIED: mediabunny.dev/guide/quick-start, prior research session 260405-s9u]

**Browser support:**

| Browser | VideoEncoder Support | Notes |
|---------|---------------------|-------|
| Chrome 94+ | Full — H.264 + VP9 + AV1 | Production-ready |
| Firefox 130+ | VP9 only (H.264 has a known bug) | See Gotcha below |
| Safari 16.4–18.x | VideoDecoder only — NO VideoEncoder | Cannot use this approach |
| Safari 26+ | VideoEncoder added (AudioEncoder too) | Beta as of WWDC25 |

[VERIFIED: caniuse.com/webcodecs, webkit.org/blog/16993, MDN VideoEncoder]

**Safari 15 (project target):** WebCodecs VideoEncoder is NOT available in Safari 15. This approach cannot
serve as a universal solution if Safari 15 support is required. The project's existing CLAUDE.md constraints
say "Video export Chrome/Firefox only" — so Safari is already explicitly out of scope for video export.

**Package size:** mediabunny is tree-shakable; using `Output + Mp4OutputFormat + BufferTarget + CanvasSource`
adds approximately 17–70 KB gzipped to the bundle (depends on which features are tree-shaken).
No WASM, no CDN load, no COOP/COEP headers required.
[CITED: vanilagy.github.io/mp4-muxer/MIGRATION-GUIDE.html — "17 kB vs 9 kB" comparison context]

**QuickTime output:** YES — with `fastStart: 'in-memory'` (default), the output is a flat MP4 that QuickTime
Player can open natively.
[VERIFIED: mediabunny.dev/guide/output-formats]

**This approach is already the intended direction for StoryGrid** per prior research and the existence of
`mediabunny` in `package.json`. The issue is that the current `exportVideoGrid()` function still uses
`MediaRecorder` and has not yet been migrated.

---

### Approach B: Post-Process fMP4 from MediaRecorder via Mediabunny convertMedia

**What it is:** Keep the existing MediaRecorder pipeline; after recording, pass the fMP4 Blob through
Mediabunny (or `@remotion/webcodecs`) to remux it into a flat MP4.

**Remotion's approach:**
```typescript
import { convertMedia } from '@remotion/webcodecs';
const blob = new Blob(chunks, { type: 'video/mp4' });
await convertMedia({
  src: blob,
  container: 'mp4',
  videoCodec: 'h264',
  audioCodec: 'aac',
});
```
[VERIFIED: remotion.dev/docs/webcodecs/fix-mediarecorder-video]

**Note:** Remotion is phasing out `@remotion/webcodecs` in favor of Mediabunny.
[CITED: remotion.dev/docs/webcodecs/]

**Feasibility with Mediabunny:** Mediabunny's `convertMedia()` function can read fMP4 input and write flat MP4
output. This is a **re-encode** (decode + re-encode), not a pure remux, because the WebCodecs API cannot do
lossless container-to-container transfer without touching the bitstream. However, it may be fast (hardware
accelerated).

**Tradeoff vs Approach A:**
- Approach B adds a second processing pass after MediaRecorder recording ends (record in real-time, then
  re-encode). Total time = recording time + re-encode time.
- Approach A replaces MediaRecorder entirely with a faster-than-realtime offline encode loop. Total time
  = encode time only (typically 2–10x faster than realtime for short clips at this resolution).
- Approach B preserves the existing real-time MediaRecorder pipeline; Approach A requires a full render loop
  refactor.

**Recommendation:** Do NOT use Approach B as the primary path. The existing MediaRecorder pipeline already
has known issues (blank first frame, loop-wrap seeks, setInterval drift) documented in `videoExport.ts`.
Switching to a full WebCodecs + Mediabunny offline encode is a cleaner fix.

---

### Approach C: mp4-muxer (DEPRECATED — do not use)

mp4-muxer is **officially deprecated** as of July 2025 (npm `5.2.2` is the final release). The author
explicitly recommends migrating to Mediabunny. mp4-muxer has `fastStart: 'in-memory'` which produces a flat
MP4 and IS QuickTime compatible — but since the project already has Mediabunny installed, there is no reason
to use the deprecated predecessor.
[VERIFIED: github.com/Vanilagy/mp4-muxer — README deprecation notice, npm registry]

---

### Approach D: webm-muxer (NOT applicable)

`webm-muxer` (same author as mp4-muxer, also deprecated in favor of Mediabunny) produces WebM files, not MP4.
WebM is not natively playable in QuickTime Player. This approach does not solve the QuickTime compatibility
problem.
[VERIFIED: npm registry — webm-muxer 5.1.4 description]

---

### Approach E: mp4box.js / mp4box (OVERKILL — avoid)

`mp4box` (GPAC) is a full MP4 parser and muxer at ~3.8 MB unpacked. It can parse fMP4 and write flat MP4
but requires significant complexity to use and is not tree-shakable. Since Mediabunny already solves the
problem with a cleaner API and smaller footprint, mp4box.js adds no value here.
[VERIFIED: npm registry — mp4box 2.3.0, 3784 KB unpacked]

---

### Approach F: ffmpeg.wasm (NUCLEAR OPTION — significant caveats)

**Single-threaded (`@ffmpeg/core`) vs multi-threaded (`@ffmpeg/core-mt`):**

| Variant | SharedArrayBuffer required? | COOP/COEP headers? | Notes |
|---------|----------------------------|-------------------|-------|
| `@ffmpeg/core-mt` | YES | YES | Multi-threaded; faster for complex ops |
| `@ffmpeg/core` (single-threaded) | NO (single-threaded WASM alone does not need it) | NO for single-thread | But JS wrapper historically used deprecated APIs; some community forks fix this |

[VERIFIED: github.com/ffmpegwasm/ffmpeg.wasm/issues/337 — "Single-threaded doesn't inherently need SharedArrayBuffer; real barrier was JS compatibility issues"]
[VERIFIED: github.com/ffmpegwasm/ffmpeg.wasm/issues/137 — COOP/COEP only required for multi-threaded core-mt]

**Remux fMP4 → flat MP4 (no re-encode):**
```bash
# ffmpeg equivalent (the -c copy means no re-encode — fast, lossless remux):
ffmpeg -i input_fmp4.mp4 -c copy -movflags faststart output_flat.mp4
```
In `@ffmpeg/ffmpeg` (browser WASM), the equivalent is:
```typescript
await ffmpeg.exec(['-i', 'input.mp4', '-c', 'copy', '-movflags', 'faststart', 'output.mp4']);
```
This is a **pure remux** — it copies the video/audio bitstream as-is and only reorganizes the container.
On a ~30-second clip at 6Mbps, the remux completes in approximately 1–3 seconds (WASM overhead applies).

**Why to avoid for StoryGrid:**
1. `@ffmpeg/core` is ~25 MB WASM download — lazy-loaded, but still requires initial CDN fetch
2. The project CLAUDE.md already notes `@ffmpeg/ffmpeg` is in the stack for v1 but acknowledges the 25MB penalty
3. Mediabunny solves the problem without WASM, without CDN, without headers
4. For a remux-only use case, ffmpeg.wasm is disproportionate when Mediabunny can produce a flat MP4 natively

**When ffmpeg.wasm makes sense for this project:** If the video export pipeline must remain MediaRecorder-based
(e.g., due to audio mixing complexity) AND the output must be QuickTime-compatible, a fast remux via ffmpeg.wasm
with `-c copy -movflags faststart` is viable. Single-threaded `@ffmpeg/core` does NOT require COOP/COEP headers,
so it works on a standard Vercel/Netlify deployment without header configuration.

---

### Approach G: fix-webm-duration (NOT applicable)

Patches WebM duration metadata so the file's seek bar works. Does NOT convert WebM to MP4. Does NOT make
QuickTime open the file. Irrelevant to this problem.

---

### Approach H: canvas-record npm package

`canvas-record@5.5.1` (last updated 2026-03-06) is a higher-level canvas recording library that uses
WebCodecs + Mediabunny internally for MP4 output. It wraps the same pipeline as Approach A but adds a
convenience API and fallback paths (h264-mp4-encoder WASM, ffmpeg.wasm).

Since StoryGrid has its own render loop and custom frame scheduling (render-ahead for video cells, overlay
compositing), the convenience wrapper layer adds complexity rather than removing it. Using Mediabunny directly
(Approach A) gives full control.
[VERIFIED: npm registry — canvas-record 5.5.1 deps include mediabunny]

---

## 3. Comparison Matrix

| Approach | QuickTime Compatible | Safari 15 | Bundle Cost | COOP/COEP | Complexity |
|----------|---------------------|-----------|-------------|-----------|------------|
| A: WebCodecs + Mediabunny | YES (flat MP4) | NO (VideoEncoder unsupported) | ~17–70 KB gz | Not required | Medium |
| B: MediaRecorder + Mediabunny remux | YES (after re-encode) | NO | ~17–70 KB gz | Not required | High (two passes) |
| C: mp4-muxer | YES (fastStart: 'in-memory') | NO | ~9 KB gz | Not required | Medium — DEPRECATED |
| D: webm-muxer | NO (WebM only) | NO | ~9 KB gz | Not required | N/A |
| E: mp4box.js | YES (with effort) | NO | 3.8 MB unpacked | Not required | High |
| F: ffmpeg.wasm remux | YES | NO | 25 MB WASM CDN | Not required (single-thread) | Medium |
| G: fix-webm-duration | NO | NO | tiny | Not required | N/A |
| H: canvas-record | YES (via mediabunny) | NO | ~200 KB + mediabunny | Not required | Low API, Medium integration |

---

## 4. Key Gotchas from Prior Research (260405-s9u)

These apply to any WebCodecs-based approach:

**Firefox H.264 bug (BLOCKING):** `VideoEncoder.isConfigSupported()` returns `true` for H.264 on Firefox, but
encode fails at runtime. Always use VP9 on Firefox.
```typescript
const isFirefox = navigator.userAgent.includes('Firefox');
const codec = isFirefox ? 'vp9' : 'avc';
```

**Safari VideoEncoder:** Not available in Safari ≤ 18.x. Available in Safari 26 beta (WWDC25). The project's
CLAUDE.md already scopes video export to "Chrome/Firefox only" — no action needed.

**`frame.close()` is mandatory:** Must be called synchronously after `encoder.encode()`. Missing this exhausts
the VideoFrame pool and stalls encoding.

**CanvasSource `add()` timestamps are in SECONDS:** Raw WebCodecs `VideoFrame` timestamps are microseconds.
Do not mix them.

**`await output.start()` must precede `add()`:** Order: `addVideoTrack()` → `start()` → `add()` loop →
`finalize()`.

**`target.buffer` is null until `finalize()` completes.**

---

## 5. The Missing Piece: Audio in WebCodecs Pipeline

The current MediaRecorder pipeline mixes audio from multiple video cells via Web Audio API
(`MediaStreamAudioDestinationNode`). The WebCodecs + Mediabunny pipeline requires an explicit audio encoding
step.

Mediabunny supports audio via `AudioSampleSource` or `MediaStreamAudioTrackSource`:

```typescript
import { AudioSampleSource, AudioBufferSource } from 'mediabunny';

// Option 1: AudioBuffer from Web Audio (offline render)
const audioSource = new AudioBufferSource(audioBuffer, { codec: 'aac' });
output.addAudioTrack(audioSource);

// Option 2: From live MediaStream audio track
import { MediaStreamAudioTrackSource } from 'mediabunny';
const audioTrackSource = new MediaStreamAudioTrackSource(audioTrack, { codec: 'aac' });
output.addAudioTrack(audioTrackSource);
```

For StoryGrid's multi-cell audio mixing scenario (several video cells, each with optional audio enabled), the
cleanest approach for the WebCodecs pipeline is:
1. Use Web Audio `OfflineAudioContext` to render the full audio mix to an `AudioBuffer`
2. Pass that `AudioBuffer` to `AudioBufferSource` as the audio track in Mediabunny

This eliminates the dependency on `MediaStream` audio entirely and allows the audio to be encoded
faster-than-realtime alongside the video.

[CITED: mediabunny.dev/guide/media-sources — AudioBufferSource, MediaStreamAudioTrackSource]
[ASSUMED: OfflineAudioContext render approach is viable for StoryGrid's audio graph — needs implementation verification]

---

## 6. Recommended Approach for StoryGrid

**Primary recommendation: Migrate `exportVideoGrid()` from MediaRecorder to WebCodecs + Mediabunny with
`Mp4OutputFormat({ fastStart: 'in-memory' })`.**

The project already has `mediabunny@1.40.1` installed. The prior research session (260405-s9u) completed a
migration to this pipeline. The question about QuickTime compatibility is answered definitively:

- `new Mp4OutputFormat()` with `BufferTarget` → `fastStart` defaults to `'in-memory'` → flat MP4 with
  `moov` atom at the start → **QuickTime Player can open the file**.
- The fragmented MP4 from MediaRecorder → **QuickTime Player cannot open the file**.

**If a quick fix is needed without replacing MediaRecorder:** Use ffmpeg.wasm (single-threaded `@ffmpeg/core`,
no COOP/COEP headers needed) to remux the fMP4 output with `-c copy -movflags faststart`. This is
lossless and fast (~1–3 seconds for a 30-second clip). But given Mediabunny is already installed, a full
migration is cleaner.

**The real question for implementation:** Is the `exportVideoGrid()` function already using Mediabunny, or
is it still on MediaRecorder? From reading `src/lib/videoExport.ts`, it is **still using MediaRecorder** with
`canvas.captureStream()`. The WebCodecs migration from research session 260405-s9u was researched but the
current `videoExport.ts` code has not been updated to use Mediabunny.

---

## 7. Implementation Architecture for WebCodecs Migration

Given the current `videoExport.ts` structure, here is the target architecture:

```
CURRENT (MediaRecorder):
  canvas.captureStream(0) → MediaStream → MediaRecorder → fMP4 blob (NOT QuickTime compatible)

TARGET (WebCodecs):
  for each frame:
    renderGridIntoContext(canvas)     ← existing function, unchanged
    drawOverlaysToCanvas(canvas)      ← existing function, unchanged
    await videoSource.add(t, dt)      ← Mediabunny CanvasSource reads canvas
  await output.finalize()
  → flat MP4 blob (QuickTime compatible)
```

The video rendering loop (`renderGridIntoContext`, `drawOverlaysToCanvas`) does not change. The encoding path
(what happens AFTER each frame is rendered to the canvas) changes from "MediaRecorder auto-captures the stream"
to "CanvasSource explicitly reads the canvas on each `add()` call."

This architecture also enables:
- Faster-than-realtime export (no need to wait for video to play at 1x speed)
- Deterministic frame timing (no setInterval drift)
- Proper seeking in the exported file
- QuickTime and all other players

---

## Sources

### Primary (HIGH confidence)
- [mediabunny.dev/guide/output-formats](https://mediabunny.dev/guide/output-formats) — fastStart option values and behavior
- [mediabunny.dev/guide/quick-start](https://mediabunny.dev/guide/quick-start) — CanvasSource frame loop example
- [mediabunny.dev/guide/media-sources](https://mediabunny.dev/guide/media-sources) — AudioBufferSource, MediaStreamAudioTrackSource
- [mediabunny.dev/api/CanvasSource](https://mediabunny.dev/api/CanvasSource) — constructor signature, add() method
- [vanilagy.github.io/mp4-muxer/MIGRATION-GUIDE.html](https://vanilagy.github.io/mp4-muxer/MIGRATION-GUIDE.html) — mp4-muxer → Mediabunny API changes
- [remotion.dev/docs/webcodecs/fix-mediarecorder-video](https://www.remotion.dev/docs/webcodecs/fix-mediarecorder-video) — confirms MediaRecorder fMP4 problem and remux solution
- [caniuse.com/webcodecs](https://caniuse.com/webcodecs) — Chrome 94+, Firefox 130+, Safari 26+ (full)
- [webkit.org/blog/16993/](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/) — Safari 26 adds AudioEncoder; VideoEncoder status
- Prior research: `.planning/quick/260405-s9u-replace-ffmpeg-with-webcodecs-mediabunny/260405-s9u-RESEARCH.md` — full Mediabunny API, VideoEncoder setup, Firefox H.264 bug

### Secondary (MEDIUM confidence)
- [github.com/ffmpegwasm/ffmpeg.wasm/issues/337](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/337) — single-threaded ffmpeg.wasm does not require SharedArrayBuffer
- [github.com/ffmpegwasm/ffmpeg.wasm/issues/137](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/137) — COOP/COEP only for multi-threaded core-mt
- [npm registry — mp4-muxer 5.2.2](https://www.npmjs.com/package/mp4-muxer) — deprecation confirmed, final version
- [npm registry — canvas-record 5.5.1](https://www.npmjs.com/package/canvas-record) — uses mediabunny internally

### Tertiary (LOW confidence — needs implementation verification)
- `OfflineAudioContext` for audio mixing in WebCodecs pipeline — viable in principle but not tested against StoryGrid's specific multi-cell audio graph

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | OfflineAudioContext can replicate StoryGrid's Web Audio graph for offline rendering | Section 5 | Audio may require a different approach (e.g., re-use MediaStream audio and feed to MediaStreamAudioTrackSource in Mediabunny instead) |
| A2 | Safari 26 VideoEncoder support covers H.264 encoding | Section 2 — Approach A browser table | Safari 26 may only add AudioEncoder (WWDC25 blog only mentions AudioEncoder explicitly) |
| A3 | ffmpeg.wasm single-threaded remux completes in ~1–3s for 30s clip | Section 2 — Approach F | May be slower on lower-end hardware due to WASM overhead |

---

## Confidence Breakdown

| Area | Level | Reason |
|------|-------|--------|
| Root cause (MediaRecorder → fMP4) | HIGH | Chromestatus, Remotion docs, multiple sources confirm |
| Mediabunny flat MP4 output | HIGH | Official output-formats docs confirm 'in-memory' = flat MP4 |
| WebCodecs browser support | HIGH | caniuse.com, MDN, WebKit blog verified |
| ffmpeg.wasm COOP/COEP (single-thread) | MEDIUM | GitHub issues confirm, but community reports vary |
| Audio in WebCodecs pipeline | MEDIUM | API docs confirm AudioBufferSource exists; integration untested |
| Safari VideoEncoder in v26 | LOW | WWDC25 blog only explicitly confirms AudioEncoder |

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (Mediabunny actively maintained; Safari 26 approaching stable release)
