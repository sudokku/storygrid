---
phase: 12-per-cell-audio-toggle
plan: 02
subsystem: ui
tags: [audio, actionbar, sidebar, video, tdd]
requires:
  - Plan 12-01 LeafNode.audioEnabled + gridStore.toggleAudioEnabled
  - Existing mediaTypeMap for video-only visibility gating
provides:
  - ActionBar audio toggle button (video cells only) between Fit and Clear
  - Sidebar SelectedCellPanel Playback subsection above EffectsPanel
  - Parity styling + aria-labels across both surfaces
affects:
  - Plan 12-03 video export audio graph (UI surfaces now drive the state)
  - MobileSheet (inherits Playback subsection via shared SelectedCellPanel import)
tech-stack:
  added: []
  patterns:
    - "Video-only UI gating via mediaTypeMap[leaf.mediaId] === 'video'"
    - "Render-prop Tooltip slot matching existing ActionBar convention"
    - "Muted-state destructive styling: text-red-500 icon + hover:bg-red-500/20"
key-files:
  created: []
  modified:
    - src/Grid/ActionBar.tsx
    - src/Grid/__tests__/ActionBar.test.tsx
    - src/Editor/Sidebar.tsx
    - src/test/sidebar.test.tsx
decisions:
  - ActionBar audio button inserted AFTER Fit toggle and BEFORE the `hasMedia && Clear` block (D-04..D-09)
  - Sidebar Playback subsection labeled "Playback" (not "Audio") per D-10 forward-looking naming — future video playback controls live here
  - Sidebar audio button uses size 20 (smaller than ActionBar's ICON_SIZE=32) — deliberate hierarchy between full-overlay toolbar and inspector panel
  - Both surfaces read through `useGridStore(s => s.toggleAudioEnabled)` — single store action, no local state, single undo entry
  - Visibility gated on `mediaTypeMap[leaf.mediaId] === 'video'` — empty cells and image cells never show the toggle
metrics:
  duration: "~5 min"
  completed: "2026-04-09"
---

# Phase 12 Plan 02: UI Audio Toggle Surfaces Summary

**One-liner:** Wired the audio toggle into ActionBar and Sidebar SelectedCellPanel for video cells only, both calling the same `toggleAudioEnabled(nodeId)` store action, delivered via strict TDD (RED -> GREEN per task).

## What Shipped

### ActionBar (portal toolbar)
- `src/Grid/ActionBar.tsx`:
  - Added `Volume2, VolumeX` to the existing `lucide-react` import line.
  - Added three new store selectors: `mediaType` (looks up `mediaTypeMap[leaf.mediaId]`), `audioEnabled` (reads `leaf.audioEnabled`, defaults to `true` on missing/non-leaf), and `toggleAudioEnabled` (direct action reference).
  - New conditional JSX block `{mediaType === 'video' && (<Tooltip>...)}` inserted between the Fit toggle `<Tooltip>` and the `{hasMedia && <Clear>}` block.
  - Uses the existing render-prop Tooltip pattern verbatim. Button carries `data-testid="audio-button"`, swaps `Volume2` (white) vs `VolumeX` (`text-red-500`) based on `audioEnabled`, toggles aria-label between `Mute cell audio` and `Unmute cell audio`, and calls `toggleAudioEnabled(nodeId)` with `e.stopPropagation()` on click.

### Sidebar SelectedCellPanel
- `src/Editor/Sidebar.tsx`:
  - Added `Volume2, VolumeX` to the existing `lucide-react` import line.
  - Added two new store selectors (`audioEnabled`, `toggleAudioEnabled`). The `mediaType` selector was already present from the Phase 7 thumbnail work — reused as-is.
  - New `{mediaType === 'video' && <div data-testid="playback-section">...}` block inserted immediately BEFORE `<EffectsPanel nodeId={nodeId} />`.
  - Subsection structure: uppercase "Playback" label, a `Cell audio` row with a `sidebar-audio-button` whose icon/aria-label mirror ActionBar (Volume2 white / VolumeX red-500, `Mute` / `Unmute cell audio`). Size 20 icon is deliberately smaller than the ActionBar's 32.
  - MobileSheet inherits the subsection automatically — it already imports `SelectedCellPanel` from `./Sidebar` (no MobileSheet edit required, per D-14 and acceptance criterion).

### Test coverage (new)

**ActionBar tests** (`src/Grid/__tests__/ActionBar.test.tsx` — new `describe('ActionBar audio button (12-02)')`):
1. No audio button on empty cell (no mediaId).
2. No audio button when mediaType is `image`.
3. Audio button renders when mediaType is `video`.
4. `audioEnabled=true` -> Volume2 svg + `Mute cell audio` aria-label.
5. `audioEnabled=false` -> VolumeX svg (`text-red-500` class) + `Unmute cell audio` aria-label.
6. Click -> `toggleAudioEnabled('leaf-1')`.
7. DOM order: fit toggle < audio button < clear media button.

**Sidebar tests** (`src/test/sidebar.test.tsx` — new `describe('playback section (12-02)')`):
1. No playback section on empty cell.
2. No playback section when mediaType is `image`.
3. Playback section renders when mediaType is `video` (literal "Playback" label visible).
4. Playback section appears BEFORE EffectsPanel via `compareDocumentPosition`.
5. `audioEnabled=true` -> Volume2 svg + `Mute cell audio` aria-label.
6. `audioEnabled=false` -> VolumeX svg with `text-red-500` on the button + `Unmute cell audio` aria-label.
7. Click -> `toggleAudioEnabled('leaf-video')`.

Total new tests: **14 passing**.

## Verification

- `npx vitest run src/Grid/__tests__/ActionBar.test.tsx` -> 11 passed (7 new + 4 pre-existing).
- `npx vitest run src/test/sidebar.test.tsx` -> 27 passed (7 new + 20 pre-existing).
- `npx vitest run` (full suite) -> **563 passed, 2 skipped** across 47 test files. Delta vs Plan 12-01 snapshot (539 passed): +24 (14 from this plan + 10 from parallel Plan 12-03 audio-graph work).
- `grep` on all acceptance-criterion tokens passes: `Volume2`, `VolumeX`, `toggleAudioEnabled`, `text-red-500`, `hover:bg-red-500/20`, `Mute cell audio`, `mediaType === 'video'` in ActionBar; `Playback`, `playback-section`, `sidebar-audio-button`, `Volume2`, `VolumeX` in Sidebar.
- `grep -n "SelectedCellPanel" src/Editor/MobileSheet.tsx` -> 2 matches (import + render) — MobileSheet inherits the subsection with no code changes.

## Commits

| # | Type | Hash | Description |
|---|------|------|-------------|
| 1 | test (RED) | `42c0d76` | Add failing tests for ActionBar audio button |
| 2 | feat (GREEN) | `8ee623a` | Add audio toggle button to ActionBar for video cells |
| 3 | test (RED) | `64fb581` | Add failing tests for Sidebar Playback subsection |
| 4 | feat (GREEN) | `b3afee9` | Add Playback subsection with audio toggle to Sidebar |

(Commits `b3420ed` and `60ae975` on the same branch belong to the parallel Plan 12-03 executor — not part of this plan.)

## Deviations from Plan

None. The plan was followed task-by-task as written. No auto-fix rules triggered.

**Observation (not a deviation):** The `mediaType` selector already existed in `Sidebar.tsx` from the Phase 7 video thumbnail display path, so Task 2 only needed to add `audioEnabled` and `toggleAudioEnabled` selectors. The plan text acknowledged this possibility ("how mediaType is already derived if at all").

## Downstream Contracts Satisfied

Plan 12-03 (video export audio graph) can now rely on the UI surfaces faithfully driving `leaf.audioEnabled` via `toggleAudioEnabled` — no UI bypass, no duplicate state, both surfaces converge on the single store action. Parity is enforced by aria-label / icon / store-action symmetry across ActionBar and Sidebar.

## Known Stubs

None. Both surfaces wire real state to real store actions. Video-only visibility is real (reads `mediaTypeMap`). Muted styling is real (destructive red). No placeholder text, no disabled buttons, no TODO comments introduced.

## Self-Check: PASSED

Verified:
- `src/Grid/ActionBar.tsx` contains `Volume2`, `VolumeX`, `toggleAudioEnabled`, `data-testid="audio-button"` -> FOUND
- `src/Editor/Sidebar.tsx` contains `Volume2`, `VolumeX`, `Playback`, `playback-section`, `sidebar-audio-button`, `toggleAudioEnabled` -> FOUND
- Commit `42c0d76` (ActionBar RED) -> FOUND in `git log`
- Commit `8ee623a` (ActionBar GREEN) -> FOUND in `git log`
- Commit `64fb581` (Sidebar RED) -> FOUND in `git log`
- Commit `b3afee9` (Sidebar GREEN) -> FOUND in `git log`
- `npx vitest run` 563 passed / 2 skipped -> VERIFIED
- `npx vitest run src/Grid/__tests__/ActionBar.test.tsx -t "audio"` 7 passed -> VERIFIED
- `npx vitest run src/test/sidebar.test.tsx -t "playback"` 7 passed -> VERIFIED
