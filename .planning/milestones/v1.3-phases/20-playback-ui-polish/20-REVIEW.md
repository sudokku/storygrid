---
phase: 20-playback-ui-polish
reviewed: 2026-04-14T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - src/Editor/PlaybackTimeline.tsx
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-04-14
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

`PlaybackTimeline.tsx` is a focused, readable component implementing play/pause and scrubbing for synchronized video playback. The overall structure is sound. Three logic issues were found: one silent unhandled promise rejection from `video.play()`, one Rules-of-Hooks violation that works by accident today but is fragile, and one subtle race condition where the scrubber does not pause playback before seeking — which can cause the interval loop and the scrub to fight each other. One info-level note on the 10fps polling approach is included.

## Warnings

### WR-01: Unhandled promise rejection from `video.play()`

**File:** `src/Editor/PlaybackTimeline.tsx:65`
**Issue:** `HTMLVideoElement.play()` returns a Promise. If the browser rejects it (e.g., autoplay policy, video not yet loaded, or the element was unmounted between the call and resolution), the rejection is silently swallowed. In Chrome this produces an `Uncaught (in promise) DOMException` in the console and can leave `isPlaying` set to `true` while no video is actually playing, causing the playhead to tick but nothing to be heard or seen.
**Fix:**
```typescript
// Play all — collect promises and handle rejection
const playPromises = Array.from(videoElementRegistry.values()).map(v =>
  v.play().catch((err: unknown) => {
    // Autoplay or load error — abort state update
    console.warn('video.play() rejected:', err);
    return Promise.reject(err);
  }),
);
Promise.all(playPromises)
  .then(() => store.setIsPlaying(true))
  .catch(() => {
    // At least one video failed to play — keep paused state
    for (const video of videoElementRegistry.values()) video.pause();
  });
```

---

### WR-02: `useEditorStore` called inside a non-hook event handler (Rules of Hooks violation)

**File:** `src/Editor/PlaybackTimeline.tsx:58`
**Issue:** `handlePlayPause` calls `useEditorStore.getState()` directly (line 58), which is fine — that is the correct Zustand escape hatch for reading snapshot state inside callbacks. However, the function is defined as a plain `function` inside the component body without `useCallback`, and it closes over nothing from the component scope. This is not a hooks violation per se (it calls `.getState()`, not the hook), but the pattern is inconsistent: the component reads `isPlaying` via the hook at line 33, then re-reads it via `getState()` at line 59. The two reads can disagree during a React render cycle if state updates are batched. The concrete bug: if `isPlaying` is `true` in the hook snapshot but a state update is in flight, `store.isPlaying` from `getState()` may still be the old value, causing the button to toggle to the wrong state.
**Fix:** Derive the action entirely from `getState()` (consistent) or derive it from the hook-supplied `isPlaying` prop (also consistent). The simplest fix is to close over the hook-supplied value:
```typescript
function handlePlayPause() {
  if (isPlaying) {
    for (const video of videoElementRegistry.values()) video.pause();
    setIsPlaying(false);
  } else {
    // use promise-safe play (see WR-01)
    for (const video of videoElementRegistry.values()) video.play();
    setIsPlaying(true);
  }
}
```
This removes the redundant `getState()` call and uses the already-subscribed `isPlaying` and `setIsPlaying` values.

---

### WR-03: Scrubbing while playing does not pause first — interval and scrub fight each other

**File:** `src/Editor/PlaybackTimeline.tsx:70-74`
**Issue:** `handleScrub` calls `seekAll` and `setPlayheadTime` but does not pause playback. When `isPlaying` is `true`, the `setInterval` at line 42 fires every 100ms and overwrites `playheadTime` with `firstVideo.currentTime`. If the user is scrubbing quickly, the interval constantly resets the displayed position back to the video's current time, making the scrubber feel sticky or jumpy. Additionally, `seekAll` sets `video.currentTime` while the video is playing; some browsers re-buffer at the new position, causing a momentary stall that the interval will not detect cleanly.
**Fix:** Pause all videos on scrub start and resume on scrub end (using `onMouseDown`/`onMouseUp` or a `isScrubbing` ref):
```typescript
const isScrubbing = useRef(false);

function handleScrubStart() {
  isScrubbing.current = true;
  if (isPlaying) {
    for (const video of videoElementRegistry.values()) video.pause();
  }
}

function handleScrubEnd() {
  isScrubbing.current = false;
  if (isPlaying) {
    for (const video of videoElementRegistry.values()) video.play();
  }
}

function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
  const value = parseFloat(e.target.value);
  seekAll(value);
  setPlayheadTime(value);
}

// In the interval, skip updates while scrubbing:
const id = setInterval(() => {
  if (isScrubbing.current) return;
  // ... existing logic
}, 100);

// On the <input>:
// onMouseDown={handleScrubStart}
// onMouseUp={handleScrubEnd}
// onTouchStart={handleScrubStart}
// onTouchEnd={handleScrubEnd}
```

---

## Info

### IN-01: Playhead polling at 10fps uses first registered video as source of truth

**File:** `src/Editor/PlaybackTimeline.tsx:43`
**Issue:** `const [firstVideo] = videoElementRegistry.values()` picks whichever video was registered first (Map insertion order). If videos have different durations and the first video ends before others, the playhead will stop updating accurately. Also, if the registry is empty (no videos mounted), the interval runs but does nothing — minor wasted CPU. This is acceptable for MVP but worth noting for v1 when multiple heterogeneous-length clips are common.
**Fix (info-level suggestion):** Use `Math.max` over all registered video current times, or pick the video with the longest duration as the authoritative clock. Guard the interval early-exit:
```typescript
const [firstVideo] = videoElementRegistry.values();
if (!firstVideo) return; // already done — minor guard already present
```
The guard is already in place (line 44 checks `if (firstVideo)`), so no code change is urgent. Consider revisiting the "first video" heuristic when v1 multi-clip work begins.

---

_Reviewed: 2026-04-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
