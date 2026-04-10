# Phase 14: Migrate Video Export from MediaRecorder+ffmpeg.wasm to Mediabunny — Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the two-stage video export pipeline (MediaRecorder → WebM → ffmpeg.wasm → MP4) with Mediabunny's frame-by-frame WebCodecs-based direct MP4 encoding. This phase delivers a complete migration including audio support — no ffmpeg.wasm, no CDN dependency, no COOP/COEP headers required.

**What is in scope:**
- Replace `src/lib/videoExport.ts` MediaRecorder+ffmpeg.wasm logic with Mediabunny CanvasSource pipeline
- Audio: WebCodecs AudioEncoder (AAC) + Mediabunny audio track (full parity with AUD-05..07)
- Full removal of `@ffmpeg/ffmpeg`, `@ffmpeg/util`, and `transcodeToMp4.ts`
- Remove COOP/COEP headers from `vercel.json` and `public/_headers`
- Update progress stages (remove 'transcoding' stage, as transcode step no longer exists)
- Update Toast and ExportSplitButton for the new stage model

**What is NOT in scope:**
- Any new audio features beyond AUD-05..07 parity
- Project persistence (PERS-01..12 deferred to a future phase)
- Changes to PNG export pipeline

</domain>

<decisions>
## Implementation Decisions

### Audio Encoding
- **D-01:** Use WebCodecs `AudioEncoder` with **AAC (mp4a.40.2)** codec to encode the mixed audio track. No ffmpeg.wasm for audio.
- **D-02:** Audio mixing uses `OfflineAudioContext` + `AudioBufferSourceNode` per video cell, then `AudioEncoder` encodes the rendered output. This replaces the MediaRecorder `MediaStreamAudioDestinationNode` approach.
- **D-03:** If `AudioEncoder` is unavailable or audio decoding fails, export **video-only with a warning toast** ("Audio not supported in this browser — exporting video only"). No hard block on audio failure.
- **D-04:** AAC chosen over Opus: better QuickTime/iOS compatibility in MP4 containers; Opus-in-MP4 is non-standard.

### Scope
- **D-05:** Phase 14 ships **full migration in one shot** — video encoding + audio encoding + cleanup. No temporary regression for audio users. No split into 14 + 14.1.

### Fallback Strategy
- **D-06:** If `VideoEncoder` (WebCodecs) is unavailable: **hard block** with a browser upgrade message. The export button is disabled. Consistent with the existing guard added in quick-260405-s9u. No dual-pipeline maintenance.
- **D-07:** No fallback to MediaRecorder+ffmpeg.wasm — maintaining two pipelines is not worth the complexity.

### Cleanup
- **D-08:** Remove `@ffmpeg/ffmpeg` and `@ffmpeg/util` from `package.json` entirely.
- **D-09:** Delete `src/lib/transcodeToMp4.ts`.
- **D-10:** Remove COOP/COEP headers (`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`) from `vercel.json` and `public/_headers`. WebCodecs + Mediabunny do not require SharedArrayBuffer.

### Preserved Patterns from Prior Work (quick-260405-s9u)
- **D-11:** **Stable canvas pattern** — create one persistent 1080×1920 canvas before `output.start()`, pass to `CanvasSource`; for each frame: render via `renderGridToCanvas()` into temp canvas, copy via `drawImage` onto the stable canvas, then call `videoSource.add(timestamp, duration)`.
- **D-12:** **Codec selection** — VP9 on Firefox (Bugzilla #1918769: H.264 VideoEncoder throws DOMException at encode() despite isConfigSupported() returning true); AVC (H.264) on all other browsers.
- **D-13:** **`seeked`-event seeking** — seek video elements using the `seeked` event for frame accuracy, with a 500ms safety timeout fallback.

### Progress UX
- **D-14:** Progress stages become: `'preparing' | 'encoding'` (remove `'transcoding'` stage — the two-stage pipeline is gone).
- **D-15:** Update Toast and ExportSplitButton to drop the `'transcoding'` state and rename "Transcoding N%..." label accordingly.

### Claude's Discretion
- Audio bitrate: default to `128kbps` or whatever Mediabunny's QUALITY_HIGH constant maps to for audio — researcher/planner can verify and choose.
- Whether Mediabunny exposes a dedicated audio source API (e.g. `AudioEncodedPacketSource`) or requires manual `AudioEncoder` → `EncodedPacket` routing: researcher to verify and pick the correct Mediabunny audio integration pattern.
- Exact OfflineAudioContext sample rate and channel layout for audio rendering: researcher/planner to decide based on Mediabunny audio track requirements.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior Video Export Work
- `.planning/quick/260405-s9u-replace-ffmpeg-with-webcodecs-mediabunny/260405-s9u-RESEARCH.md` — Mediabunny API reference, CanvasSource pattern, codec selection rationale, VP9/Firefox bug
- `.planning/quick/260405-s9u-replace-ffmpeg-with-webcodecs-mediabunny/260405-s9u-SUMMARY.md` — Original Mediabunny implementation decisions (stable canvas, seeked-event seeking)
- `.planning/quick/260410-obm-webm-mediarecorder-ffmpeg-transcode-to-q/260410-obm-SUMMARY.md` — What Phase 14 is replacing; lists files modified by MediaRecorder+ffmpeg pipeline

### Current Implementation (to be replaced)
- `src/lib/videoExport.ts` — Current 604-line MediaRecorder+ffmpeg implementation; all logic to be replaced
- `src/lib/transcodeToMp4.ts` — To be deleted; ffmpeg.wasm singleton transcode helper
- `src/lib/export.ts` — `renderGridToCanvas()` returns a new canvas per call (stable canvas pattern bridges this)

### Requirements
- `.planning/REQUIREMENTS.md` §"Per-Cell Audio Toggle" (AUD-01..09) — audio feature requirements to maintain parity
- Phase 12 plans in `.planning/milestones/v1.1-ROADMAP.md` (or `.planning/ROADMAP.md`) for AUD-05..07 detail

### Infrastructure
- `vercel.json` — COOP/COEP headers to be removed
- `public/_headers` — COOP/COEP headers to be removed

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/export.ts → renderGridToCanvas()`: Returns a new HTMLCanvasElement per call. Use drawImage to copy into the stable CanvasSource canvas each frame.
- `src/lib/videoExport.ts → buildExportVideoElements()`: Creates dedicated HTMLVideoElements for export (not connected to DOM). Reuse this approach for the Mediabunny pipeline.
- `src/lib/videoExport.ts → destroyExportVideoElements()`: Cleanup helper for export video elements. Keep.
- `src/lib/videoExport.ts → computeLoopedTime()`: Pure helper for modulo-based video looping. Keep and reuse.
- `src/lib/videoExport.ts → buildAudioGraph()`: Current Web Audio API audio mixer. Will be replaced by OfflineAudioContext + AudioEncoder approach, but the logic for collecting `audioEnabled` leaves is reusable.
- `src/lib/videoExport.ts → hasAudioEnabledVideoLeaf()`: Helper to check if any leaf has audio enabled. Keep.
- `src/lib/overlayExport.ts → drawOverlaysToCanvas()`: Called per-frame to render overlays. Keep — same as before.

### Established Patterns
- `exportVideoGrid` function signature: `(root, mediaRegistry, mediaTypeMap, settings, totalDuration, onProgress)` — **must remain unchanged** (called from ExportSplitButton).
- `onProgress` callback shape: `(stage: 'preparing' | 'encoding' | 'transcoding', percent?: number)` — update to remove `'transcoding'`.
- Zustand store reads inside `videoExport.ts`: uses `useOverlayStore.getState()` directly — keep this pattern.

### Integration Points
- `src/Editor/ExportSplitButton.tsx` — Calls `exportVideoGrid`, handles `onProgress` stages, sets file extension. Update for new stage set.
- `src/Editor/Toast.tsx` — `ToastState` union includes `'transcoding'`. Remove that state.
- `package.json` — Remove `@ffmpeg/ffmpeg` and `@ffmpeg/util`.
- `vercel.json` and `public/_headers` — Remove COOP/COEP headers.

</code_context>

<specifics>
## Specific Ideas

- The previous Mediabunny implementation (quick-260405-s9u commit bd6fdf0) is the starting point for the video side of the new pipeline. That implementation had no audio — Phase 14 adds the audio track.
- Audio pipeline mental model: `buildExportVideoElements()` → for each audio-enabled cell, fetch audio via `VideoDecoder`/`AudioDecoder` or by playing the video through an `OfflineAudioContext` (researcher to determine best approach). Mix all audio-enabled cells via `OfflineAudioContext`, then encode the rendered `AudioBuffer` with `AudioEncoder`.
- The existing test in `src/test/phase04-02-task1.test.tsx` guards `VideoEncoder` availability — extend it to cover `AudioEncoder` as well.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 14-migrate-video-export-from-mediarecorder-ffmpeg-wasm-to-media*
*Context gathered: 2026-04-10*
