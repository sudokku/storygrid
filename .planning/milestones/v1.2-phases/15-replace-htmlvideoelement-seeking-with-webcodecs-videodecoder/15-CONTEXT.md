# Phase 15: Replace HTMLVideoElement seeking with WebCodecs VideoDecoder — Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace `seekAllVideosTo` (the `seeked`-event seeking bottleneck responsible for 99.4% of video export time) with a Mediabunny `VideoSampleSink`-based frame decode pipeline. Instead of seeking `HTMLVideoElement` instances frame-by-frame (2996+ IPC round-trips for a 24s/4-video export), we decode each video once via Mediabunny's `Input` → `VideoSampleSink` → `samples()` path, hold decoded `VideoSample` frames in memory, and draw them directly from the array during the encode loop.

**What is in scope:**
- Replace `buildExportVideoElements()` + `seekAllVideosTo()` + `destroyExportVideoElements()` with a `decodeVideoToSamples()` + `decodeAllVideoSamples()` pipeline using Mediabunny `VideoSampleSink`
- Add `'decoding'` stage to the progress pipeline (`'preparing' | 'decoding' | 'encoding'`)
- Update `Toast.tsx` and `ExportSplitButton.tsx` for the new `'decoding'` stage
- Extend `renderGridIntoContext` (in `src/lib/export.ts`) to accept `Map<string, VideoSample>` per frame in addition to (or replacing) `Map<string, HTMLVideoElement>`
- Close all `VideoSample` frames after the encode loop completes

**What is NOT in scope:**
- Audio pipeline changes (already handled by Phase 14 — `mixAudioForExport` stays unchanged)
- PNG export pipeline changes
- New Mediabunny or demuxer dependencies (zero new deps — `mediabunny` is already installed)
- Changes to the Mediabunny `CanvasSource` / `Output` / `BufferTarget` encode path (those stay)

</domain>

<decisions>
## Implementation Decisions

### Decode Implementation
- **D-01:** Use **Mediabunny `VideoSampleSink`** for video decoding. Pipeline: create `BlobSource` → `Input` → call `input.getPrimaryVideoTrack()` → create `VideoSampleSink(track)` → iterate `sink.samples()` async generator → collect all `VideoSample` objects into an array. Mediabunny handles codec detection, keyframe navigation, and hardware acceleration internally. Zero new dependencies.
- **D-02:** Do NOT use raw `VideoDecoder` (WebCodecs API) directly. Do NOT use `EncodedPacketSink`. Do NOT add mp4box.js. Mediabunny's own demux path is sufficient.
- **D-03:** Use `VideoSample.toCanvasImageSource()` when drawing into the stable canvas. `drawImage(sample.toCanvasImageSource(), 0, 0, 1080, 1920)` is valid on canvas 2D context.

### Memory Strategy
- **D-04:** Decode videos **sequentially** (one at a time, not in parallel). Peak GPU memory = largest single video's decoded frames (~300–500 MB for a 24s 1080p H.264). Safe for mid-range phones and tablets.
- **D-05:** **Hold all decoded frames in memory** until the full encode loop finishes. Looping videos (shorter than `totalDuration`) reuse the same decoded `VideoSample` array without re-decoding. Frame lookup uses `computeLoopedTime` (already in codebase) to find the closest frame by timestamp.
- **D-06:** After the encode loop, call `.dispose()` on all `VideoSample` objects to release GPU memory. This replaces `destroyExportVideoElements`.
- **D-07:** If `VideoSampleSink` or `Input` throws during decode of a specific video, propagate as a hard error (same as current `VideoEncoder` guard). No silent fallback to seeking — the whole point of this phase is to eliminate seeking.

### Frame Lookup
- **D-08:** Frames are sorted by timestamp after collection (Mediabunny delivers in decode order; sort by `sample.timestamp` in microseconds to ensure presentation order). For export frame `i`, compute `loopedTimeUs = computeLoopedTime(i / FPS, videoDuration) * 1_000_000` and find the nearest frame.
- **D-09:** `computeLoopedTime()` (already in `videoExport.ts`) is reused. Adapt for microsecond timestamps when comparing against `VideoSample.timestamp`.

### renderGridIntoContext Interface
- **D-10:** Extend `renderGridIntoContext` in `src/lib/export.ts` to accept a new parameter type: `Map<string, CanvasImageSource | null>` (called `videoFrameMap` or similar) alongside (or replacing) `Map<string, HTMLVideoElement>`. `VideoSample.toCanvasImageSource()` returns `OffscreenCanvas | VideoFrame` — both are valid `CanvasImageSource`. The encode loop builds this map per frame from the decoded sample arrays.
- **D-11:** Remove `HTMLVideoElement` from the `renderGridIntoContext` video parameter type once the seeking path is removed. Downstream test mocks will need updating.

### Progress UX
- **D-12:** Add `'decoding'` stage to the progress stage union: `'preparing' | 'decoding' | 'encoding'`. This is a NEW stage inserted between `'preparing'` and `'encoding'`.
- **D-13:** During the sequential decode phase, call `onProgress('decoding', percent)` where `percent` = fraction of videos decoded so far (e.g., after video 1 of 3: `Math.round(1/3 * 100)`).
- **D-14:** Update `Toast.tsx` to add `'decoding'` state with label "Decoding N%…" (amber or same blue as encoding — researcher/planner to decide). Update `ExportSplitButton.tsx` `onProgress` handler to pass `'decoding'` through to Toast.
- **D-15:** The `'preparing'` stage covers: VideoEncoder guard check, `BlobSource`/`Input` setup, audio setup (unchanged from Phase 14). Decoding begins after `output.start()` is called (same sequencing as before).

### Preserved Patterns from Phase 14
- **D-16:** Stable canvas pattern (D-11 from Phase 14): one persistent 1080×1920 canvas, `renderGridIntoContext` draws into it per frame, `CanvasSource` captures from it. Unchanged.
- **D-17:** VP9/Firefox codec selection (D-12 from Phase 14): VP9 on Firefox, AVC elsewhere. Unchanged.
- **D-18:** `exportVideoGrid` function signature stays unchanged (called from `ExportSplitButton`). Only the `onProgress` stage union type changes.
- **D-19:** Non-fatal audio path (D-03 from Phase 14): `mixAudioForExport` + `AudioBufferSource` unchanged.

### Claude's Discretion
- Exact `CanvasImageSource` vs `VideoFrame` vs `VideoSample` type threading into `renderGridIntoContext` — pick whichever causes the least churn in existing callers and tests.
- Whether to dispose frames individually in the encode loop (close after final use) or batch-dispose after the loop — batch-dispose is simpler.
- Toast label for `'decoding'` state: color and wording (e.g., "Decoding N%…" or "Preparing frames N%…").
- Whether `Input.dispose()` should be called after `samples()` exhausts or after decode loop — follow Mediabunny docs on lifecycle.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current Implementation (to be replaced/extended)
- `src/lib/videoExport.ts` — Current 483-line Mediabunny pipeline. `buildExportVideoElements`, `seekAllVideosTo`, `destroyExportVideoElements` are the three functions to replace. `exportVideoGrid` orchestrator wraps them.
- `src/lib/export.ts` — `renderGridIntoContext` is the function to extend for `VideoSample`/`CanvasImageSource` input. Currently accepts `Map<string, HTMLVideoElement>`.

### Phase 15 Pre-written Option Docs (researcher MUST read)
- `.planning/phase-15-option1-rVFC-playforward.md` — rVFC approach (not chosen, but contains root cause analysis and architecture diagrams)
- `.planning/phase-15-option2-webcodecs-videodecoder.md` — WebCodecs VideoDecoder approach. Contains detailed risks, memory strategy analysis, and the PLANNER NOTE on device-tier memory decision. Read before planning.

### Mediabunny API (validated in node_modules)
- `node_modules/mediabunny/dist/mediabunny.d.ts` — Confirmed types: `VideoSampleSink` (line 3215), `VideoSample` (line 2999), `BlobSource` (line 461), `Input` (line 1464), `InputVideoTrack` (line 1667). Key methods: `VideoSampleSink.samples()`, `VideoSample.toCanvasImageSource()`, `VideoSample.timestamp`.

### Phase 14 Context (established patterns)
- `.planning/phases/14-migrate-video-export-from-mediarecorder-ffmpeg-wasm-to-media/14-CONTEXT.md` — D-11 (stable canvas), D-12 (VP9/Firefox), D-13 (seeked-event, now being replaced), D-03 (non-fatal audio)

### UI Integration Points
- `src/Editor/ExportSplitButton.tsx` — Calls `exportVideoGrid`, handles `onProgress` stages
- `src/Editor/Toast.tsx` — `ToastState` union; add `'decoding'` state

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/videoExport.ts → computeLoopedTime()`: Already handles modulo-based video looping. Reuse for VideoSample timestamp lookup (adapt for microseconds).
- `src/lib/videoExport.ts → hasAudioEnabledVideoLeaf()`: Unchanged — still needed for audio path.
- `src/lib/videoExport.ts → mixAudioForExport()`: Unchanged — audio pipeline not in scope.
- `src/lib/export.ts → renderGridIntoContext()`: Needs extension to accept `Map<string, CanvasImageSource | null>` per frame.
- `src/lib/overlayExport.ts → drawOverlaysToCanvas()`: Unchanged.

### Functions Being Replaced
- `buildExportVideoElements()` (~30 lines): Creates `HTMLVideoElement` per video. → Replaced by `decodeVideoToSamples()` using `BlobSource` + `Input` + `VideoSampleSink`.
- `seekAllVideosTo()` (~25 lines): Seeks all videos via `seeked` event. → Replaced by array lookup in encode loop.
- `destroyExportVideoElements()` (~10 lines): Revokes blob URLs, pauses video elements. → Replaced by `VideoSample.dispose()` calls after encode loop.

### Established Patterns
- `onProgress` is called with `(stage, percent?)` — adding `'decoding'` stage follows the same pattern as `'encoding'`.
- Zustand store reads inside `videoExport.ts` via `getState()` — unchanged.
- `exportVideoGrid` signature must remain stable: `(root, mediaRegistry, mediaTypeMap, settings, totalDuration, onProgress, onWarning?)`.

### Integration Points
- `src/Editor/ExportSplitButton.tsx → onProgress` handler: receives stage string. Add `'decoding'` branch.
- `src/Editor/Toast.tsx → ToastState`: Add `'decoding'` union member.
- `package.json`: No changes required — `mediabunny` already installed.

</code_context>

<specifics>
## Specific Ideas

- The encode loop shape changes from:
  ```
  for each frame: seek → render → encode
  ```
  to:
  ```
  Phase A: for each video: decode all frames → store as VideoSample[]
  Phase B: for each frame: lookup sample → drawImage(sample.toCanvasImageSource()) → encode
  ```
- The `renderGridIntoContext` call in Phase B will receive a `Map<string, CanvasImageSource>` built fresh per frame (one entry per video mediaId), not a `Map<string, HTMLVideoElement>`. The renderer draws the provided source directly — no `video.currentTime` reading needed.
- Performance expectation: ~2–5s decode per video (hardware-accelerated via Mediabunny), ~10–25s total encode for a 24s/4-video collage. Target: ≤45s end-to-end.
- The `VideoSample.timestamp` property is in microseconds (matches WebCodecs `VideoFrame.timestamp`). `computeLoopedTime` works in seconds — multiply the result by 1,000,000 before comparing with `VideoSample.timestamp`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 15-replace-htmlvideoelement-seeking-with-webcodecs-videodecoder*
*Context gathered: 2026-04-11*
