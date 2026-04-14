---
phase: 21-live-audio-preview
plan: "01"
subsystem: audio
tags: [web-audio-api, hooks, playback, audio-mix]
dependency_graph:
  requires:
    - src/lib/videoRegistry.ts
    - src/store/gridStore.ts
    - src/lib/tree.ts
  provides:
    - src/hooks/useAudioMix.ts
  affects:
    - src/Editor/PlaybackTimeline.tsx
tech_stack:
  added: []
  patterns:
    - Web Audio API AudioContext/GainNode/MediaElementAudioSourceNode
    - useRef for stable AudioContext and node map across re-renders
    - Zustand subscribe() for reactive gain updates outside React render cycle
key_files:
  created:
    - src/hooks/useAudioMix.ts
    - src/hooks/useAudioMix.test.ts
  modified:
    - src/Editor/PlaybackTimeline.tsx
decisions:
  - AudioContext created synchronously in startAudio() click handler per autoplay policy (D-06)
  - nodeMapRef guards prevent duplicate MediaElementAudioSourceNode creation (D-03)
  - Normalized gain 1/activeCount distributed across audioEnabled+hasAudioTrack cells (D-04)
  - stopAudio() uses suspend() not close() to preserve node graph across pause/resume cycles (D-02)
metrics:
  duration: "~8 minutes"
  completed: "2026-04-14"
  tasks: 3
  files: 3
---

# Phase 21 Plan 01: Live Audio Preview — useAudioMix Hook Summary

**One-liner:** Web Audio API hook wiring MediaElementAudioSourceNode+GainNode per video cell, with normalized 1/N gain mixing and Zustand-reactive mute updates during editor playback.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create test stubs and AudioContext mock (RED) | ae5606f | src/hooks/useAudioMix.test.ts |
| 2 | Implement useAudioMix hook (GREEN) | 8e5fa4c | src/hooks/useAudioMix.ts |
| 3 | Integrate useAudioMix into PlaybackTimeline | aa119e2 | src/Editor/PlaybackTimeline.tsx |

## What Was Built

`useAudioMix` is a React hook that manages the full Web Audio API lifecycle for live playback in the StoryGrid editor:

- **`startAudio()`**: Called synchronously in the play button click handler (required by browser autoplay policy). Creates `AudioContext` on first call, reuses on subsequent. Calls `buildNodeGraph()` (idempotent — skips already-wired videos), then `updateGains()`.

- **`stopAudio()`**: Suspends the `AudioContext` without closing/destroying nodes, preserving the graph for the next play.

- **`buildNodeGraph(ctx)`**: Iterates `videoElementRegistry`, creates `MediaElementAudioSourceNode` and `GainNode` per video, wires `source → gain → ctx.destination`. Uses a `has()` guard so re-calls only wire newly registered videos.

- **`updateGains()`**: Reads `useGridStore.getState().root`, computes active leaf set (audioEnabled AND hasAudioTrack AND in registry), sets gain to `1/activeCount` for active cells and `0` for muted cells.

- **Zustand subscription**: `useEffect` subscribes to `useGridStore` — when any leaf's `audioEnabled` or `hasAudioTrack` changes while the AudioContext is running, `updateGains()` is called immediately. This provides real-time mute toggle response during playback.

- **PlaybackTimeline integration**: `startAudio()` is called before `video.play()` in the play path; `stopAudio()` is called in both the pause click path and the end-of-play interval path.

## Test Coverage

7 unit tests covering LAUD-01 through LAUD-05:
- LAUD-01: AudioContext creation + node wiring for registered videos
- LAUD-02: stopAudio suspends context
- LAUD-03: Muted cells gain=0, active cells gain=1/N
- LAUD-04: AudioContext created synchronously (not deferred)
- LAUD-05: Second startAudio does not recreate nodes
- LAUD-05 supplement: New video wired on subsequent startAudio
- LAUD-03 reactivity: Mute toggle updates gains

Full suite: 679 passed / 2 skipped / 0 failed.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The hook is fully wired and functional for editor playback.

## Threat Flags

None. No new network endpoints or trust boundary crossings introduced. Audio is processed entirely client-side from local blob URLs.

## Self-Check: PASSED

- src/hooks/useAudioMix.ts exists: FOUND
- src/hooks/useAudioMix.test.ts exists: FOUND
- src/Editor/PlaybackTimeline.tsx contains useAudioMix: FOUND (2 occurrences)
- Commit ae5606f (test RED): FOUND
- Commit 8e5fa4c (feat GREEN): FOUND
- Commit aa119e2 (feat integration): FOUND
