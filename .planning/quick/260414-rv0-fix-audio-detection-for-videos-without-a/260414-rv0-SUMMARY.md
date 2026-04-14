# Quick Task 260414-rv0 Summary

**Task:** Fix audio detection for videos without audio tracks using captureStream API for Chrome
**Date:** 2026-04-14
**Commit:** 10a380c

## What was done

Updated `detectAudioTrack()` in `src/lib/media.ts` to add a Chrome-specific
detection path using `captureStream()` / `mozCaptureStream()`.

### Root cause

Chrome does not implement `HTMLMediaElement.audioTracks`. The detection function
had two paths before the fail-open:
1. `audioTracks` — Safari only
2. `mozHasAudio` — Firefox only

In Chrome, both were `undefined`, so every video resolved `true` (fail-open).
Silent videos were incorrectly flagged as having audio.

### Fix

Added a third path between `mozHasAudio` and the fail-open:

```
captureStream() / mozCaptureStream() → stream.getAudioTracks().length > 0
```

Chrome supports `captureStream()` and `getAudioTracks()` returns the video's
actual audio track list before playback. Stream tracks are stopped immediately
after reading to prevent resource leaks.

## Files changed

- `src/lib/media.ts` — `detectAudioTrack()` function, lines 70-90
