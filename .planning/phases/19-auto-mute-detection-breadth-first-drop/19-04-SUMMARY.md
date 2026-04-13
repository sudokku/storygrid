---
phase: 19-auto-mute-detection-breadth-first-drop
plan: "04"
subsystem: media
tags: [bug-fix, gap-closure, audio-detection, overflow-split, testing]
dependency_graph:
  requires: [19-01, 19-02, 19-03]
  provides: [fixed-overflow-direction, htmlvideoelement-audio-detection]
  affects: [src/lib/media.ts, src/test/media.test.ts, src/test/phase19-foundation.test.ts]
tech_stack:
  added: []
  patterns: [HTMLVideoElement-loadedmetadata, AudioTrackList-API, mozHasAudio, overflowCount-alternation]
key_files:
  created: []
  modified:
    - src/lib/media.ts
    - src/test/media.test.ts
    - src/test/phase19-foundation.test.ts
decisions:
  - "D-14 revised: overflowCount counter replaces depth % 2 for overflow split direction — reliably alternates H/V regardless of splitNode Case A vs Case B"
  - "detectAudioTrack uses HTMLVideoElement + loadedmetadata event instead of AudioContext.decodeAudioData — AudioContext cannot parse video container formats (MP4, WebM)"
  - "Fail-open with 5-second timeout guards against hung video elements (T-19-gc-02)"
  - "Blob URL always revoked in finally block (T-19-gc-01)"
metrics:
  duration_seconds: 226
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_changed: 3
---

# Phase 19 Plan 04: Gap Closure — Overflow Direction + detectAudioTrack Summary

Fixed two root-cause bugs diagnosed in UAT: overflow splits repeating the same direction due to depth staying constant when splitNode uses Case B, and detectAudioTrack always returning true because AudioContext cannot parse video container formats.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix overflow split direction alternation in autoFillCells | 17dd657 | src/lib/media.ts, src/test/media.test.ts |
| 2 | Rewrite detectAudioTrack to use HTMLVideoElement | 116f0fd | src/lib/media.ts, src/test/phase19-foundation.test.ts, src/test/media.test.ts |

## What Was Built

**Task 1 — overflowCount counter (D-14 revision):**
- Replaced `lastFilledDepth % 2` with `overflowCount % 2` in `autoFillCells`
- `overflowCount` increments on every overflow split, so direction reliably alternates H → V → H → V regardless of which `splitNode` case is triggered
- Removed `lastFilledDepth` variable (no longer needed)
- Updated test description; added new test asserting 5-file drop produces H, V, H, V split sequence

**Task 2 — HTMLVideoElement-based audio detection:**
- Replaced `AudioContext.decodeAudioData` with `HTMLVideoElement` + `loadedmetadata` event
- Uses `AudioTrackList.length` (Chrome/Safari) and `mozHasAudio` (Firefox) to detect audio presence
- Fails open (returns `true`) when: browser fires video `error` event, 5-second timeout expires, or neither API is available
- Always revokes blob URL in `finally` block (addresses T-19-gc-01)
- Rewrote all 7 `detectAudioTrack` tests in `phase19-foundation.test.ts` with `HTMLVideoElement` mocks
- Fixed `media.test.ts` video test to properly mock `document.createElement('video')` and `URL.revokeObjectURL` so the real `detectAudioTrack` path completes without jsdom errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] media.test.ts video test broke after detectAudioTrack rewrite**
- **Found during:** Task 2 verification (full suite run)
- **Issue:** `detectAudioTrack` is called directly (not via spy) inside `autoFillCells` in the same ESM module. After rewriting to use `HTMLVideoElement`, the test called the real implementation which needed `URL.revokeObjectURL` (not mocked) and a `video` element that fires `loadedmetadata` (not mocked). Result: `TypeError: URL.revokeObjectURL is not a function` + 5-second timeout.
- **Fix:** Extended the video test to mock `document.createElement('video')` with a mock element that fires `loadedmetadata` on `src` assignment, and mock `URL.revokeObjectURL` as a no-op. Restored originals in `finally`.
- **Files modified:** `src/test/media.test.ts`
- **Commit:** 116f0fd

## Known Stubs

None.

## Threat Flags

No new trust boundaries introduced. Both fixes are internal logic changes. T-19-gc-01 (blob URL revocation) and T-19-gc-02 (5-second timeout) mitigations from the plan's threat register are both implemented.

## Self-Check: PASSED
