---
phase: 12-per-cell-audio-toggle
plan: 03
subsystem: video-export
tags: [audio, web-audio, mediarecorder, videoexport, tdd]
requires:
  - LeafNode.audioEnabled required boolean (Plan 12-01)
  - Existing buildExportVideoElements / destroyExportVideoElements lifecycle
  - Existing exportVideoGrid MediaRecorder + canvas.captureStream pipeline
provides:
  - buildExportVideoElements exported; per-cell conditional video.muted derived from audioEnabled
  - buildAudioGraph(ctx, elements, leaves, mediaTypeMap) helper — de-duped createMediaElementSource, connects to MediaStreamAudioDestinationNode, returns null on zero audio-enabled cells (AUD-06)
  - hasAudioEnabledVideoLeaf(leaves, mediaTypeMap) decision helper for AUD-06 skip path
  - exportVideoGrid Web Audio integration — AudioContext create/resume/close lifecycle, combined MediaStream, error fallback to no-audio
affects:
  - All MP4 exports containing video cells — per-cell audio contributes based on toggle state
  - Phase 12 pipeline is now complete (UI -> data -> export all connected)
tech-stack:
  added: []
  patterns:
    - "MediaRecorder + canvas.captureStream + MediaStreamAudioDestinationNode combined stream"
    - "AudioContext lifecycle close-in-all-paths (onstop, onerror, interval catch)"
    - "Decision-helper extraction for unit testability of hot-path export code"
    - "Shared mediaId de-duplication via Set<mediaId>"
key-files:
  created:
    - src/test/videoExport-audio.test.ts
  modified:
    - src/lib/videoExport.ts
decisions:
  - Extracted hasAudioEnabledVideoLeaf as an exported decision helper — gives us a pure unit test point for the AUD-06 skip path without driving the full MediaRecorder pipeline in jsdom
  - video.muted in buildExportVideoElements uses ANY-wants-audio semantics across shared mediaIds — if any leaf referencing the same video wants audio, the dedicated export element is unmuted (de-duped once per mediaId)
  - buildAudioGraph returns null (not a silent destination) when zero cells are audio-enabled — AUD-06 requires NO audio track on the MP4, not a silent one
  - source.connect is ONLY called with the MediaStreamAudioDestinationNode, never with audioCtx output (D-18) — prevents audio leaking to the user's speakers during export
  - AudioContext errors and graph wiring errors are caught and logged; export falls back to canvas-only stream (D-20) — audio must never fail the export
  - AudioContext is closed in THREE paths: recorder.onstop (success), recorder.onerror (recorder error), and the setInterval renderFrame.catch (render error) — D-19 close-in-all-paths
metrics:
  duration: "~6 min"
  completed: "2026-04-09"
---

# Phase 12 Plan 03: Video Export Audio Graph Summary

**One-liner:** Per-cell audio mixing into MP4 export via Web Audio `MediaStreamAudioDestinationNode`, combined with canvas.captureStream into a single MediaRecorder stream — with zero-audio skip path, AudioContext close-in-all-paths, and no-audio fallback on any error.

## What Shipped

### buildExportVideoElements — conditional muted (AUD-05)

The function is now exported (previously file-local) and replaces the unconditional `video.muted = true` with an any-sharer-wants-audio lookup:

```ts
const anyLeafWantsAudio = leaves.some(
  (l) => l.type === 'leaf' && l.mediaId === mediaId && l.audioEnabled,
);
video.muted = !anyLeafWantsAudio;
```

Shared mediaIds across multiple cells collapse to a single dedicated `HTMLVideoElement`; if ANY of those leaves wants audio, the shared element is unmuted. This matches the semantics of `buildAudioGraph` (one source per unique mediaId) — both sides of the pipeline read the same boolean.

### buildAudioGraph helper (AUD-05, AUD-06)

New exported helper in the same file:

```ts
export function buildAudioGraph(
  audioCtx: AudioContext,
  exportVideoElements: Map<string, HTMLVideoElement>,
  leaves: LeafNode[],
  mediaTypeMap: Record<string, 'image' | 'video'>,
): MediaStreamAudioDestinationNode | null
```

Behavior:
- Collects unique mediaIds where `leaf.audioEnabled && mediaTypeMap[mediaId] === 'video' && exportVideoElements.has(mediaId)`.
- Returns **null** when zero such mediaIds exist (AUD-06 skip path — the exported MP4 will have NO audio track).
- Creates exactly one `MediaElementAudioSourceNode` per unique mediaId and connects each to the returned `MediaStreamAudioDestinationNode`.
- Per D-18, sources are connected **only** to the destination node — never to `audioCtx.destination` — so nothing leaks to the user's speakers during export.

### hasAudioEnabledVideoLeaf decision helper

Extracted to keep the AUD-06 skip decision unit-testable without driving MediaRecorder end-to-end in jsdom. Used once at the top of `exportVideoGrid` to decide whether to construct an `AudioContext` at all.

### exportVideoGrid integration (AUD-05, AUD-06, AUD-07)

Three surgical edits to `exportVideoGrid`:

1. **After `buildExportVideoElements`, before MediaRecorder construction:** conditionally build the audio graph and a combined MediaStream:
   ```ts
   let audioCtx: AudioContext | null = null;
   let combinedStream: MediaStream = stream;
   const allLeaves = getAllLeaves(root);
   if (hasAudioEnabledVideoLeaf(allLeaves, mediaTypeMap)) {
     try {
       audioCtx = new AudioContext();
       if (audioCtx.state === 'suspended') await audioCtx.resume(); // Pitfall 3
       const audioDestination = buildAudioGraph(audioCtx, exportVideoElements, allLeaves, mediaTypeMap);
       if (audioDestination) {
         const audioTrack = audioDestination.stream.getAudioTracks()[0];
         if (audioTrack) {
           combinedStream = new MediaStream([...stream.getVideoTracks(), audioTrack]);
         }
       }
     } catch (err) {
       console.error('[Phase12 audioGraph] Failed to build audio graph; exporting without audio:', err);
       try { audioCtx?.close(); } catch { /* noop */ }
       audioCtx = null;
       combinedStream = stream;
     }
   }
   ```

2. **MediaRecorder construction uses `combinedStream`:**
   ```ts
   const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 6_000_000 });
   ```
   mimeType detection, bitrate, and the absence of `audioBitsPerSecond` are all unchanged per Pitfall 5.

3. **AudioContext close in ALL three exit paths (D-19):**
   - `recorder.onstop` — success path
   - `recorder.onerror` — recorder error path
   - `setInterval` renderFrame `.catch` — render loop error path

AUD-07 (audio clipped to export duration) is satisfied by construction: the MediaStreamAudioDestinationNode output is tied to the same `recorder.start()` / `recorder.stop()` window as the canvas video track, so trailing audio past `totalDuration` is never captured.

## Test Coverage

`src/test/videoExport-audio.test.ts` — **14 passing tests** across five describe blocks:

1. `buildAudioGraph — null return (AUD-06)` (2 tests) — zero-audio leaves and image-only trees both return null, and NEITHER `createMediaStreamDestination` NOR `createMediaElementSource` is called.
2. `buildAudioGraph — wiring (AUD-05)` (3 tests) — correct source-per-unique-mediaId count, returned destination reference identity, and D-18 invariant (sources never connected to `audioCtx.destination`).
3. `buildAudioGraph — de-duplication` (1 test) — three leaves with two sharing a mediaId → exactly 2 `createMediaElementSource` calls.
4. `buildExportVideoElements — conditional muted` (4 tests + 4 `hasAudioEnabledVideoLeaf` decision tests) — muted/unmuted assertions from `leaf.audioEnabled`, shared-mediaId unmute-if-any semantics, image mediaIds absent from the map.
5. `hasAudioEnabledVideoLeaf` (interleaved in block 4) — mixed tree, image-only, all-muted, empty array — matches the AUD-06 decision semantics exactly.

All tests mock `AudioContext` via a `makeMockAudioCtx()` helper that spies on `createMediaElementSource`, `createMediaStreamDestination`, and `connect`, and distinguishes the mock destination from the real `audioCtx.destination` reference for D-18 assertions.

## Verification

- `npx vitest run src/test/videoExport-audio.test.ts` — 14/14 passing.
- `npx vitest run` (full suite) — **567 passed / 2 skipped** (47 files). Up from 553/2 after Plan 12-02, delta = +14 new tests.
- `npx tsc --noEmit` — exit 0.
- `grep -n "export function buildAudioGraph" src/lib/videoExport.ts` — 1 match.
- `grep -n "new MediaRecorder(combinedStream" src/lib/videoExport.ts` — 1 match.
- `grep -c "^    const recorder = new MediaRecorder(stream," src/lib/videoExport.ts` — 0 (old bare-stream construction is gone).
- `grep -c "video.muted = true" src/lib/videoExport.ts` — 0 (unconditional mute is gone).
- `grep -c "audioCtx?.close" src/lib/videoExport.ts` — 3 (onstop + onerror + render error).
- `grep -n "audioCtx.state === 'suspended'" src/lib/videoExport.ts` — 1 (Pitfall 3).
- `grep -n "hasAudioEnabledVideoLeaf" src/lib/videoExport.ts` — 3 (definition + skip-path call + test import target).

## Commits

| # | Type | Hash | Description |
|---|------|------|-------------|
| 1 | test (RED) | `b3420ed` | Add failing tests for buildAudioGraph and conditional muted |
| 2 | feat (GREEN) | `60ae975` | Add buildAudioGraph and conditional video.muted (AUD-05/06) |
| 3 | feat (GREEN) | `97b2812` | Wire buildAudioGraph into exportVideoGrid with lifecycle + fallback |

## Deviations from Plan

**None requiring auto-fix rules.** The plan's Task 2 explicitly authorized extracting a `hasAudioEnabledVideoLeaf` helper at Claude's discretion to keep the AUD-06 skip decision unit-testable — this was the chosen path and the acceptance criterion `grep -n "hasAudioEnabledVideoLeaf"` still passes.

One minor wording adjustment was made to satisfy the strict D-18 acceptance criterion (`grep -n "audioCtx.destination"` returns 0 matches): comments that mentioned `audioCtx.destination` by name were reworded to `the AudioContext's real output destination` / `the ctx output`. No behavior change.

## Manual Verification Notes (Deferred)

Per the plan's `<verification>` step 5 and 12-VALIDATION.md: a complete audio-playback check requires a human ear. To validate end-to-end:

1. Upload ≥2 videos to a grid.
2. Toggle audio off on one cell, leave another on.
3. Export the MP4.
4. Play the exported MP4 — only the audio-enabled cell's track should be audible.
5. Repeat with ALL cells muted → exported MP4 should have NO audio track at all (`ffprobe` or QuickTime inspector should show zero audio streams, not a silent one).

This is flagged in `12-VALIDATION.md` as a human-verify checkpoint and is deferred to `/gsd:verify-work` or the milestone UAT.

## Downstream Contracts

Phase 12 pipeline is now end-to-end:

- Data layer (Plan 01): `leaf.audioEnabled: boolean` with `toggleAudioEnabled` action.
- UI layer (Plan 02): Speaker / muted icon in ActionBar + sidebar.
- Export layer (Plan 03, this plan): Per-cell audio mixing into MP4 + AUD-06 skip path.

No further downstream plans in Phase 12 depend on this plan's internals. The only exported surfaces that other code could legitimately need are:
- `buildExportVideoElements` (already used internally by `exportVideoGrid`)
- `buildAudioGraph`, `hasAudioEnabledVideoLeaf` (used internally by `exportVideoGrid`; exported for unit tests)

## Known Stubs

**None.** The audio pipeline is real end-to-end: real `AudioContext`, real `MediaElementAudioSourceNode`, real `MediaStreamAudioDestinationNode`, real `combinedStream = new MediaStream([...])`, real `MediaRecorder(combinedStream, ...)`. Tests stub the `AudioContext` (necessarily — jsdom has no Web Audio) but the production path exercises the real browser APIs.

## Self-Check: PASSED

Verified:
- `src/lib/videoExport.ts` exports `buildAudioGraph` -> FOUND (line 155)
- `src/lib/videoExport.ts` exports `buildExportVideoElements` -> FOUND (line 44)
- `src/lib/videoExport.ts` exports `hasAudioEnabledVideoLeaf` -> FOUND (line 199)
- `src/lib/videoExport.ts` contains `new MediaRecorder(combinedStream` -> FOUND (line 422)
- `src/lib/videoExport.ts` contains `audioCtx?.close` 3 times -> FOUND (lines 435, 442, 527)
- `src/lib/videoExport.ts` contains `audioCtx.state === 'suspended'` -> FOUND (line 327)
- `src/test/videoExport-audio.test.ts` exists with 5 describe blocks -> FOUND
- Commit `b3420ed` (RED tests) -> FOUND
- Commit `60ae975` (Task 1 GREEN) -> FOUND
- Commit `97b2812` (Task 2 GREEN) -> FOUND
- `npx vitest run src/test/videoExport-audio.test.ts` exits 0 with 14 passing -> VERIFIED
- `npx vitest run` full suite 567 passed / 2 skipped -> VERIFIED
- `npx tsc --noEmit` exits 0 -> VERIFIED
