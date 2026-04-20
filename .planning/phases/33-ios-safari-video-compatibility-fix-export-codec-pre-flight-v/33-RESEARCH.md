# Phase 33: iOS Safari Video Compatibility — Research

**Researched:** 2026-04-20
**Domain:** iOS Safari HTMLVideoElement quirks, WebCodecs codec selection, AudioContext gesture timing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Codec Selection (export):**
Replace the current `const isFirefox = ...; const videoCodec = isFirefox ? 'vp9' : 'avc';` lines in `videoExport.ts` with a runtime call to `getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: 1080, height: 1920, bitrate: QUALITY_HIGH })` from mediabunny. Priority order `['avc', 'vp9', 'av1']` ensures iOS Safari (AVC-only) always resolves without UA sniffing. If `getFirstEncodableVideoCodec` returns `null`, throw a user-visible error: "No supported video encoder found in this browser." `getFirstEncodableVideoCodec` is already exported from `mediabunny` — no new dependency.

**D-02 — detectAudioTrack iOS branching fix:**
Fix the branching in `src/lib/media.ts: detectAudioTrack()`: `captureStream()` path must only execute when BOTH `audioTracks === undefined` AND `mozHasAudio === undefined` (Chrome-only situation). When `audioTracks` is defined (desktop Safari, newer Chrome), resolve immediately based on `audioTracks.length` — no captureStream fallback from within that branch. The existing fail-open in the final `else` already handles iOS Safari correctly (returns `true`). The fix is about correctness of branching and comment accuracy.

**D-03 — First-frame reliability (LeafNode + captureVideoThumbnail):**
iOS Safari does not fire `seeked` after `video.currentTime = 0` unless the video has been "activated" by a `play()` call first. Fix: after `loadedmetadata` fires, call `video.play()` then immediately `.pause()` to force iOS Safari to decode the first frame. `seeked` will then fire reliably. Apply to both `src/Grid/LeafNode.tsx` `onLoadedMetadata` handler and `src/store/gridStore.ts: captureVideoThumbnail()` `onMeta` handler. Both locations already set `video.muted = true` and `video.playsInline = true`. The `play()` call is async — handle the returned Promise (catch silently).

**D-04 — AudioContext on iOS (export pipeline):**
Part A: Create `AudioContext` at the top of `exportVideoGrid()` before any `await` calls. Pass the pre-created `AudioContext` down into `buildAudioMix()` as a parameter. `buildAudioMix()` still creates its own `OfflineAudioContext` for mixing — unaffected. If `AudioContext` creation throws, catch and proceed video-only.
Part B: In `src/lib/tree.ts: createLeaf()`, change `audioEnabled: true` to `audioEnabled: false`.

### Claude's Discretion
- Test coverage: researcher and planner decide the appropriate test strategy for iOS-specific event sequences (likely integration-style tests with mocked HTMLVideoElement event sequences).
- Whether `captureVideoThumbnail` should also call `video.load()` explicitly (currently only `gridStore.ts` version sets `video.src` but doesn't call `.load()`).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

This phase fixes four discrete iOS Safari breakages in the existing video pipeline. All four changes are surgical: two are in `src/lib/videoExport.ts` (codec selection and AudioContext timing), one is in `src/lib/media.ts` (detectAudioTrack branching), one is in `src/lib/tree.ts` (audioEnabled default), and first-frame reliability spans two files (`src/Grid/LeafNode.tsx` and `src/store/gridStore.ts`).

The changes are independent of each other and carry low regression risk — each fix is a small, isolated edit to an existing function. The most impactful is D-04 Part B (audioEnabled default change to `false`), because it changes default behaviour for all new leaf nodes; however, it is default-only and does not affect serialized state in existing grids.

No new dependencies are introduced. `getFirstEncodableVideoCodec` is already exported from the installed version of mediabunny (1.40.1). [VERIFIED: npm registry and node_modules/mediabunny/dist/mediabunny.d.ts]

**Primary recommendation:** Implement all four fixes in a single wave (they are small, focused, and non-conflicting). Add unit tests for the branching logic in `detectAudioTrack` and the codec-selection null path. Use mocked HTMLVideoElement event sequences in jsdom for first-frame tests — the existing test patterns in `phase07-02-gridstore-thumbnail.test.ts` provide the right template.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Codec selection (export) | API / Backend (client-side export pipeline) | — | WebCodecs is a browser API; codec pre-flight must run in the export function before Output/CanvasSource creation |
| First-frame rendering | Browser / Client | — | HTMLVideoElement is a client-side DOM element; seek activation is local to the element |
| Audio detection | Browser / Client | — | AudioTrackList, mozHasAudio, captureStream() are browser APIs; detection runs at file-drop time |
| AudioContext lifecycle | Browser / Client | — | iOS Safari user gesture window is a browser constraint; timing must be inside the click handler synchronous path |
| audioEnabled default | State (Zustand store) | — | `createLeaf()` in tree.ts initialises the default; persists in the store snapshot |

---

## Standard Stack

No new dependencies for this phase.

### Existing Libraries Used

| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| mediabunny | ^1.40.1 | `getFirstEncodableVideoCodec`, `QUALITY_HIGH` | Already installed; `getFirstEncodableVideoCodec` already exported [VERIFIED: node_modules/mediabunny/dist/mediabunny.d.ts] |
| vitest | (project) | Unit/integration tests | jsdom environment; existing test patterns apply |

### getFirstEncodableVideoCodec Exact Signature

```typescript
// Source: node_modules/mediabunny/dist/mediabunny.d.ts (VERIFIED)
declare const getFirstEncodableVideoCodec: (
  checkedCodecs: VideoCodec[],
  options?: {
    width?: number;
    height?: number;
    bitrate?: number | Quality;
  }
) => Promise<VideoCodec | null>;
```

The function is `async` (returns `Promise<VideoCodec | null>`). When no codec in the list is encodable in the current browser, it returns `null`. [VERIFIED: mediabunny.d.ts + Context7 docs]

### Import path

```typescript
import { getFirstEncodableVideoCodec, QUALITY_HIGH } from 'mediabunny';
```

`QUALITY_HIGH` is already imported in `videoExport.ts` — no new import line required, only add `getFirstEncodableVideoCodec` to the existing import. [VERIFIED: src/lib/videoExport.ts line 8]

---

## Architecture Patterns

### System Architecture Diagram

```
Export button click (user gesture)
       │
       ▼
exportVideoGrid()
  │
  ├─ [SYNC] new AudioContext()          ← D-04: must happen BEFORE any await
  │
  ├─ [AWAIT] getFirstEncodableVideoCodec(['avc','vp9','av1'], opts)   ← D-01
  │     │
  │     ├─ returns 'avc'  → iOS Safari / Chrome / desktop Safari
  │     ├─ returns 'vp9'  → Firefox
  │     └─ returns null   → throw user-visible error
  │
  ├─ Output / CanvasSource setup (using resolved codec)
  │
  ├─ [AWAIT] output.start()
  │
  ├─ Phase A: buildVideoStreams (lazy iterators)
  │
  ├─ Phase B: encode loop (frame-by-frame)
  │
  ├─ Audio mixing: mixAudioForExport(... audioContext)   ← D-04: pass pre-created ctx
  │     │
  │     └─ tempCtx param replaces `new AudioContext()` call inside function
  │
  └─ output.finalize()

File drop → detectAudioTrack(file)
  │
  ├─ audioTracks defined?
  │     └─ YES → resolve(audioTracks.length > 0)   ← desktop Safari / newer Chrome
  │
  ├─ mozHasAudio defined?
  │     └─ YES → resolve(mozHasAudio === true)      ← Firefox
  │
  ├─ BOTH undefined?  [was "Chrome" — now "Chrome-only captureStream path"]   ← D-02
  │     └─ captureStream() exists → try → resolve(getAudioTracks().length > 0)
  │
  └─ else → resolve(true)  [fail-open — iOS Safari lands here]

Video cell loaded → onLoadedMetadata fires
  │
  ├─ video.currentTime = 0
  ├─ video.play().catch(() => {})   ← D-03: activates decoder on iOS Safari
  │     └─ (play is async — DO NOT await; seeked fires after play initialises)
  └─ [seeked event] → draw first frame
```

### Recommended Change Locations

```
src/
├── lib/
│   ├── videoExport.ts        # D-01 (codec), D-04 Part A (AudioContext)
│   ├── media.ts              # D-02 (detectAudioTrack branching)
│   └── tree.ts               # D-04 Part B (audioEnabled default)
├── store/
│   └── gridStore.ts          # D-03 (captureVideoThumbnail onMeta)
└── Grid/
    └── LeafNode.tsx           # D-03 (onLoadedMetadata play/pause)
```

### Pattern: getFirstEncodableVideoCodec usage

```typescript
// Source: mediabunny docs (Context7 verified) + existing canEncodeAudio pattern in videoExport.ts
import { getFirstEncodableVideoCodec, QUALITY_HIGH } from 'mediabunny';

// Replace:
// const isFirefox = navigator.userAgent.includes('Firefox');
// const videoCodec = isFirefox ? 'vp9' : 'avc';

// With:
const videoCodec = await getFirstEncodableVideoCodec(
  ['avc', 'vp9', 'av1'],
  { width: 1080, height: 1920, bitrate: QUALITY_HIGH }
);
if (!videoCodec) {
  throw new Error('No supported video encoder found in this browser.');
}
```

This must be placed BEFORE `new Output(...)` / `new CanvasSource(...)` because the codec is passed to `CanvasSource` at construction time. [VERIFIED: src/lib/videoExport.ts lines 506-519]

### Pattern: AudioContext pre-creation (D-04 Part A)

```typescript
// Current code inside mixAudioForExport():
const tempCtx = new AudioContext({ sampleRate: SAMPLE_RATE });  // ← WRONG: created after awaits

// Fixed: create in exportVideoGrid() before first await, pass as parameter
// In exportVideoGrid():
let gestureAudioContext: AudioContext | null = null;
try {
  gestureAudioContext = new AudioContext({ sampleRate: 48000 });
} catch {
  // AudioContext creation failed — proceed video-only
}

// Pass gestureAudioContext into mixAudioForExport(... audioCtx: AudioContext | null)
// mixAudioForExport uses it directly instead of new AudioContext()
```

**Key iOS Safari constraint:** iOS Safari invalidates the user gesture window as soon as the first `await` completes. `new AudioContext()` called after any `await` — even `await output.start()` — will either be created in the `suspended` state or be rejected. [CITED: WebAudio spec issue #2218; MEDIUM confidence based on WebSearch verification]

### Pattern: play/pause trick for first-frame (D-03)

```typescript
// In captureVideoThumbnail() onMeta handler:
const onMeta = () => {
  try {
    video.currentTime = 0;
    // iOS Safari does not fire `seeked` unless the video decoder has been activated.
    // play().then(pause) activates the decoder; seeked fires reliably after this.
    video.play().catch(() => { /* ignore — seeked/draw happens via event */ });
  } catch {
    finish(null);
  }
};

// In LeafNode.tsx onLoadedMetadata:
const onLoadedMetadata = () => {
  recomputeTotalDuration();
  video.currentTime = 0;
  video.play().catch(() => { /* ignore */ });
};
```

**Important:** `play()` returns a Promise. Do NOT `await` it — the `seeked` event fires after the browser decodes the first frame as a side effect of starting playback, before the play Promise resolves. Catching the rejection silently is correct (AbortError is thrown when `pause()` is called synchronously, which is fine). [CITED: WebKit video policies blog; MEDIUM confidence]

**LeafNode special case:** The `video` element in LeafNode is NOT muted (by design — Web Audio API wires it as a MediaElementAudioSourceNode). However, `video.muted = true` is the prerequisite for `play()` without user gesture on iOS. For LeafNode, the video is not muted, so `play()` will require a user gesture — and in the context of file drop, a user gesture IS present (file drop = user interaction). For `captureVideoThumbnail`, `video.muted = true` is already set. [VERIFIED: src/Grid/LeafNode.tsx lines 194-196; src/store/gridStore.ts lines 29-30]

**video.load() question (Claude's Discretion):** `captureVideoThumbnail` sets `video.src = blobUrl` but does NOT call `video.load()`. Desktop Safari and Chrome trigger `loadedmetadata` on src assignment without explicit `load()`. However, explicit `video.load()` after setting `src` is the safest pattern for cross-browser reliability (the MDN spec recommends it when src is changed programmatically). **Recommendation:** Add `video.load()` to `captureVideoThumbnail` after `video.src = blobUrl`. This mirrors the pattern already used in `detectAudioTrack` (line 99 in media.ts) which calls `video.load()` explicitly. [VERIFIED: media.ts line 99]

### Pattern: detectAudioTrack branching fix (D-02)

Current code enters the `captureStream()` path from within the `audioTracks !== undefined` branch via a secondary `else if (mozHasAudio === true)` fallthrough — the logic actually resolves `false` in that branch if `audioTracks.length === 0` AND `mozHasAudio` is falsy, which is correct. The actual bug is that the comment says "Chrome/Safari" for the final `else` block but iOS Safari lands there, and the outer `audioTracks !== undefined` branch is the path desktop Safari takes.

The fix clarifies that the `captureStream()` path is Chrome-exclusive (when both `audioTracks` and `mozHasAudio` are undefined). The current code already has this structure; the bug described in D-02 is that there is no secondary fallback from the `audioTracks` branch to `captureStream()` — which is already the case. The fix is comment accuracy + ensuring no future refactor adds a captureStream fallback inside the audioTracks branch.

**Verified current branch logic (from media.ts lines 56-90):**
1. `audioTracks !== undefined` → resolve based on `audioTracks.length` (desktop Safari, some Chrome versions)
2. `mozHasAudio !== undefined` → resolve based on `mozHasAudio` (Firefox)
3. else → try `captureStream()` (Chrome without audioTracks)
4. else → fail-open `resolve(true)` (iOS Safari — no audioTracks, no mozHasAudio, no captureStream)

The CONTEXT.md description of the bug is accurate: the comment at line 70 says "Chrome: neither audioTracks nor mozHasAudio — try captureStream()" but this is also where iOS Safari lands. The `captureStream` variable will be `undefined` on iOS Safari, so the inner `if (captureStream)` check prevents it from executing — iOS falls to the fail-open at line 86. The fix is comment-only plus adding a `captureStream` presence guard comment making the iOS path explicit.

### Anti-Patterns to Avoid

- **Awaiting `play()` before checking seeked:** `play()` resolves after playback starts, but `seeked` may fire before that; awaiting blocks drawing. Use event-driven approach only.
- **Creating `AudioContext` after any `await`:** On iOS Safari, the user gesture window is consumed by the first `await`. All synchronous AudioContext creation must happen before the first await in the export function.
- **Using UA sniffing to select codec:** `navigator.userAgent.includes('Firefox')` is already the current approach — this is what D-01 replaces. The `isFirefox` line at videoExport.ts:507 must be completely removed, not preserved as a fallback.
- **Calling `video.pause()` synchronously inside `play().then()`:** On iOS, calling `.pause()` synchronously after `.play()` in the same microtask may cause AbortError. Call pause after a brief yield or immediately — the `catch` silences the AbortError. The correct pattern is `video.play().catch(() => {})` without chaining a `.then(pause)`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Runtime codec support check | Custom `VideoEncoder.isConfigSupported()` loop | `getFirstEncodableVideoCodec` (mediabunny) | Handles width/height/bitrate options, returns null cleanly, consistent with existing `canEncodeAudio` pattern |
| iOS AudioContext unlock | Custom AudioContext resume/suspend unlocking logic | Pre-create in gesture handler before await | iOS Safari requires synchronous creation; no library solves this better than the native pattern |

---

## Common Pitfalls

### Pitfall 1: play() requires muted=true on iOS for programmatic calls
**What goes wrong:** `video.play()` on iOS Safari throws a `NotAllowedError` if the video is not muted and there is no user gesture.
**Why it happens:** iOS Safari's media policies prohibit playing audio without user interaction.
**How to avoid:** `captureVideoThumbnail` already sets `video.muted = true` — safe. LeafNode does NOT mute the video element (by design, for Web Audio). For LeafNode, `play()` runs after a file drop, which IS a user gesture — this is safe. The issue would arise if LeafNode's effect ever fires outside a user gesture context (e.g., hydration), but the effect only fires when `mediaUrl` changes, which requires user action.
**Warning signs:** `NotAllowedError: The request is not allowed by the user agent or the platform in the current context.` in console.

### Pitfall 2: getFirstEncodableVideoCodec placement relative to Output constructor
**What goes wrong:** Calling `await getFirstEncodableVideoCodec(...)` after `new CanvasSource(stableCanvas, { codec: ... })` is too late — codec is passed at CanvasSource construction time.
**Why it happens:** CanvasSource takes codec as constructor option.
**How to avoid:** `getFirstEncodableVideoCodec` must be called BEFORE `new CanvasSource(...)`. In `exportVideoGrid()`, the current structure has `const videoCodec = ...` at line 507-508 immediately followed by `new CanvasSource(stableCanvas, { codec: videoCodec, ... })` — the replacement must maintain this ordering. [VERIFIED: videoExport.ts lines 506-519]

### Pitfall 3: AudioContext creation placement in exportVideoGrid
**What goes wrong:** `new AudioContext()` called after `await output.start()` (line 551) lands outside the user gesture window on iOS Safari. The context will be in `suspended` state and `decodeAudioData` will silently fail.
**Why it happens:** Each `await` yields control; iOS Safari's gesture tracking does not survive across task boundaries.
**How to avoid:** Create AudioContext BEFORE the first `await` in `exportVideoGrid`. In the current code, the first `await` is `await canEncodeAudio('aac')` at line 528. AudioContext must be created before line 528.
**Warning signs:** AudioContext.state === 'suspended' after creation; audio decode returns silence.

### Pitfall 4: audioEnabled default change and undo history
**What goes wrong:** After changing `createLeaf()` default to `audioEnabled: false`, existing undo history snapshots in the browser (loaded from Zustand `persist` middleware or sessionStorage) may have `audioEnabled: true` or `audioEnabled: false` for cells created before the change.
**Why it happens:** Serialized snapshots store the field value as committed at creation time.
**How to avoid:** This is explicitly safe — the CONTEXT.md notes "No migration needed — existing saved grids with `audioEnabled: true` continue to work; the change is default-only." The field is always stored explicitly in the snapshot. The risk is zero for existing users.
**Warning signs:** None — this is a non-issue.

### Pitfall 5: video.load() in captureVideoThumbnail
**What goes wrong:** On some iOS Safari versions, setting `video.src` without calling `video.load()` may not trigger `loadedmetadata` reliably.
**Why it happens:** iOS Safari requires an explicit `load()` call when `preload` is not set or is `"none"`.
**How to avoid:** Add `video.load()` after `video.src = blobUrl` in `captureVideoThumbnail`. This mirrors the pattern in `detectAudioTrack` (media.ts:99). `captureVideoThumbnail` does not currently set `video.preload` — adding `load()` is the safe fix. [VERIFIED: media.ts:99, gridStore.ts:74]

### Pitfall 6: Regression to Chrome captureStream() path
**What goes wrong:** After fixing D-02 comments, a future refactor might add a captureStream fallback inside the `audioTracks !== undefined` branch, which would regress Chrome behavior.
**Why it happens:** The comment fix alone doesn't prevent code regression.
**How to avoid:** The test for the Chrome captureStream path (commit 10a380c quick task 260414-rv0) must continue to pass after D-02. Add an explicit test for the iOS fail-open path in `media.test.ts`.

---

## Code Examples

### D-01 Final form in videoExport.ts

```typescript
// Source: mediabunny docs (Context7 /vanilagy/mediabunny) + verified type signature
// BEFORE exportVideoGrid creates Output/CanvasSource:
const videoCodec = await getFirstEncodableVideoCodec(
  ['avc', 'vp9', 'av1'],
  { width: 1080, height: 1920, bitrate: QUALITY_HIGH }
);
if (!videoCodec) {
  throw new Error('No supported video encoder found in this browser.');
}

// Then pass videoCodec to CanvasSource as before:
const videoSource = new CanvasSource(stableCanvas, {
  codec: videoCodec,
  bitrate: QUALITY_HIGH,
  hardwareAcceleration: 'prefer-hardware',
  latencyMode: 'realtime',
  bitrateMode: 'variable',
});
```

### D-02 detectAudioTrack after fix — comment-level change

The branching structure in `media.ts` is already correct for iOS Safari (it falls to the final `resolve(true)` fail-open). The fix is:
1. Update comment at line 70: `// Chrome: neither audioTracks nor mozHasAudio — try captureStream()` → `// Chrome-only: when both audioTracks AND mozHasAudio are undefined, try captureStream(). iOS Safari also lands here but lacks captureStream — falls through to fail-open.`
2. Add an explicit comment before the final `resolve(true)`: `// iOS Safari: no audioTracks, no mozHasAudio, no captureStream — fail-open.`

### D-03 captureVideoThumbnail onMeta (gridStore.ts)

```typescript
const onMeta = () => {
  try {
    video.currentTime = 0;
    // iOS Safari: seeked does not fire on muted video unless decoder is activated.
    // play() activates the decoder; pause happens implicitly when seeked fires.
    video.play().catch(() => { /* AbortError from immediate pause is benign */ });
  } catch {
    finish(null);
  }
};
```

### D-04A AudioContext pre-creation in exportVideoGrid

```typescript
// SYNC — must be before any await to stay within iOS Safari user gesture window
let gestureAudioContext: AudioContext | null = null;
try {
  gestureAudioContext = new AudioContext({ sampleRate: 48000 });
} catch {
  // AudioContext unavailable — audio mixing will be skipped
}

// Later, pass gestureAudioContext to mixAudioForExport:
const mixedBuffer = await mixAudioForExport(
  mediaRegistry, audioEnabledIds, totalDuration, gestureAudioContext
);
```

And `mixAudioForExport` signature changes:

```typescript
async function mixAudioForExport(
  mediaRegistry: Record<string, string>,
  audioEnabledMediaIds: Set<string>,
  totalDurationSeconds: number,
  providedCtx: AudioContext | null,  // new parameter
): Promise<AudioBuffer | null> {
  // Use providedCtx instead of new AudioContext(...)
  const tempCtx = providedCtx ?? new AudioContext({ sampleRate: SAMPLE_RATE });
  // ... rest unchanged
  // IMPORTANT: do NOT close tempCtx if it was provided externally (caller owns lifetime)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| UA-sniff Firefox for VP9 | `navigator.userAgent.includes('Firefox')` in videoExport.ts | Phase ~12 (video export phase) | UA sniff fails for iOS Safari (should be AVC, gets AVC by luck, but fragile) |
| runtime `VideoEncoder.isConfigSupported()` via mediabunny | `getFirstEncodableVideoCodec` (D-01) | Phase 33 | Declarative, prioritised, null-safe |
| `new AudioContext()` inside mixAudioForExport | Pre-created in gesture handler (D-04) | Phase 33 | Keeps AudioContext within gesture window on iOS |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | iOS Safari's user gesture window does not survive across `await` boundaries in exportVideoGrid (AudioContext must be created before first `await`) | Common Pitfalls #3, D-04 code example | If wrong, pre-creating AudioContext is still harmless but unnecessary; risk is low |
| A2 | `video.play()` called after `loadedmetadata` activates the iOS Safari decoder such that `seeked` fires reliably after `currentTime = 0` | Common Pitfalls #1, D-03 pattern | If wrong, first-frame reliability remains broken on iOS; alternative is `currentTime = 0.001` URL fragment trick |
| A3 | Desktop Safari exposes `audioTracks` on HTMLVideoElement (making it land in branch 1 of detectAudioTrack, not the captureStream branch) | Architecture Patterns (branching diagram) | If wrong, desktop Safari may use captureStream() path — behaviour is same (either correct or fail-open) |

---

## Open Questions

1. **LeafNode video.muted for play() on iOS**
   - What we know: `captureVideoThumbnail` sets `muted = true` (safe). LeafNode intentionally does NOT mute (Web Audio wiring). File drop is a user gesture — `play()` should be allowed.
   - What's unclear: Does iOS Safari consider a drag-and-drop file input as a qualifying user gesture for `play()` on an unmuted video?
   - Recommendation: If play() is rejected (NotAllowedError), catch it silently — the CONTEXT.md already specifies this. First-frame drawing via `seeked` may not fire on iOS in this edge case, but that is acceptable since the user will see the video in preview when they play.

2. **pause() timing relative to play() promise**
   - What we know: Calling `video.play()` followed immediately by `video.pause()` (synchronously) in the same microtask can cause AbortError.
   - What's unclear: Does the D-03 fix intend to call pause explicitly, or rely on the natural pause after seeked fires?
   - Recommendation: Do NOT call `pause()` explicitly after `play()`. The CONTEXT.md description says "play() then immediately .pause()" but the purpose is decoder activation, not actual playback. The video should remain paused after seeked fires. Let the existing `onSeeked` handler draw the frame and stop — do NOT chain `.then(() => video.pause())`.

3. **AudioContext lifetime management**
   - What we know: `gestureAudioContext` will be created in `exportVideoGrid` and passed to `mixAudioForExport`. The current code closes `tempCtx` in the `finally` block of `mixAudioForExport`.
   - What's unclear: Who is responsible for closing the pre-created context?
   - Recommendation: `exportVideoGrid` creates it, `exportVideoGrid` closes it (in its own finally block). `mixAudioForExport` must NOT close a context it did not create — add a `shouldClose` flag or use a separate local variable name to make this explicit.

---

## Environment Availability

Step 2.6: SKIPPED — this phase makes no external tool/service dependencies. All changes are within existing browser APIs (HTMLVideoElement, AudioContext, WebCodecs) and the already-installed mediabunny library.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom environment) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/test/media.test.ts src/test/phase07-02-gridstore-thumbnail.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Fix | Behaviour | Test Type | Automated Command | File Exists? |
|-----|-----------|-----------|-------------------|-------------|
| D-01 | `getFirstEncodableVideoCodec` null → error thrown | unit | `npx vitest run src/test/videoExport-codec.test.ts` | Wave 0 gap |
| D-01 | resolved codec passed to CanvasSource | unit | same file | Wave 0 gap |
| D-02 | `audioTracks` defined → no captureStream call | unit | `npx vitest run src/test/media.test.ts` | Extend existing |
| D-02 | `audioTracks` undefined + `mozHasAudio` undefined → captureStream path | unit | same | Extend existing |
| D-02 | iOS-like (all undefined, no captureStream) → fail-open true | unit | same | Extend existing |
| D-03 | `captureVideoThumbnail` calls play() after loadedmetadata | unit | `npx vitest run src/test/phase07-02-gridstore-thumbnail.test.ts` | Extend existing |
| D-03 | `video.load()` called in captureVideoThumbnail | unit | same | Extend existing |
| D-04A | `AudioContext` created before first await | unit | `npx vitest run src/test/videoExport-codec.test.ts` | Wave 0 gap |
| D-04B | `createLeaf()` returns `audioEnabled: false` | unit | `npx vitest run src/test/tree-functions.test.ts` | Extend existing |

### Sampling Rate
- **Per task commit:** `npx vitest run src/test/media.test.ts src/test/phase07-02-gridstore-thumbnail.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/test/videoExport-codec.test.ts` — new file for D-01 codec selection + null error path + D-04A AudioContext ordering
- [ ] Extend `src/test/media.test.ts` — add iOS-specific branch coverage for detectAudioTrack (audioTracks defined, iOS fail-open)
- [ ] Extend `src/test/phase07-02-gridstore-thumbnail.test.ts` — add play() mock verification in captureVideoThumbnail
- [ ] Extend `src/test/tree-functions.test.ts` — assert `createLeaf().audioEnabled === false`

---

## Security Domain

This phase makes no changes to authentication, session management, access control, cryptography, or data storage. The only user-facing input is the existing video file drop (unchanged). ASVS categories do not apply to this phase.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/mediabunny/dist/mediabunny.d.ts` — `getFirstEncodableVideoCodec` exact TypeScript signature [VERIFIED in-session]
- Context7 `/vanilagy/mediabunny` — `getFirstEncodableVideoCodec` API docs including async return type, options shape, null return [VERIFIED in-session]
- `src/lib/videoExport.ts` — current codec selection at lines 506-508; AudioContext at line 336; first-await at line 528 [VERIFIED in-session]
- `src/lib/media.ts` — current detectAudioTrack branching logic lines 53-90 [VERIFIED in-session]
- `src/store/gridStore.ts` — captureVideoThumbnail lines 26-76; `video.muted`, `video.playsInline` at lines 29-30; missing `video.load()` confirmed at line 74 [VERIFIED in-session]
- `src/Grid/LeafNode.tsx` — `onLoadedMetadata` handler lines 204-209; `video.muted` NOT set (intentional, confirmed line 197 comment) [VERIFIED in-session]
- `src/lib/tree.ts` — `createLeaf()` `audioEnabled: true` at line 119 [VERIFIED in-session]

### Secondary (MEDIUM confidence)
- WebKit blog "New `<video>` Policies for iOS" — `muted` + `playsInline` requirements for programmatic `play()` without user gesture [CITED: https://webkit.org/blog/6784/new-video-policies-for-ios/]
- WebAudio spec issue #2218 — iOS Safari AudioContext state on creation after async boundaries [CITED: https://github.com/WebAudio/web-audio-api/issues/2218]

### Tertiary (LOW confidence)
- General WebSearch results on iOS Safari video event quirks — `seeked` unreliability without `play()` activation [WebSearch: multiple community sources, not directly verified against WebKit source]

---

## Metadata

**Confidence breakdown:**
- Standard stack (mediabunny API): HIGH — verified from installed package type declarations and Context7 docs
- Architecture (fix locations and ordering): HIGH — verified from reading actual source files
- iOS Safari event model (play/pause trick): MEDIUM — established community pattern, cited WebKit policy blog; not verified against current WebKit source
- AudioContext gesture window: MEDIUM — cited WebAudio spec issue, consistent with community knowledge
- Pitfalls: HIGH for code-structural pitfalls (verified), MEDIUM for iOS runtime behaviour

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (mediabunny API is stable at 1.40.1; iOS Safari behaviour has been consistent for several iOS versions)
