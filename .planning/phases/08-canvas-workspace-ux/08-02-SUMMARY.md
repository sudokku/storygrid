---
phase: 08-canvas-workspace-ux
plan: 02
subsystem: editor
tags: [drop, workspace, drag-drop, ui-feedback]
requires: [autoFillCells, useGridStore]
provides: [workspace-file-drop, drag-over-ring, drop-pill-label]
affects: [src/Editor/CanvasArea.tsx]
tech_stack:
  added: []
  patterns: [dragenter-counter-pattern, datatransfer-types-guard]
key_files:
  created:
    - src/test/phase08-p02-workspace-drop.test.tsx
  modified:
    - src/Editor/CanvasArea.tsx
decisions:
  - "CanvasArea shell simplified vs plan template — existing file has no sheetSnapState, PlaybackTimeline, or mediaTypeMap; preserved current structure and added drop handlers on top"
  - "Counter pattern via useRef + dragenter/dragleave pairs; guards nested children transitions from clearing ring state (D-16)"
  - "isFileDrag guard uses Array.from(e.dataTransfer.types).includes('Files') to distinguish file drags from cell-swap drags (D-15)"
metrics:
  duration: ~6min
  completed_date: 2026-04-08
  tasks: 2
  files: 2
requirements: [DROP-01, DROP-02]
---

# Phase 8 Plan 02: Workspace File Drop Summary

Adds workspace-level file drop support on the `<main>` editor shell with an accent-blue inset ring and top-center "Drop image or video" pill while a file is being dragged. Routes accepted drops through the existing `autoFillCells` helper; cell drops remain handled exclusively by `LeafNode` via `stopPropagation`.

## Tasks Completed

| Task | Name                                     | Commit  | Files                                         |
| ---- | ---------------------------------------- | ------- | --------------------------------------------- |
| 1    | Workspace drop handlers + ring + pill    | 7c00080 | src/Editor/CanvasArea.tsx                     |
| 1    | Failing tests (TDD RED)                  | 4ea06ed | src/test/phase08-p02-workspace-drop.test.tsx  |

Note: Tasks 1 and 2 were inherently coupled under TDD. The failing tests (Task 2 scope) were written first as the RED step, then the implementation (Task 1 scope) made them GREEN.

## Implementation

- **Counter-based dragleave guard:** `dragCounter` ref increments on `dragenter`, decrements on `dragleave`, and only clears `isFileDragOver` when it reaches zero. Prevents the ring from flickering when the pointer transitions between the canvas and its children.
- **File-drag discriminator:** `Array.from(e.dataTransfer.types).includes('Files')` short-circuits all four handlers for cell-swap drags, which only carry `text/cell-id`.
- **Routing:** `onDrop` converts `e.dataTransfer.files` to a `File[]` and calls `autoFillCells`, passing `addMedia`, `setMedia`, `split`, and a fresh `getRoot` selector.
- **Visual treatment:** `ring-4 ring-[#3b82f6] ring-inset` appended to `<main>` class only when dragging; `rounded-full bg-black/70 backdrop-blur-sm` pill absolutely positioned at `top-4 left-1/2`.
- **No changes to LeafNode:** verified via `git diff --stat`; its existing `handleDrop` `stopPropagation` ensures cell drops do not reach the workspace handler.

## Deviations from Plan

### [Rule 3 - Blocking] Simplified CanvasArea shell to match current code

- **Found during:** Task 1 — reading existing CanvasArea.tsx
- **Issue:** The plan's template imported `useEditorStore.sheetSnapState`, `useGridStore.mediaTypeMap`, and `./PlaybackTimeline`, plus a three-arg `addMedia(mediaId, dataUri, type)`. None of these exist in the current codebase: CanvasArea is a 9-line shell, `FillActions.addMedia` is two-arg, and there is no `PlaybackTimeline` component or `mediaTypeMap` on the store.
- **Fix:** Kept the current shell structure (just `<main>` + `<CanvasWrapper />`) and layered the drop handlers, ring, and pill onto it. Dropped the plan's references to sheetSnapState/touchAction/hasVideos/PlaybackTimeline. The behavior contract (DROP-01/DROP-02, counter pattern, isFileDrag guard, autoFillCells routing) is fully preserved.
- **Files modified:** src/Editor/CanvasArea.tsx
- **Commit:** 7c00080

## Verification

- `npm run test -- --run src/test/phase08-p02-workspace-drop.test.tsx` — 7/7 pass
- `npm run build` — succeeds, no new warnings from my changes
- Full suite regression check: baseline had 66 failing tests; after my changes 59 failing (7 fewer — my 7 new tests all pass, nothing else moved). The 59 pre-existing failures are unrelated (`React is not defined` in toolbar/sidebar tests, etc.) and out of scope per the scope-boundary rule.

## Acceptance Criteria

- [x] `src/Editor/CanvasArea.tsx` imports `autoFillCells` from `'../lib/media'`
- [x] Contains literal `"Drop image or video"`
- [x] Contains `"ring-4 ring-[#3b82f6] ring-inset"`
- [x] Contains `data-testid="workspace-main"` and `data-testid="workspace-drop-pill"`
- [x] Contains `dragCounter` (counter pattern)
- [x] Contains `Files` inside `isFileDrag`
- [x] Has `onDragEnter`/`onDragOver`/`onDragLeave`/`onDrop` on `<main>`
- [x] `src/Grid/LeafNode.tsx` unmodified
- [x] `npm run build` succeeds
- [x] All 7 tests pass

## Success Criteria

- [x] DROP-01 satisfied: file drops anywhere in the workspace area (excluding sidebar) are accepted
- [x] DROP-02 satisfied: ring + pill clearly indicate drop acceptance during drag
- [x] Existing per-cell drop behavior unchanged
- [x] Cell-swap drags do not trigger workspace feedback

## Self-Check: PASSED

- src/Editor/CanvasArea.tsx — FOUND (modified)
- src/test/phase08-p02-workspace-drop.test.tsx — FOUND (created)
- Commit 4ea06ed — FOUND
- Commit 7c00080 — FOUND
