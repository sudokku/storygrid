---
phase: quick
plan: 260405-uiy
subsystem: video-export
tags: [video-export, loop, modulo, bug-fix, tdd]
dependency_graph:
  requires: [src/lib/videoExport.ts, src/lib/videoRegistry.ts]
  provides: [computeLoopedTime export, loop-aware seekAllVideosTo]
  affects: [video export pipeline, frame capture]
tech_stack:
  added: []
  patterns: [modulo-based loop replication, pure helper extraction for testability]
key_files:
  created:
    - src/test/videoExport-loop.test.ts
  modified:
    - src/lib/videoExport.ts
decisions:
  - "computeLoopedTime extracted as exported pure function for testability — seekAllVideosTo delegates to it per video element"
  - "Edge case guard uses !duration || !isFinite(duration) || duration <= 0 — covers zero, NaN, and Infinity in a single expression"
  - "Also brought in src/lib/videoRegistry.ts from feature/mobile-ui as prerequisite (was missing from worktree branch)"
metrics:
  duration: 4min
  completed: "2026-04-05"
  tasks: 1
  files: 3
---

# Quick Task 260405-uiy: Fix Video Export Loop Flicker When Short

**One-liner:** Modulo-based seek in `seekAllVideosTo` replicates `video.loop=true` during frame-by-frame video export, eliminating flicker when shorter videos reach the end of a longer video's duration.

## What Was Done

### Task 1: Fix seekAllVideosTo to loop shorter videos via modulo arithmetic (TDD)

**Problem:** During video export, `seekAllVideosTo(timeSeconds)` seeks all video elements to the raw timestamp. When `timeSeconds` exceeds a shorter video's duration, the seek goes past the video's end, producing undefined frame data (flicker). The editor uses `video.loop = true` so the browser handles looping natively during playback, but the export pipeline manually seeks frame-by-frame, bypassing that mechanism entirely.

**Solution:**

1. Added `computeLoopedTime(timeSeconds, duration)` as an exported pure helper at the top of `videoExport.ts`. It computes `timeSeconds % duration` with guards for zero, NaN, and Infinity durations (all fall back to 0).

2. Updated `seekAllVideosTo` to call `computeLoopedTime(timeSeconds, video.duration)` per video element before setting `currentTime`. The early-exit comparison also uses `effectiveTime` so the 0.01s threshold check is accurate.

**Commits:**
- `73e0e2d` — `test(quick-260405-uiy)`: failing tests (RED phase)
- `84ec61f` — `feat(quick-260405-uiy)`: implementation + videoRegistry.ts (GREEN phase)

## Verification

```
npx vitest run src/test/videoExport-loop.test.ts
```

All 6 tests pass:
- Test 1: time < duration — no modulo needed, value unchanged
- Test 2: time > duration (7s, 3s duration) — returns 1s (7 % 3)
- Test 3: exact multiple (6s, 3s duration) — returns 0 (clean restart)
- Test 4 (zero): duration=0 — returns 0
- Test 4 (NaN): duration=NaN — returns 0
- Test 4 (Infinity): duration=Infinity — returns 0

## Deviations from Plan

**1. [Rule 3 - Blocking] Added videoRegistry.ts from feature/mobile-ui**

- **Found during:** Task setup
- **Issue:** The worktree branch (`worktree-agent-ae68faf4`) did not have `src/lib/videoExport.ts` or `src/lib/videoRegistry.ts`. Both files exist only on `feature/mobile-ui`. This plan targets these files.
- **Fix:** Checked out both files from `feature/mobile-ui` via `git show feature/mobile-ui:src/lib/... >` before implementing the plan changes.
- **Files modified:** `src/lib/videoRegistry.ts` (added), `src/lib/videoExport.ts` (added, then modified)
- **Commit:** `84ec61f`

## Known Stubs

None — all four behaviors are fully implemented and verified.

## Self-Check: PASSED

- `src/lib/videoExport.ts` — FOUND
- `src/lib/videoRegistry.ts` — FOUND
- `src/test/videoExport-loop.test.ts` — FOUND
- Commit `73e0e2d` — FOUND
- Commit `84ec61f` — FOUND
