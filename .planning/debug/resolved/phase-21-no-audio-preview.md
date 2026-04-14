---
status: resolved
trigger: "phase-21-no-audio-preview"
created: 2026-04-14T00:00:00Z
updated: 2026-04-14T00:00:00Z
---

## Current Focus

hypothesis: RESOLVED — two bugs fixed, one deferred.
test: Human verified bugs 1 and 3 confirmed fixed.
expecting: n/a
next_action: archive session

## Symptoms

expected: Videos with audio tracks produce audible sound during editor playback. Cells with no audio track show a dimmed, non-interactive VolumeX icon.
actual: 1) No audio heard during playback — videos play normally visually. 2) No console errors. 3) Video confirmed to have an audio track. 4) Cells with no audio track show a clickable mute button instead of dimmed non-interactive icon.
errors: No console errors
reproduction: Open app, drop video with audio into cell, press play — no audio. Drop video without audio — mute button is still interactive.
started: First implementation in Phase 21, never worked.

## Eliminated

(none)

## Evidence

- timestamp: 2026-04-14
  checked: LeafNode.tsx line 198
  found: `video.muted = true` set on programmatic video element used for Web Audio pipeline
  implication: HTMLVideoElement.muted suppresses audio at the browser media pipeline level, before it can flow into the Web Audio graph. GainNode gain values are irrelevant — the audio source is silenced upstream.

- timestamp: 2026-04-14
  checked: media.ts detectAudioTrack(), lines 44-80
  found: `video.preload = 'metadata'` and `video.src = url` are set, but `video.load()` is never called. Setting .src alone triggers load in most browsers but is not guaranteed — without an explicit load() call, some browsers may never fire loadedmetadata. The 5-second timeout then fires and resolves(true) — fail-open — even for silent videos.
  implication: setHasAudioTrack(id, true) is called for silent videos in browsers where loadedmetadata doesn't auto-fire, making the mute button interactive when it should be locked.

- timestamp: 2026-04-14
  checked: ActionBar.tsx line 46-49
  found: `leaf.hasAudioTrack ?? true` — the ?? true fallback is wrong in intent (should be ?? false), but since createLeaf() always sets hasAudioTrack: false (never undefined), this fallback only matters for old persisted state. Not the primary cause of Bug 2.
  implication: Minor correctness issue; fix for safety.

- timestamp: 2026-04-14
  checked: Human verification after fixes applied
  found: Bug 1 (no audio during playback) CONFIRMED FIXED. Bug 3 (mute toggle reactivity) CONFIRMED FIXED. Bug 2 (mute button interactive for no-audio videos) still present — deferred to follow-up /gsd-quick task.
  implication: Session closed with bugs 1 and 3 resolved. Bug 2 is a known deferred issue.

## Resolution

root_cause: BUG 1 — LeafNode.tsx created the programmatic video element with video.muted=true, which silenced audio at the media pipeline level before it reached the Web Audio MediaElementAudioSourceNode. BUG 3 — mute toggle reactivity was broken (confirmed fixed, root cause investigated in session). BUG 2 — detectAudioTrack() in media.ts omits video.load() after setting video.src, causing loadedmetadata to never fire in some browsers, triggering the 5-second fail-open timeout and incorrectly returning true for silent videos — DEFERRED to follow-up task.
fix: (1) Removed video.muted=true from LeafNode.tsx video element creation — fixes Bug 1. (2) Fixed mute toggle reactivity — fixes Bug 3. (3) Bug 2 (mute button interactive for no-audio videos) deferred to a separate /gsd-quick task.
verification: Human confirmed Bug 1 and Bug 3 fixed. Bug 2 deferred.
files_changed: [src/Grid/LeafNode.tsx, src/lib/media.ts, src/Grid/ActionBar.tsx]
