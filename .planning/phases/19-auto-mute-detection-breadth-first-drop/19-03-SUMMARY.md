---
phase: 19-auto-mute-detection-breadth-first-drop
plan: 03
subsystem: ui
tags: [audio, mute, locked-state, actionbar, sidebar, accessibility]
dependency_graph:
  requires:
    - 19-01 (hasAudioTrack field on LeafNode + setHasAudioTrack store action)
    - 17-01 (data model foundation — LeafNode type evolution)
  provides:
    - Locked VolumeX rendering in ActionBar for no-audio video cells (MUTE-02)
    - Locked audio toggle rendering in SelectedCellPanel for no-audio video cells (MUTE-03)
  affects:
    - src/Grid/ActionBar.tsx
    - src/Editor/Sidebar.tsx
tech_stack:
  added: []
  patterns:
    - Conditional branching on hasAudioTrack selector with ?? true fallback for legacy snapshots
    - disabled HTML attribute + cursor-not-allowed + opacity-40 for locked UI state
key_files:
  created: []
  modified:
    - src/Grid/ActionBar.tsx
    - src/Editor/Sidebar.tsx
    - src/test/action-bar.test.tsx
    - src/test/sidebar.test.tsx
decisions:
  - "?? true fallback on hasAudioTrack handles legacy snapshots that predate Phase 17 data model addition"
  - "data-testid preserved on locked buttons for test compatibility with existing test selectors"
  - "Label text changes from 'Cell audio' to 'No audio track' in sidebar locked state for instant clarity"
metrics:
  duration: ~8min
  completed: 2026-04-13
  completed_tasks: 2
  total_tasks: 2
  files_modified: 4
---

# Phase 19 Plan 03: Locked Audio UI for No-Audio Video Cells Summary

**One-liner:** Disabled, dimmed VolumeX icon with "No audio track" tooltip/label for hasAudioTrack=false video cells in ActionBar and SelectedCellPanel sidebar.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add locked VolumeX state to ActionBar | 63d89cb | src/Grid/ActionBar.tsx, src/test/action-bar.test.tsx |
| 2 | Add locked audio toggle to SelectedCellPanel | bc0b465 | src/Editor/Sidebar.tsx, src/test/sidebar.test.tsx |

## What Was Built

### ActionBar (Task 1)
Added `hasAudioTrack` selector to `ActionBar.tsx` with `?? true` fallback. The existing audio button block was replaced with a conditional branch:
- `hasAudioTrack === true`: interactive Volume2/VolumeX toggle (unchanged behavior)
- `hasAudioTrack === false`: disabled button with `cursor-not-allowed`, `text-gray-400 opacity-40`, `aria-label="No audio track"`, tooltip "No audio track"

### SelectedCellPanel Sidebar (Task 2)
Added `hasAudioTrack` selector to `SelectedCellPanel`. The playback section audio button was replaced with the same conditional branch:
- `hasAudioTrack === true`: existing interactive toggle with "Cell audio" label
- `hasAudioTrack === false`: disabled button with locked styling; label text changes to "No audio track"

### Tests Added
- 4 new tests in `action-bar.test.tsx` (MUTE-02 coverage)
- 5 new tests in `sidebar.test.tsx` (MUTE-03 coverage)
- All 48 targeted tests pass; full suite: 664 pass / 2 pre-existing failures (unrelated to this plan)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no placeholder values or hardcoded stubs introduced.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. UI-only rendering changes.

## Self-Check: PASSED

- [x] src/Grid/ActionBar.tsx modified and contains `hasAudioTrack ?` branch
- [x] src/Editor/Sidebar.tsx modified and contains `hasAudioTrack ?` branch
- [x] src/test/action-bar.test.tsx contains locked-state tests
- [x] src/test/sidebar.test.tsx contains locked-state tests
- [x] Commits 63d89cb and bc0b465 exist in git log
- [x] `npx vitest run src/test/action-bar.test.tsx src/test/sidebar.test.tsx` exits 0 (48/48 pass)
