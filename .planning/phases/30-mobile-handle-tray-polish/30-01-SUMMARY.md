---
phase: 30-mobile-handle-tray-polish
plan: "01"
subsystem: testing
tags: [tdd, wave-0, stubs, cross-requirements]
dependency_graph:
  requires: []
  provides:
    - src/dnd/useCellDraggable.test.ts
    - src/Grid/CanvasWrapper.test.ts
    - src/Editor/MobileCellTray.test.ts
  affects:
    - src/dnd/useCellDraggable.ts
    - src/Grid/CanvasWrapper.tsx
    - src/Editor/MobileCellTray.tsx
tech_stack:
  added: []
  patterns:
    - vitest renderHook for hook testing
    - vi.mock for @dnd-kit/core isolation
    - it.todo stubs for Wave 0 requirements coverage
key_files:
  created:
    - src/dnd/useCellDraggable.test.ts
    - src/Grid/CanvasWrapper.test.ts
    - src/Editor/MobileCellTray.test.ts
  modified: []
decisions:
  - "it.todo used for CanvasWrapper stubs (Wave 0): vitest marks as todo, not failure; fleshed out in Plan 30-04"
  - "useCellDraggable tests deliberately RED in Wave 0: style field missing from hook until Plan 30-02"
  - "MobileCellTray opacity test passes GREEN immediately: existing isVisible logic covers idle state"
metrics:
  duration_seconds: 178
  completed_date: "2026-04-19"
  tasks_completed: 3
  files_created: 3
  files_modified: 0
---

# Phase 30 Plan 01: Wave 0 Test Stubs (CROSS-02..08a) Summary

Three test stub files for Phase 30 requirements — RED for useCellDraggable style tests, todo stubs for CanvasWrapper side-effects and MobileCellTray drag visibility.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useCellDraggable.test.ts stub (CROSS-02, CROSS-03) | af211ad | src/dnd/useCellDraggable.test.ts |
| 2 | Create CanvasWrapper.test.ts stub (CROSS-04..07) | 3c632e3 | src/Grid/CanvasWrapper.test.ts |
| 3 | Create MobileCellTray.test.ts stub (CROSS-08a) | 11803e1 | src/Editor/MobileCellTray.test.ts |

## Verification Results

```
src/dnd/useCellDraggable.test.ts  — 4 failing (intentional RED, Wave 1 makes them green)
src/Grid/CanvasWrapper.test.ts    — 10 todo, 0 failures
src/Editor/MobileCellTray.test.ts — 1 passed, 3 todo, 0 failures
```

Pre-existing failures confirmed unchanged (3 unrelated tests in ActionBar and phase22 files).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

All three files are intentionally stub-level:
- `src/dnd/useCellDraggable.test.ts`: 4 tests RED until Wave 1 adds `style` to the hook
- `src/Grid/CanvasWrapper.test.ts`: 12 `it.todo` stubs, filled out in Plan 30-04
- `src/Editor/MobileCellTray.test.ts`: 3 `it.todo` stubs for drag suppression behavior, filled out in Plan 30-04

These stubs are intentional Wave 0 artifacts — they satisfy the Nyquist rule that test files exist before Wave 1 and Wave 2 implementations begin.

## Threat Flags

None — test files only; no production surface introduced.

## Self-Check: PASSED

- [x] src/dnd/useCellDraggable.test.ts exists
- [x] src/Grid/CanvasWrapper.test.ts exists
- [x] src/Editor/MobileCellTray.test.ts exists
- [x] Commits af211ad, 3c632e3, 11803e1 exist
