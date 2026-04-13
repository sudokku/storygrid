---
phase: 19-auto-mute-detection-breadth-first-drop
plan: "01"
subsystem: tree-lib, media-lib, store
tags: [bfs, audio-detection, store-action, tdd]
dependency_graph:
  requires: []
  provides: [getBFSLeavesWithDepth, detectAudioTrack, setHasAudioTrack, FillActions.setHasAudioTrack]
  affects: [src/lib/tree.ts, src/lib/media.ts, src/store/gridStore.ts]
tech_stack:
  added: []
  patterns: [BFS queue traversal, AudioContext.decodeAudioData, fail-open error handling, no-snapshot store action]
key_files:
  created:
    - src/test/phase19-foundation.test.ts
  modified:
    - src/lib/tree.ts
    - src/lib/media.ts
    - src/store/gridStore.ts
decisions:
  - detectAudioTrack uses fail-open (returns true on any error) — false positive better than locking toggle on audio-bearing video
  - setHasAudioTrack does not call pushSnapshot — audio detection is consequence of setMedia (which already pushed), not an independent user action
  - getBFSLeavesWithDepth uses explicit queue array rather than recursion — simpler mental model, avoids stack depth concerns on deep trees
metrics:
  duration: 8min
  completed: "2026-04-13"
  tasks: 2
  files: 4
---

# Phase 19 Plan 01: Foundation — BFS traversal, audio detection, store action

**One-liner:** BFS leaf traversal with depth, AudioContext-based audio detection (fail-open), and no-snapshot setHasAudioTrack store action — all TDD-verified with 14 tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add getBFSLeavesWithDepth and detectAudioTrack (TDD) | 04133b4 | src/lib/tree.ts, src/lib/media.ts, src/test/phase19-foundation.test.ts |
| 2 | Add setHasAudioTrack store action | 04133b4 | src/store/gridStore.ts, src/test/phase19-foundation.test.ts |

## Decisions Made

1. **fail-open for detectAudioTrack** — Any error in AudioContext construction, arrayBuffer read, or decodeAudioData causes the function to return `true`. A false positive (treating a silent video as having audio) is less harmful than locking the audio toggle on a video that actually has sound. Matches D-05 in the research doc.

2. **No pushSnapshot in setHasAudioTrack** — The `setMedia` action that precedes audio detection in the upload flow already pushed a history snapshot. Adding another would create double undo entries per upload and pollute undo history with non-user-visible state.

3. **ctx.close() in finally block** — AudioContext is closed in a `finally` to guarantee resource cleanup regardless of whether decodeAudioData succeeds or fails. The outer try/catch catches AudioContext constructor throws and any other errors.

## Test Results

All 14 tests in `src/test/phase19-foundation.test.ts` pass:
- 4 tests for `getBFSLeavesWithDepth` (single leaf, 2-leaf container, nested BFS order, leaves-only)
- 6 tests for `detectAudioTrack` (channels > 0, channels === 0, decode reject, constructor throw, close() called)
- 4 tests for `setHasAudioTrack` (set false, set true, no snapshot, no-op for invalid id)

Full suite: 664 passed / 2 pre-existing failures in phase17-has-audio-track.test.ts (confirmed pre-existing before this plan's changes — `createLeaf()` defaults `hasAudioTrack: false` but test expects `true`; this is a pre-existing test/code mismatch not introduced by this plan).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints or trust boundary crossings introduced. `detectAudioTrack` processes file bytes entirely in-browser via AudioContext; T-19-01 (AudioContext closed in finally) mitigated as designed.

## Self-Check: PASSED

- `src/lib/tree.ts` contains `export function getBFSLeavesWithDepth(` ✓
- `src/lib/media.ts` contains `export async function detectAudioTrack(file: File): Promise<boolean>` ✓
- `src/lib/media.ts` FillActions contains `setHasAudioTrack: (nodeId: string, hasAudio: boolean) => void` ✓
- `src/store/gridStore.ts` contains `setHasAudioTrack: (nodeId: string, hasAudio: boolean) =>` ✓
- `src/store/gridStore.ts` setHasAudioTrack does NOT contain `pushSnapshot` ✓
- `src/test/phase19-foundation.test.ts` exists with 14 passing tests ✓
- Commit 04133b4 exists ✓
