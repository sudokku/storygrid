---
phase: 19-auto-mute-detection-breadth-first-drop
plan: "02"
subsystem: media-lib, drop-handlers, ui-components
tags: [bfs, audio-detection, drop-03, fill-actions, auto-fill]
dependency_graph:
  requires:
    - 19-01 (getBFSLeavesWithDepth, detectAudioTrack, setHasAudioTrack, FillActions.setHasAudioTrack)
  provides:
    - BFS-ordered autoFillCells with audio detection (DROP-01, MUTE-01)
    - Single-file targeted drop in LeafNode (DROP-03)
    - setHasAudioTrack wired into all upload paths
  affects:
    - src/lib/media.ts
    - src/Grid/LeafNode.tsx
    - src/Editor/CanvasArea.tsx
    - src/Editor/Sidebar.tsx
tech_stack:
  added: []
  patterns:
    - BFS leaf traversal replaces DFS getAllLeaves in autoFillCells
    - Depth % 2 for overflow split direction (even=horizontal, odd=vertical)
    - Single-file drop targets specific cell; multi-file routes through autoFillCells
    - Audio detection wired at all three upload paths (handleDrop, handleFileChange, autoFillCells)
key_files:
  created:
    - src/test/phase19-integration.test.ts
  modified:
    - src/lib/media.ts
    - src/Grid/LeafNode.tsx
    - src/Editor/CanvasArea.tsx
    - src/Editor/Sidebar.tsx
    - src/test/media.test.ts
    - src/test/phase03-01-task2.test.ts
decisions:
  - "Single-file drops in LeafNode target that specific cell directly (DROP-03) rather than routing through BFS autoFillCells — preserves user intent when dragging to a specific cell"
  - "Overflow split direction uses lastFilledDepth % 2 (even=horizontal, odd=vertical) per D-14 — level-alternating splits produce a visually balanced grid"
  - "ES module internal call prevents vi.spyOn from intercepting detectAudioTrack from within media.ts — test verifies setHasAudioTrack behavior (outcome) instead of detectAudioTrack call (mechanism)"
  - "URL.createObjectURL mocked inline in video tests since jsdom lacks it — simpler than global setup for isolated test"
metrics:
  duration: ~15min
  completed: "2026-04-13"
  tasks: 2
  files: 6
---

# Phase 19 Plan 02: BFS autoFillCells, Targeted Drop, Audio Detection Wiring

**One-liner:** autoFillCells rewritten for BFS fill order with depth-based overflow splits and detectAudioTrack wiring; LeafNode single-file drop targets the specific cell (DROP-03); setHasAudioTrack propagated to all three upload paths.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite autoFillCells to BFS with audio detection and update tests | f17a353 | src/lib/media.ts, src/test/media.test.ts, src/test/phase03-01-task2.test.ts |
| 2 | Update LeafNode targeted drop and all FillActions call sites | 96b0987 | src/Grid/LeafNode.tsx, src/Editor/CanvasArea.tsx, src/Editor/Sidebar.tsx, src/test/phase19-integration.test.ts |

## What Was Built

### autoFillCells BFS Rewrite (Task 1)

Replaced `getAllLeaves` (DFS) with `getBFSLeavesWithDepth` from Plan 01. The function now fills cells level-by-level (BFS order), so a 2x2 grid is filled top-left → top-right → bottom-left → bottom-right instead of depth-first.

Overflow split direction changed from always-horizontal to `lastFilledDepth % 2 === 0 ? 'horizontal' : 'vertical'` per D-14. This produces alternating directions as the grid grows.

Audio detection wired after every `setMedia` call:
- Video files: `await detectAudioTrack(file)` → `setHasAudioTrack(nodeId, result)`
- Image files: `setHasAudioTrack(nodeId, false)` directly (no detection needed)

### LeafNode Single-File Targeted Drop (Task 2)

`handleDrop` now branches on file count:
- **Single file**: Direct path — `addMedia` + `setMedia(id, mediaId)` + `setHasAudioTrack(id, hasAudio)`. Targets the specific cell the user dropped onto (DROP-03). Does NOT route through `autoFillCells`.
- **Multi-file**: Routes through `autoFillCells` with BFS ordering (existing behavior, now with `setHasAudioTrack` in FillActions).

Both `handleDrop` and `handleFileChange` pass `setHasAudioTrack` in their FillActions objects.

### CanvasArea and Sidebar Updates (Task 2)

All `autoFillCells` call sites updated to include `setHasAudioTrack` in the FillActions object. Sidebar's single-file replacement branch also calls `detectAudioTrack` and `setHasAudioTrack` after `setMedia`.

### Tests

- `src/test/media.test.ts`: Added `setHasAudioTrack: vi.fn()` to `makeMockActions`, mocked `detectAudioTrack`, updated overflow test description, added 4 new tests (BFS order, 2x2 grid fill, video audio tracking, image audio tracking).
- `src/test/phase03-01-task2.test.ts`: Added `setHasAudioTrack: vi.fn()` to `makeActions`, added `vi.mock` for `detectAudioTrack`.
- `src/test/phase19-integration.test.ts` (new): 4 store-level integration tests for DROP-03 behavior.

Full suite: 653 passed / 2 skipped (pre-existing) / 4 todo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ES module binding prevents vi.spyOn from intercepting detectAudioTrack**
- **Found during:** Task 1 test iteration
- **Issue:** `vi.spyOn(mediaModule, 'detectAudioTrack')` showed 0 calls because `autoFillCells` calls `detectAudioTrack` as an internal reference within the same ES module, not via the export object.
- **Fix:** Removed assertion on `detectAudioTrack` being called directly; verified behavior via `setHasAudioTrack` being called with the correct value (which is the outcome of `detectAudioTrack`). The mock in `beforeEach` still prevents AudioContext errors.
- **Files modified:** src/test/media.test.ts

**2. [Rule 3 - Blocking] URL.createObjectURL not available in jsdom**
- **Found during:** Task 1 video test
- **Issue:** `URL.createObjectURL` throws in jsdom environment when the video upload path was exercised.
- **Fix:** Mock `URL.createObjectURL` inline in the video test with `vi.fn().mockReturnValue('blob:fake-url')` inside a try/finally.
- **Files modified:** src/test/media.test.ts

**3. [Rule 3 - Blocking] fileToBase64 not mocked in phase19-integration.test.ts**
- **Found during:** Task 2 integration test
- **Issue:** `vi.mock` factory for `'../lib/media'` didn't include `fileToBase64`, causing `mockResolvedValue` to fail at call time.
- **Fix:** Added `fileToBase64: vi.fn().mockResolvedValue('data:image/jpeg;base64,fake')` to the `vi.mock` factory.
- **Files modified:** src/test/phase19-integration.test.ts

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary crossings. File processing remains entirely client-side. T-19-04 (file.type advisory for routing) and T-19-05 (DoS via large file count) accepted as per plan's threat model.

## Self-Check: PASSED

- `src/lib/media.ts` contains `getBFSLeavesWithDepth` (not `getAllLeaves`) ✓
- `src/lib/media.ts` contains `lastFilledDepth % 2 === 0 ? 'horizontal' : 'vertical'` ✓
- `src/lib/media.ts` contains `actions.setHasAudioTrack(targetNodeId, hasAudio)` ✓
- `src/lib/media.ts` contains `await detectAudioTrack(file)` in video branch ✓
- `src/test/media.test.ts` makeMockActions contains `setHasAudioTrack: vi.fn()` ✓
- `src/Grid/LeafNode.tsx` handleDrop contains `files.length === 1` branch ✓
- `src/Grid/LeafNode.tsx` single-file branch contains `setHasAudioTrack(id, hasAudio)` ✓
- `src/Editor/CanvasArea.tsx` FillActions contains `setHasAudioTrack` ✓
- `src/Editor/Sidebar.tsx` FillActions and single-file branch contain `setHasAudioTrack` ✓
- Commits f17a353 and 96b0987 exist ✓
- Full vitest suite: 653 passed / 2 skipped / 4 todo (0 failures) ✓
