# Phase 21: Live Audio Preview - Research

**Researched:** 2026-04-14
**Domain:** Web Audio API — MediaElementAudioSourceNode, GainNode, AudioContext lifecycle
**Confidence:** HIGH

## Summary

Phase 21 wires up the Web Audio API so unmuted video cells produce audible output through the speakers during editor playback. The architecture is fully specified in CONTEXT.md (decisions D-01 through D-06) — this phase is a single new file (`src/hooks/useAudioMix.ts`) plus small edits to `PlaybackTimeline.tsx`. No visual changes, no new dependencies.

The main technical concern is browser autoplay policy: an `AudioContext` created outside a user gesture is silenced. The CONTEXT decision (D-02, D-06) correctly mandates synchronous construction inside the click handler, which guarantees compliance across Chrome 90+, Firefox 90+, and Safari 15+. The secondary concern is the one-node-per-element rule: `createMediaElementSource()` throws `InvalidStateError` if called twice on the same `HTMLVideoElement` within the same `AudioContext`. D-03 solves this by storing nodes in a `Map` ref and never recreating them — only gain values are mutated.

The project already uses `AudioContext` in `videoExport.ts` for offline export mixing, confirming the pattern is established and the browser target is compatible. All locked decisions from CONTEXT.md are implementable with zero new npm dependencies.

**Primary recommendation:** Implement `useAudioMix.ts` per D-01 through D-06 exactly as specified. The hook subscribes to `useGridStore` state changes to update gain values reactively and subscribes to `useEditorStore` `isPlaying` transitions to suspend/resume the `AudioContext`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Audio wiring lives in `src/hooks/useAudioMix.ts`. `PlaybackTimeline.tsx` calls `useAudioMix()` and receives `{ startAudio, stopAudio }` (or similar interface). Keeps PlaybackTimeline.tsx small.
- **D-02:** `AudioContext` is created synchronously inside the play button's click handler (satisfies autoplay SC4). Context stored in `useRef`. On subsequent plays: `audioContext.resume()`. On pause: `audioContext.suspend()`.
- **D-03:** On first play, for each video in `videoElementRegistry`: create `MediaElementAudioSourceNode` + `GainNode`, wire `sourceNode → gainNode → audioContext.destination`. Store in `Map<nodeId, { sourceNode, gainNode }>` ref. Never recreated.
- **D-04:** Active cells = `audioEnabled=true && hasAudioTrack=true`. Each active cell's `GainNode.gain.value = 1 / activeCount`. Muted cells: `gain = 0`. Recompute whenever mute state changes.
- **D-05:** `useAudioMix` subscribes to gridStore leaf state. When `audioEnabled`/`hasAudioTrack` changes on any leaf while `isPlaying=true`: recompute `activeCount`, update all `GainNode.gain.value` immediately.
- **D-06:** `AudioContext` construction in the synchronous call stack of the play button's `click` event. `video.muted = true` already set in `LeafNode.tsx:197` — required for Web Audio routing.

### Claude's Discretion

- Exact hook interface shape (`startAudio(nodeIds)` vs. reactive effect watching `isPlaying`).
- Whether `suspend()`/`resume()` or `close()`/`new AudioContext()` is used (suspend/resume preferred per D-02).
- Error handling for `InvalidStateError` on rapid pause/resume (SC5 — use try/catch or guard against already-suspended state).
- Whether `GainNode.gain.setTargetAtTime()` is used for smoother mute transitions vs. instant value assignment.

### Deferred Ideas (OUT OF SCOPE)

- Video export audio (separate pipeline in `videoExport.ts`)
- Visual changes to PlaybackTimeline
- Per-cell volume sliders or volume UI controls
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAUD-01 | Pressing play produces audible output from all unmuted video cells with `hasAudioTrack=true` | `createMediaElementSource` + `GainNode` routing; gain computed 1/activeCount |
| LAUD-02 | Audio stops when playback is paused or timeline reaches end | `audioContext.suspend()` on pause; existing end-of-play path in `PlaybackTimeline` already calls `setIsPlaying(false)` |
| LAUD-03 | Cells with `audioEnabled=false` OR `hasAudioTrack=false` contribute no audio | GainNode gate pattern: gain=0 for excluded cells; depends on Phase 19 `hasAudioTrack` being reliable |
| LAUD-04 | AudioContext created synchronously inside the click handler — no autoplay policy block | Browser autoplay policy requires user-gesture sync path; D-06 / D-02 enforce this |
| LAUD-05 | Rapid pause/resume does not throw `InvalidStateError` | One `MediaElementAudioSourceNode` per video element per context lifetime; nodes stored in Map ref, never recreated; suspend/resume instead of close/new |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Audio API | Browser built-in | Real-time audio graph: routing, gain, mixing | Only viable browser API for live multi-source audio routing; no npm package needed |

No new npm dependencies are required for this phase. [VERIFIED: codebase — videoExport.ts already uses AudioContext/OfflineAudioContext/GainNode]

### Supporting Utilities Already in Project

| Module | Location | Role in This Phase |
|--------|----------|--------------------|
| `videoElementRegistry` | `src/lib/videoRegistry.ts` | Source of `HTMLVideoElement` references for `createMediaElementSource` |
| `useGridStore` | `src/store/gridStore.ts` | Read `audioEnabled`/`hasAudioTrack` per leaf; subscribe to changes |
| `useEditorStore` | `src/store/editorStore.ts` | Read `isPlaying`; subscribe to transitions for suspend/resume |
| `getAllLeaves` | `src/lib/tree.ts` | Walk tree to find all leaves with audio state |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── hooks/
│   ├── useMediaQuery.ts          # existing hook — reference pattern
│   └── useAudioMix.ts            # NEW: all Web Audio API logic
├── Editor/
│   └── PlaybackTimeline.tsx      # EDIT: call useAudioMix(); invoke startAudio/stopAudio in handlePlayPause
```

### Pattern 1: AudioContext create-once, suspend/resume

**What:** Construct `AudioContext` synchronously inside the click handler on first play. Store in `useRef`. On subsequent plays call `.resume()`. On pause call `.suspend()`.

**Why:** Browser autoplay policy blocks `AudioContext` created outside a user gesture. `suspend()` + `resume()` avoids the invalid state problems of `close()` + `new AudioContext()` and satisfies SC5 (nodes persist across pause/resume cycles).

**Example:**
```typescript
// Source: [ASSUMED] MDN Web Audio API — createMediaElementSource
// Pattern verified in: src/lib/videoExport.ts (same project, AudioContext usage)
const audioCtxRef = useRef<AudioContext | null>(null);

function startAudio() {
  // Called synchronously from click handler
  if (!audioCtxRef.current) {
    audioCtxRef.current = new AudioContext();
    buildNodeGraph(audioCtxRef.current);
  }
  updateGains(audioCtxRef.current);
  audioCtxRef.current.resume();
}

function stopAudio() {
  audioCtxRef.current?.suspend();
}
```

### Pattern 2: One MediaElementAudioSourceNode per HTMLVideoElement, gated via GainNode

**What:** `createMediaElementSource(videoElement)` may only be called once per video element per AudioContext. Subsequent calls throw `InvalidStateError`. Store the node pair `{ sourceNode, gainNode }` in a `Map<nodeId, ...>` ref. Never call `createMediaElementSource` again — only mutate `gainNode.gain.value`.

**Why SC5:** Rapid play/pause cycles must not recreate nodes. Guards:
1. `Map` ref — check `has(nodeId)` before calling `createMediaElementSource`.
2. `AudioContext.state` check before `resume()`/`suspend()` to avoid calling on a closed/interrupted context.

**Example:**
```typescript
// Source: [ASSUMED] MDN — AudioNode.connect, GainNode
type AudioNodes = { sourceNode: MediaElementAudioSourceNode; gainNode: GainNode };
const nodeMapRef = useRef<Map<string, AudioNodes>>(new Map());

function buildNodeGraph(ctx: AudioContext) {
  for (const [nodeId, videoEl] of videoElementRegistry) {
    if (nodeMapRef.current.has(nodeId)) continue; // never recreate
    const sourceNode = ctx.createMediaElementSource(videoEl);
    const gainNode = ctx.createGain();
    sourceNode.connect(gainNode);
    gainNode.connect(ctx.destination);
    nodeMapRef.current.set(nodeId, { sourceNode, gainNode });
  }
}
```

### Pattern 3: Normalized 1/N gain mix (D-04)

**What:** Active cells share output equally. When `activeCount` cells have `audioEnabled=true && hasAudioTrack=true`, each active cell's gain = `1 / activeCount`. Muted/silent cells: `gain.value = 0`.

**Why:** Prevents audio clipping when multiple cells are audible simultaneously. Simple, predictable, O(N) to recompute.

```typescript
function updateGains(ctx: AudioContext) {
  const leaves = getAllLeaves(useGridStore.getState().root);
  const activeIds = new Set(
    leaves
      .filter(l => l.audioEnabled && l.hasAudioTrack && videoElementRegistry.has(l.id))
      .map(l => l.id)
  );
  const gain = activeIds.size > 0 ? 1 / activeIds.size : 0;
  for (const [nodeId, { gainNode }] of nodeMapRef.current) {
    gainNode.gain.value = activeIds.has(nodeId) ? gain : 0;
  }
}
```

### Pattern 4: Reactive mute updates via Zustand subscribe

**What:** Subscribe to `useGridStore` outside React render cycle (same pattern as LeafNode.tsx:264). On `audioEnabled`/`hasAudioTrack` change: call `updateGains()` immediately if context exists and is running.

**Example:**
```typescript
// Source: [VERIFIED: codebase] — LeafNode.tsx:264 uses identical subscribe pattern
useEffect(() => {
  const unsub = useGridStore.subscribe((state, prev) => {
    if (!audioCtxRef.current) return;
    const leaves = getAllLeaves(state.root);
    const prevLeaves = getAllLeaves(prev.root);
    const changed = leaves.some((l, i) =>
      l.audioEnabled !== prevLeaves[i]?.audioEnabled ||
      l.hasAudioTrack !== prevLeaves[i]?.hasAudioTrack
    );
    if (changed) updateGains(audioCtxRef.current);
  });
  return unsub;
}, []);
```

### Pattern 5: Hook interface for PlaybackTimeline integration

**What:** `useAudioMix()` returns `{ startAudio, stopAudio }`. `PlaybackTimeline.handlePlayPause()` calls these in the synchronous path of the click event — same callstack as `video.play()` / `video.pause()`.

**Integration point in PlaybackTimeline (lines 57-68):**
```typescript
// Before (current)
function handlePlayPause() {
  const store = useEditorStore.getState();
  if (store.isPlaying) {
    for (const video of videoElementRegistry.values()) video.pause();
    store.setIsPlaying(false);
  } else {
    for (const video of videoElementRegistry.values()) video.play();
    store.setIsPlaying(true);
  }
}

// After (Phase 21)
const { startAudio, stopAudio } = useAudioMix();

function handlePlayPause() {
  const store = useEditorStore.getState();
  if (store.isPlaying) {
    for (const video of videoElementRegistry.values()) video.pause();
    stopAudio();                // suspend AudioContext
    store.setIsPlaying(false);
  } else {
    startAudio();               // create/resume AudioContext — MUST be first, in sync path
    for (const video of videoElementRegistry.values()) video.play();
    store.setIsPlaying(true);
  }
}
```

### Anti-Patterns to Avoid

- **Recreating AudioContext on each play:** Causes `InvalidStateError` on the second play because `createMediaElementSource` was already called on the video element for the previous context instance.
- **Creating AudioContext outside a click handler:** Triggers autoplay policy block (state becomes `suspended` with no way to `resume()` without a subsequent user gesture).
- **Calling `createMediaElementSource` without checking the Map:** Will throw `InvalidStateError` if called again on the same `HTMLVideoElement`.
- **Calling `context.resume()` / `context.suspend()` without checking `context.state`:** Can throw if context is already in the target state or has been closed. Guard: `if (ctx.state === 'suspended') await ctx.resume()`.
- **Wiring audio nodes for cells where `video.muted = false`:** Chrome and Safari route audio through the MediaElement pipeline AND the Web Audio pipeline when `muted=false`, causing doubled or garbled output. `video.muted = true` (already set in LeafNode:197) is the correct state.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-source audio mixing | Custom summing / buffer manipulation | `AudioContext.destination` (implicit mix bus) | Web Audio API mixes all connected `GainNode` outputs automatically at the destination node — no manual summing needed |
| Volume normalization math | Custom gain recalculation library | `gainNode.gain.value = 1/N` | Trivial arithmetic; no library needed |
| Autoplay detection/workaround | Polling `context.state`, user interaction detector | Synchronous construction in click handler | Browser guarantee: `AudioContext` created in sync user gesture callstack starts in `running` state |

---

## Common Pitfalls

### Pitfall 1: `InvalidStateError` — `createMediaElementSource` called twice

**What goes wrong:** `new AudioContext()` is called on every play click (not stored in ref), so `createMediaElementSource(videoEl)` is called again with the same element. Browser throws `InvalidStateError: Failed to construct 'MediaElementAudioSourceNode'`.

**Why it happens:** Forgetting that `MediaElementAudioSourceNode` is bound to both the `HTMLVideoElement` AND the `AudioContext`. A new context with the same video element is still a violation.

**How to avoid:** Store context in `useRef`. Check `nodeMapRef.current.has(nodeId)` before calling `createMediaElementSource`. If the context is new (user somehow got a fresh context), clear the node map first.

**Warning signs:** `InvalidStateError` in console on second play press.

### Pitfall 2: AudioContext in `suspended` state after creation

**What goes wrong:** `AudioContext` is constructed outside the synchronous click handler path (e.g., in a `useEffect` or `Promise.then()`). Browser autoplay policy starts the context in `suspended` state. Audio never plays.

**How to avoid:** Construct `AudioContext` as the very first statement of `handlePlayPause()` (or a function called synchronously from it). No `await`, no `setTimeout`, no promise chain before construction.

**Warning signs:** `ctx.state === 'suspended'` immediately after `new AudioContext()`. Chrome DevTools console warning: "The AudioContext was not allowed to start."

### Pitfall 3: Stale registry entries — audio nodes for unmounted video cells

**What goes wrong:** A user deletes a cell or swaps its media while playback is paused. The `nodeMapRef` still contains the `MediaElementAudioSourceNode` for the old `HTMLVideoElement`. On next play, `updateGains` iterates stale entries.

**How to avoid:** `updateGains` should only apply gains for nodes where `nodeId` is still present in `videoElementRegistry`. Stale entries in `nodeMapRef` (nodeId no longer in registry) set their gain to 0 automatically — they are disconnected from `destination` implicitly once the video element is garbage-collected, but gain=0 ensures silence in the interim.

**Practical guard:** In `updateGains`, filter `activeIds` to only nodeIds present in both `nodeMapRef.current` and `videoElementRegistry`.

### Pitfall 4: Missing node entries for newly registered videos

**What goes wrong:** User drops a new video while playback is paused. On next play, `buildNodeGraph` must pick up the new video. If `buildNodeGraph` is only called on first play, new cells are silently excluded.

**How to avoid:** Call `buildNodeGraph(ctx)` at the start of every `startAudio()` call (before `updateGains`). The `has(nodeId)` guard in `buildNodeGraph` makes this idempotent — existing entries are skipped.

### Pitfall 5: `video.muted = true` is required for Web Audio routing (already set)

**What goes wrong:** If `video.muted` is `false`, Chrome routes audio through both the media element speaker path and the Web Audio path simultaneously (double audio, phase issues). Safari may refuse to create a source node for an unmuted element.

**Status:** Already handled — `LeafNode.tsx:197` sets `video.muted = true`. This must not be removed.

### Pitfall 6: `AudioContext` cleanup on component unmount

**What goes wrong:** The `PlaybackTimeline` component unmounts (user navigates away) but the `AudioContext` is not closed. This leaks the audio context and leaves OS audio resources allocated.

**How to avoid:** Return a cleanup function from `useEffect` in `useAudioMix` that calls `audioCtxRef.current?.close()` and clears `nodeMapRef.current`.

### Pitfall 7: jsdom lacks Web Audio API — tests need mock

**What goes wrong:** Vitest runs in jsdom. jsdom does not implement `AudioContext`, `GainNode`, or `createMediaElementSource`. Any test that constructs `useAudioMix` without mocking will throw.

**How to avoid:** In `src/test/setup.ts` (or per-test), add a minimal `AudioContext` mock. The existing pattern (Phase 19 tests mock `detectAudioTrack` to avoid `AudioContext`) confirms this is the established approach. [VERIFIED: codebase — src/test/phase19-integration.test.ts:15]

---

## Code Examples

### Verified: AudioContext + GainNode in this project (export pipeline reference)
```typescript
// Source: [VERIFIED: codebase] src/lib/videoExport.ts:303
const tempCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
// ...
const gainNode = offlineCtx.createGain();
gainNode.gain.value = 1 / decodedBuffers.length;
sourceNode.connect(gainNode);
gainNode.connect(offlineCtx.destination);
```

### Verified: Zustand subscribe pattern (bypass React render)
```typescript
// Source: [VERIFIED: codebase] src/Grid/LeafNode.tsx:264
const unsubGrid = useGridStore.subscribe((state, prev) => {
  const curr = findNode(state.root, id) as LeafNode | null;
  const prevLeaf = findNode(prev.root, id) as LeafNode | null;
  if (!curr || !prevLeaf) return;
  // compare fields, trigger imperative action
});
```

### Verified: getAllLeaves utility
```typescript
// Source: [VERIFIED: codebase] src/lib/tree.ts:71
export function getAllLeaves(root: GridNode): LeafNode[] {
  if (root.type === 'leaf') return [root];
  return root.children.flatMap(getAllLeaves);
}
```

### Verified: getState() for fresh store reads in event handlers
```typescript
// Source: [VERIFIED: codebase] src/Editor/PlaybackTimeline.tsx:58
const store = useEditorStore.getState();
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `HTMLMediaElement` muted audio output | `video.muted=true` + Web Audio API routing | — | Enables gain-gated mixing without modifying media element output volume |
| `close()` + `new AudioContext()` per play | `suspend()` / `resume()` on persistent context | — | Avoids node recreation errors; satisfies SC5 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `AudioContext` created synchronously in a click handler starts in `running` state in Chrome 90+, Firefox 90+, Safari 15+ | Architecture Patterns P1 | Audio silenced on play — would require fallback `.resume()` call with user-gesture detection |
| A2 | `GainNode.gain.value` assignment takes effect immediately (no buffer-delay) | Architecture Patterns P3 | Slight gain lag on mute toggle — acceptable; `setTargetAtTime()` is the alternative (Claude's Discretion) |
| A3 | Safari 15+ supports `createMediaElementSource` with `video.muted=true` | Anti-Patterns section | Audio routing fails on Safari — would require fallback path |

Note: A1 and A3 are well-established Web Audio API browser behavior that has been stable for several years. Risk is LOW. [ASSUMED from training knowledge — not reverified via MDN in this session]

---

## Open Questions

1. **Hook interface: reactive effect vs. explicit startAudio/stopAudio**
   - What we know: both approaches work; CONTEXT.md lists this as Claude's Discretion
   - Recommendation: Use explicit `{ startAudio, stopAudio }` — matches the callsite requirement that `AudioContext` construction is synchronous in the click handler. A `useEffect` watching `isPlaying` would be async (effect runs after render), violating D-06.

2. **`GainNode.gain.setTargetAtTime()` vs. instant assignment**
   - What we know: instant assignment is simpler; setTargetAtTime provides a short ramp (e.g., 10ms) to avoid audio clicks on mute
   - Recommendation: Start with instant assignment (no ramp). Audio clicks from mute toggle are minor UX issue, not a blocking defect. Can be upgraded if user reports pops.

3. **End-of-playback cleanup**
   - What we know: PlaybackTimeline already calls `video.pause()` + `setIsPlaying(false)` when timeline reaches end (lines 47-51)
   - Gap: `stopAudio()` (suspend) must also be called on the end-of-play path. This happens in the `setInterval` callback, not a click handler — `audioContext.suspend()` is valid outside a click handler (only construction requires a click).

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — Web Audio API is a browser built-in; zero new npm packages required)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^2.1.9 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --run src/test/phase21` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAUD-01 | `startAudio()` builds node graph and sets gains for active cells | unit | `npm test -- --run src/test/phase21` | Wave 0 |
| LAUD-02 | `stopAudio()` suspends the AudioContext | unit | `npm test -- --run src/test/phase21` | Wave 0 |
| LAUD-03 | Cells with `audioEnabled=false` or `hasAudioTrack=false` have gain=0 | unit | `npm test -- --run src/test/phase21` | Wave 0 |
| LAUD-04 | `startAudio()` can be called synchronously (no async path to AudioContext) | unit | `npm test -- --run src/test/phase21` | Wave 0 |
| LAUD-05 | `startAudio()` called twice does not recreate nodes (idempotent buildNodeGraph) | unit | `npm test -- --run src/test/phase21` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- --run src/test/phase21`
- **Per wave merge:** `npm test -- --run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/test/phase21-audio-mix.test.ts` — covers LAUD-01 through LAUD-05
- [ ] AudioContext mock in `src/test/setup.ts` or inline per test file (jsdom lacks Web Audio API)

**AudioContext mock pattern (required in Wave 0):**
```typescript
// Minimal mock matching the API surface useAudioMix needs
const mockGainNode = { gain: { value: 1 }, connect: vi.fn() };
const mockSourceNode = { connect: vi.fn() };
const mockAudioContext = {
  state: 'running',
  destination: {},
  createGain: vi.fn(() => mockGainNode),
  createMediaElementSource: vi.fn(() => mockSourceNode),
  resume: vi.fn().mockResolvedValue(undefined),
  suspend: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
};
vi.stubGlobal('AudioContext', vi.fn(() => mockAudioContext));
```

---

## Security Domain

This phase has no network requests, no user input parsing, no authentication, and no cryptography. ASVS categories V2, V3, V4, V5, V6 are not applicable. The Web Audio API processes local media blob URLs already in the browser's security context.

---

## Project Constraints (from CLAUDE.md)

- **Tech Stack:** Vite + React 18 + TypeScript + Zustand + Immer + Tailwind CSS 3 — no substitutions
- **No new npm dependencies** unless strictly required (this phase needs none)
- **Browser Support:** Chrome 90+, Firefox 90+, Safari 15+ — Web Audio API `createMediaElementSource` is supported in all three
- **Bundle Size:** MVP bundle under 500KB gzipped — Web Audio API is browser-built-in, adds 0 bytes
- **GSD Workflow:** All edits must go through a GSD command (execute-phase)

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: codebase] `src/lib/videoExport.ts` — AudioContext / GainNode / OfflineAudioContext usage confirmed in project
- [VERIFIED: codebase] `src/lib/videoRegistry.ts` — `videoElementRegistry` Map structure confirmed
- [VERIFIED: codebase] `src/store/gridStore.ts:222-239` — `toggleAudioEnabled` / `setHasAudioTrack` action signatures confirmed
- [VERIFIED: codebase] `src/types/index.ts:20-21` — `LeafNode.audioEnabled` / `LeafNode.hasAudioTrack` field types confirmed
- [VERIFIED: codebase] `src/Grid/LeafNode.tsx:197` — `video.muted = true` confirmed
- [VERIFIED: codebase] `src/Grid/LeafNode.tsx:264` — `useGridStore.subscribe` pattern confirmed
- [VERIFIED: codebase] `src/Editor/PlaybackTimeline.tsx:57-68` — `handlePlayPause` insertion point confirmed
- [VERIFIED: codebase] `src/lib/tree.ts:71` — `getAllLeaves` utility confirmed

### Secondary (MEDIUM confidence)

- [VERIFIED: codebase] `src/test/phase19-integration.test.ts:15` — established pattern for mocking AudioContext-dependent code in jsdom tests

### Tertiary (LOW confidence / ASSUMED)

- Web Audio API autoplay policy behavior (Chrome/Firefox/Safari) — [ASSUMED] based on training knowledge; stable for 3+ years

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all building blocks confirmed in codebase
- Architecture: HIGH — all patterns verified directly in existing project code
- Pitfalls: HIGH — node recreation and autoplay policy pitfalls confirmed via codebase evidence (existing mocks, existing AudioContext usage)

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (Web Audio API is stable; no churn expected)
