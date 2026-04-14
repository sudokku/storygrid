---
phase: 21-live-audio-preview
reviewed: 2026-04-14T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/hooks/useAudioMix.ts
  - src/hooks/useAudioMix.test.ts
  - src/Editor/PlaybackTimeline.tsx
  - src/Grid/LeafNode.tsx
  - src/Grid/ActionBar.tsx
  - src/lib/media.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-04-14
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 21 introduces live audio preview via the Web Audio API (`useAudioMix`), a `PlaybackTimeline` component with a playhead update loop, audio-track detection in `media.ts`, and per-cell mute controls in `ActionBar`. The overall architecture is sound: the single-AudioContext / GainNode approach is correct, the autoplay policy concern (D-06) is properly documented and implemented, and the `nodeMapRef` idempotency guard is solid.

Three warnings and three info items were found. The most impactful is an unhandled promise rejection on `video.play()` in `PlaybackTimeline` — browsers reject the promise when playback is blocked by autoplay policy, producing an unhandled runtime error. The other warnings cover a leaf identity comparison bug in the store subscription and an AudioContext `resume()` promise that is not awaited (audio may silently fail to restart after suspension).

---

## Warnings

### WR-01: Unhandled promise rejection from `video.play()`

**File:** `src/Editor/PlaybackTimeline.tsx:72`

**Issue:** `video.play()` returns a `Promise<void>` that browsers reject when autoplay is blocked or the element is in a bad state (e.g., `src` not yet loaded). The rejection is swallowed without `.catch()`, producing an unhandled promise rejection in the console and potentially leaving `isPlaying` set to `true` while no video is actually playing. The NotAllowedError from autoplay policy is the most common trigger.

**Fix:**
```typescript
// Collect all play promises and swallow NotAllowedError gracefully
const playPromises = [...videoElementRegistry.values()].map(v =>
  v.play().catch((err: unknown) => {
    if ((err as DOMException).name !== 'NotAllowedError') {
      console.warn('[PlaybackTimeline] video.play() rejected:', err);
    }
  })
);
// If every play was blocked, roll back isPlaying so UI stays consistent
Promise.all(playPromises).then(() => {
  // all settled — isPlaying was already set optimistically, leave it
});
store.setIsPlaying(true);
```

Alternatively, set `isPlaying` only after at least one `.play()` resolves:
```typescript
const plays = [...videoElementRegistry.values()].map(v => v.play());
Promise.race(plays)
  .then(() => store.setIsPlaying(true))
  .catch(() => {
    stopAudio();
    store.setIsPlaying(false);
  });
```

---

### WR-02: `audioCtxRef.current.resume()` promise not awaited

**File:** `src/hooks/useAudioMix.ts:100-102`

**Issue:** `AudioContext.resume()` is asynchronous and returns a `Promise<void>`. If the context was previously suspended (`stopAudio` was called) and the caller immediately calls `video.play()` on the video elements, audio can start silently failing on some browsers because the context is still in `suspended` state when the media elements begin producing samples. The `resume()` promise is currently fire-and-forget.

```typescript
// Current — context may still be suspended when video.play() starts
if (audioCtxRef.current.state === 'suspended') {
  audioCtxRef.current.resume();   // <-- unawaited
}
```

**Fix:** Return the resume promise (or await it) so `startAudio` can be made async, or change the calling site in `PlaybackTimeline` to await it before calling `video.play()`. The simplest approach that preserves the synchronous gesture constraint (D-06 — AudioContext must be *created* synchronously, not necessarily resumed synchronously):

```typescript
// In useAudioMix.ts — return the promise so callers can coordinate
const startAudio = useCallback((): Promise<void> => {
  if (!audioCtxRef.current) {
    audioCtxRef.current = new (window as any).AudioContext();
  }
  buildNodeGraph(audioCtxRef.current);
  updateGains();
  if (audioCtxRef.current.state === 'suspended') {
    return audioCtxRef.current.resume();
  }
  return Promise.resolve();
}, [buildNodeGraph, updateGains]);

// In PlaybackTimeline.tsx handlePlayPause:
startAudio().then(() => {
  for (const video of videoElementRegistry.values()) video.play().catch(() => {});
  store.setIsPlaying(true);
});
```

Note: `AudioContext` construction must still happen synchronously (before any `await`). The `resume()` await does not violate D-06.

---

### WR-03: Leaf-array comparison in subscription uses index equality, breaking when leaves are reordered

**File:** `src/hooks/useAudioMix.ts:133-139`

**Issue:** The store subscription compares `prevLeaves[i]` to `nextLeaves[i]` by positional index. If a grid restructure reorders leaves without changing their `audioEnabled`/`hasAudioTrack` values (e.g., a cell-swap or move), the comparison may spuriously conclude nothing changed when in fact the mapping between leaf ID and gain node needs to be revalidated. More critically, if a cell is removed and replaced by a different cell at the same index, the comparison silently passes when it should detect a new leaf in the graph.

The `prevLeaves.length !== nextLeaves.length` guard handles add/remove correctly, but the within-length check is fragile for reorder.

**Fix:** Compare by `id` instead of relying on index identity:

```typescript
const prevById = new Map(prevLeaves.map(l => [l.id, l]));
for (const leaf of nextLeaves) {
  const prev = prevById.get(leaf.id);
  if (
    !prev ||
    leaf.audioEnabled !== prev.audioEnabled ||
    leaf.hasAudioTrack !== prev.hasAudioTrack
  ) {
    changed = true;
    break;
  }
}
// Also detect removed leaves
if (!changed && prevLeaves.length !== nextLeaves.length) changed = true;
```

---

## Info

### IN-01: Magic number `0.05` in end-of-playback check

**File:** `src/Editor/PlaybackTimeline.tsx:50`

**Issue:** The value `0.05` seconds used as the end-of-playback threshold is a magic number with no named constant or comment explaining the tolerance.

**Fix:**
```typescript
const PLAYBACK_END_TOLERANCE_S = 0.05; // one poll interval margin (100ms loop → ~50ms safety)
if (time >= totalDuration - PLAYBACK_END_TOLERANCE_S) {
```

---

### IN-02: `detectAudioTrack` blob URL not revoked on timeout path

**File:** `src/lib/media.ts:47-87`

**Issue:** The `finally` block correctly revokes the blob URL on normal resolution. However, when the 5-second timeout fires (`resolve(true)` on line 49), the `timer` resolves the outer promise immediately but the `video` element's `loadedmetadata` or `error` handlers may still fire afterward. The blob URL is revoked by `finally` promptly after the timeout resolve, which is correct — this is actually fine. However, the `video` element itself is never explicitly cleaned up (its `src` is not cleared and the element is not nulled), which means the browser holds a reference to it indefinitely after `finally` runs. This is a minor resource leak.

**Fix:**
```typescript
const onLoadedMetadata = () => { ... };
const onError = () => { ... };
video.addEventListener('loadedmetadata', onLoadedMetadata);
video.addEventListener('error', onError);
video.src = url;
video.load();
// In the finally block:
// (add cleanup)
} finally {
  URL.revokeObjectURL(url);
  video.src = '';   // release the video element's resource hold
}
```

---

### IN-03: `(window as any).AudioContext` bypasses typed constructor

**File:** `src/hooks/useAudioMix.ts:90`

**Issue:** The `as any` cast suppresses TypeScript's type checking for `AudioContext`. This is commonly used to handle `webkitAudioContext` on older Safari, but the comment (`eslint-disable`) suggests intent without explanation. Modern Safari 15+ (the project's minimum) has unprefixed `AudioContext`, so `as any` is unnecessary for the stated browser targets and reduces type safety.

**Fix:**
```typescript
// TypeScript lib includes AudioContext; no cast needed for Safari 15+ target
audioCtxRef.current = new AudioContext();
```

If `webkitAudioContext` fallback is genuinely needed for Safari 14 or earlier (below the stated minimum), document it explicitly:
```typescript
// webkitAudioContext fallback for Safari < 15 (below project minimum, kept as safety net)
const AudioContextCtor: typeof AudioContext =
  window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
audioCtxRef.current = new AudioContextCtor();
```

---

_Reviewed: 2026-04-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
