# Phase 33: iOS Safari video compatibility — Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 4 specific iOS Safari breakages in the existing video pipeline. No new features, no new UI surfaces. Scope is limited to:
1. Export codec selection (runtime pre-flight replacing UA sniff)
2. Video first-frame rendering reliability (LeafNode preview + thumbnail capture)
3. detectAudioTrack branching correctness for iOS Safari
4. AudioContext gesture timing in the export pipeline + audioEnabled UX default

</domain>

<decisions>
## Implementation Decisions

### D-01 — Codec Selection (export)
- Replace the current `const isFirefox = ...; const videoCodec = isFirefox ? 'vp9' : 'avc';` lines in `videoExport.ts` with a runtime call to `getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: 1080, height: 1920, bitrate: QUALITY_HIGH })` from mediabunny.
- Priority order `['avc', 'vp9', 'av1']` ensures iOS Safari (AVC-only) always resolves without UA sniffing.
- If `getFirstEncodableVideoCodec` returns `null`, throw a user-visible error: "No supported video encoder found in this browser."
- `getFirstEncodableVideoCodec` is already exported from `mediabunny` — no new dependency.

### D-02 — detectAudioTrack iOS branching fix
- iOS Safari does not expose `audioTracks` (it is `undefined` on iOS). It also lacks `mozHasAudio` and `captureStream()`. So iOS falls into the `captureStream` branch which fails silently and resolves `true` (fail-open). This is acceptable behavior BUT the code comment "Chrome/Safari" is misleading.
- Fix the branching in `src/lib/media.ts: detectAudioTrack()`:
  - `captureStream()` path must only execute when BOTH `audioTracks === undefined` AND `mozHasAudio === undefined` (Chrome-only situation).
  - When `audioTracks` is defined (desktop Safari, newer Chrome), resolve immediately based on `audioTracks.length` — no captureStream fallback from within that branch.
  - The existing fail-open in the final `else` already handles iOS Safari correctly (returns `true`). The fix is about correctness of branching and comment accuracy.

### D-03 — First-frame reliability (LeafNode + captureVideoThumbnail)
- iOS Safari does not fire `seeked` after `video.currentTime = 0` unless the video has been "activated" by a `play()` call first.
- Fix: after `loadedmetadata` fires, call `video.play()` then immediately `.pause()` to force iOS Safari to decode the first frame. `seeked` will then fire reliably.
- Apply to both locations:
  - `src/Grid/LeafNode.tsx` — the `onLoadedMetadata` handler in the video load effect
  - `src/store/gridStore.ts: captureVideoThumbnail()` — the `onMeta` handler
- Both locations already set `video.muted = true` and `video.playsInline = true` — required attributes for `play()` to work without user gesture on iOS.
- The `play()` call is async — handle the returned Promise (catch silently, since the seek/draw still happens via the `seeked` event).

### D-04 — AudioContext on iOS (export pipeline)
**Part A — Pre-create AudioContext before any await:**
- Create `AudioContext` at the top of `exportVideoGrid()` in `videoExport.ts`, before any `await` calls, so it is created within the iOS Safari user gesture window (export button click).
- Pass the pre-created `AudioContext` down into `buildAudioMix()` as a parameter instead of creating a new one inside `buildAudioMix`.
- `buildAudioMix()` still creates its own `OfflineAudioContext` for mixing — that is unaffected (OfflineAudioContext does not require a user gesture).
- If `AudioContext` creation itself throws (unlikely but guard anyway), catch and proceed video-only.

**Part B — Change audioEnabled default to false:**
- In `src/lib/tree.ts: createLeaf()`, change `audioEnabled: true` to `audioEnabled: false`.
- Users must explicitly tap the Audio toggle in the MobileCellTray or Sidebar to enable audio on a video cell.
- Rationale: reduces iOS AudioContext surface area (audio graph not entered unless user opted in), and matches user expectation that silent-by-default is safer than unexpected audio.
- No migration needed — existing saved grids with `audioEnabled: true` continue to work; the change is default-only.

### Claude's Discretion
- Test coverage: researcher and planner decide the appropriate test strategy for iOS-specific event sequences (likely integration-style tests with mocked HTMLVideoElement event sequences).
- Whether `captureVideoThumbnail` should also call `video.load()` explicitly (currently only `gridStore.ts` version sets `video.src` but doesn't call `.load()`) — planner can decide.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing implementation files (read before editing)
- `src/lib/videoExport.ts` — export pipeline; codec selection at line ~506; AudioContext at ~334
- `src/lib/media.ts` — `detectAudioTrack()` at line 41
- `src/Grid/LeafNode.tsx` — first-frame load effect at line ~195
- `src/store/gridStore.ts` — `captureVideoThumbnail()` at line 26; `createLeaf()` audioEnabled default

### Mediabunny API
- `getFirstEncodableVideoCodec` — exported from `mediabunny`, async, takes codec priority array + options. Verified available in installed version.
- `canEncodeAudio` — already used in codebase (line ~528 videoExport.ts); same pattern for video codec.

### Prior phase context
- Phase 12 `audioEnabled` field and default: see `src/lib/tree.ts: createLeaf()` — field introduced in Phase 12.
- Quick task 260414-rv0 (commit 10a380c) — added captureStream() fallback for Chrome audio detection; the iOS fix in D-02 must not regress this Chrome path.
- Quick task 260420-1qq (commit 2ef7e91) — fixed detectAudioTrack call in MobileCellTray; any changes to detectAudioTrack signature should check MobileCellTray.tsx, Sidebar.tsx, LeafNode.tsx call sites.

No external specs or ADRs beyond the above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `captureVideoThumbnail` in `gridStore.ts` — already has `muted`, `playsInline`, timeout, cleanup pattern; first-frame fix applies directly here
- `detectAudioTrack` in `media.ts` — single function, called from 3 sites (LeafNode, Sidebar, MobileCellTray); fix once, applies everywhere
- `buildAudioMix()` in `videoExport.ts` — already accepts params; adding `AudioContext` param is a small signature change

### Established Patterns
- Fail-open pattern for audio detection: on any error or unsupported API, return `true` — this is intentional and must be preserved
- `video.muted = true; video.playsInline = true` already set in both `captureVideoThumbnail` and `LeafNode` video load effect — prerequisite for `play()` to work on iOS is already satisfied
- `canEncodeAudio('aac')` pattern in `videoExport.ts` — same async capability-check pattern that `getFirstEncodableVideoCodec` follows

### Integration Points
- `exportVideoGrid()` signature — adding `AudioContext` pre-creation is internal; no callers need to change
- `createLeaf()` in `tree.ts` — changing `audioEnabled` default affects all new leaf creation; existing snapshots in undo history are unaffected (they store the serialized value)
- 3 call sites for `detectAudioTrack`: `LeafNode.tsx:467`, `Sidebar.tsx:269`, `MobileCellTray.tsx:109` — no signature change expected; fix is internal to the function

</code_context>

<specifics>
## Specific Ideas

- User proposed: default `audioEnabled = false` so the audio toggle button acts as an explicit user gesture, reducing the AudioContext problem surface. Confirmed and locked as D-04 Part B.
- Mediabunny `ALL_FORMATS` was researched and ruled out — it is input-only (demuxer hint), not relevant to codec selection. `getFirstEncodableVideoCodec` is the correct API.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 33-ios-safari-video-compatibility*
*Context gathered: 2026-04-20*
