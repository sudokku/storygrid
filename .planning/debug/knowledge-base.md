# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## phase-21-no-audio-preview — Video plays silently despite audio track; mute button interactive for silent videos
- **Date:** 2026-04-14
- **Error patterns:** no audio, silent video, audio track, muted, mute button, hasAudioTrack, detectAudioTrack, loadedmetadata, GainNode, MediaElementAudioSourceNode, Web Audio
- **Root cause:** (1) LeafNode.tsx set `video.muted = true` on the HTMLVideoElement used as a Web Audio source node, silencing audio at the media pipeline level before it reached the GainNode. (2) detectAudioTrack() in media.ts never called `video.load()` after setting `video.src`, causing loadedmetadata to not fire in some browsers and the 5-second fail-open timeout to incorrectly return true for silent videos. Bug 2 was deferred to a follow-up task.
- **Fix:** Remove `video.muted = true` from the programmatic video element in LeafNode.tsx. Add `video.load()` after `video.src = url` in detectAudioTrack() (deferred). Fix `?? true` fallback to `?? false` in ActionBar.tsx for correctness.
- **Files changed:** src/Grid/LeafNode.tsx, src/lib/media.ts, src/Grid/ActionBar.tsx
---
