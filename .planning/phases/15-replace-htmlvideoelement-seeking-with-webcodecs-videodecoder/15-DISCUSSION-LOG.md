# Phase 15: Replace HTMLVideoElement seeking — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 15-replace-htmlvideoelement-seeking-with-webcodecs-videodecoder
**Areas discussed:** Decode implementation, Memory strategy, Progress UX

---

## Decode Implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Mediabunny VideoSampleSink | Use Mediabunny's built-in Input → VideoSampleSink → samples() async generator. Returns decoded VideoSample (wraps VideoFrame) — zero new deps, Mediabunny handles codec/format internally. | ✓ |
| Raw VideoDecoder + EncodedPacketSink | Feed EncodedPacket (Uint8Array) from Mediabunny into native WebCodecs VideoDecoder manually. Full control, ~100 extra lines. | |
| rVFC play-forward (Option 1) | Play HTMLVideoElements forward at 1× speed, capture via requestVideoFrameCallback. Simpler but bounded by real-time playback — won't hit ≤45s target for long exports. | |

**User's choice:** Mediabunny VideoSampleSink
**Notes:** Scout confirmed `VideoSampleSink` class, `samples()` async generator, and `VideoSample.toCanvasImageSource()` all present in `node_modules/mediabunny/dist/mediabunny.d.ts`.

---

## Memory Strategy

### Frame reuse for looping videos

| Option | Description | Selected |
|--------|-------------|----------|
| Hold all frames, reuse for loops | Decode each video once, keep all VideoSample frames in memory for the full encode loop. Looped segments reuse the same decoded frames. | ✓ |
| Re-decode on each loop pass | Decode each video once, close frames after first use, re-decode when the video loops. | |

**User's choice:** Hold all frames, reuse for loops

### Parallel vs sequential decode

| Option | Description | Selected |
|--------|-------------|----------|
| Sequential decode per video | Decode one video at a time. Peak GPU memory = largest single video (~300–500 MB). Safe for mid-range phones. | ✓ |
| Parallel decode all videos | Decode all N videos simultaneously. Faster but peak memory = sum of all videos (1–3 GB on 4-video collages). OOM risk on phones. | |

**User's choice:** Sequential decode per video

---

## Progress UX

| Option | Description | Selected |
|--------|-------------|----------|
| Two explicit stages | Show 'Decoding N%…' then 'Encoding N%…'. User sees real progress instead of frozen bar. | ✓ |
| Single bar, decode under 'preparing' | Decode happens silently inside 'preparing'. No Toast/ExportSplitButton changes needed. | |
| Weighted single bar | Estimate decode as ~30% of total, weight the bar. Complex heuristic with no accuracy guarantee. | |

**User's choice:** Two explicit stages — add `'decoding'` to the stage union type.

---

## Claude's Discretion

- Toast label color and wording for `'decoding'` state
- Whether to dispose frames individually in the encode loop or batch-dispose after
- Exact `CanvasImageSource` type threading into `renderGridIntoContext`
- `Input.dispose()` lifecycle timing (follow Mediabunny docs)

## Deferred Ideas

None.
