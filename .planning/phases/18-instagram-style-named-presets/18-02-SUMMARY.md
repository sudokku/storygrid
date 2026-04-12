---
phase: 18-instagram-style-named-presets
plan: "02"
subsystem: effects-ui
tags: [effects, presets, instagram, live-filter-preview, ui]
dependency_graph:
  requires: [18-01]
  provides: [live-filter-chip-previews, D-11-toggle-off-ui, sample-jpg-asset]
  affects: [src/Editor/EffectsPanel.tsx, src/assets/presets/]
tech_stack:
  added: []
  patterns: [css-filter-live-preview, ffmpeg-asset-generation]
key_files:
  created:
    - src/assets/presets/sample.jpg
  modified:
    - src/Editor/EffectsPanel.tsx
    - src/Editor/__tests__/EffectsPanel.test.tsx
    - src/assets/presets/README.md
  deleted:
    - src/assets/presets/bw.png
    - src/assets/presets/sepia.png
    - src/assets/presets/vivid.png
    - src/assets/presets/fade.png
    - src/assets/presets/warm.png
    - src/assets/presets/cool.png
decisions:
  - "sample.jpg generated via ffmpeg lavfi color source + drawbox filter (192x192 JPEG, 2KB) — ImageMagick not available on build machine"
  - "chipFilterStr computed inline per chip in the render loop using effectsToFilterString({ ...PRESET_VALUES[name], preset: name })"
  - "D-11 toggle-off is UI-transparent: applyPreset in gridStore handles toggle internally; no UI branching needed in onClick"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-12"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 4
---

# Phase 18 Plan 02: EffectsPanel UI — Live Filter Chips, Toggle-Off, Sample Photo Summary

Updated EffectsPanel to show 6 Instagram-named preset chips with live CSS-filter previews using a bundled sample.jpg, deleted the 6 old static PNG thumbnails, and added D-11 toggle-off test coverage.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update EffectsPanel UI — live filter chips, toggle-off, sample photo, delete old PNGs | 2753a2a | src/Editor/EffectsPanel.tsx, src/assets/presets/sample.jpg, src/assets/presets/README.md, (deleted 6 PNGs) |
| 2 | Update EffectsPanel.test.tsx for new preset names and D-05/D-11 behavior | e402c17 | src/Editor/__tests__/EffectsPanel.test.tsx |

## What Was Built

**Task 1 — EffectsPanel UI update:**
- Created `src/assets/presets/sample.jpg` — 192x192px JPEG with warm-toned color blocks generated via ffmpeg, suitable for showing CSS filter differences across presets
- Removed all 6 old PNG imports (`clarendonThumb`, `larkThumb`, etc.) and `PRESET_THUMBS` record
- Added imports: `sampleThumb` from `sample.jpg`, `effectsToFilterString` and `PRESET_VALUES` from `effects.ts`
- Each chip now computes `chipFilterStr = effectsToFilterString({ ...PRESET_VALUES[name], preset: name })` and applies `style={{ filter: chipFilterStr }}` to the `<img>` — live accurate CSS filter preview matching the actual preset
- Toggle-off behavior (D-11) is handled transparently in `applyPreset` store action — no UI change needed
- Deleted old PNGs: bw.png, sepia.png, vivid.png, fade.png, warm.png, cool.png
- Updated README.md to document the new live-preview approach

**Task 2 — Test updates:**
- Updated "clicking the Moon chip" test → "clicking the Clarendon chip" with `brightness: 25` assertion
- Added D-05 assertions (`sepia: 0, hueRotate: 0, grayscale: 0`) after slider clears preset in D-15 test
- Added new D-11 toggle-off test: applies Moon preset, clicks again, verifies `preset: null` + sepia/hueRotate/grayscale zeroed + brightness/contrast preserved at Moon's values (10/10)
- 9/9 EffectsPanel tests pass

## Deviations from Plan

### Auto-fixed Issues

None.

### Asset Generation Method

The plan specified using `npx tsx` with the `canvas` npm package or ImageMagick's `convert`. Neither was available (`canvas` package not installed, ImageMagick not present). Used `ffmpeg` (available at `/opt/homebrew/bin/ffmpeg`) with `-f lavfi -i "color=..."` + `drawbox` filter to generate the 192x192 JPEG. Result is a valid JPEG at `src/assets/presets/sample.jpg` (2KB) with warm-toned color blocks. Not tracked as a Rule deviation — same outcome, different tool.

## Known Stubs

None. Task 3 (visual verification checkpoint) is pending — this SUMMARY covers the 2 automated tasks only.

## Verification

- `npx tsc --noEmit` — 0 errors
- `npx vitest run src/Editor/__tests__/EffectsPanel.test.tsx` — 9/9 pass
- `npx vitest run` — 639 pass / 2 pre-existing failures in phase17-has-audio-track.test.ts (unrelated)

## Self-Check: PASSED

- `src/Editor/EffectsPanel.tsx` modified: FOUND
- `src/assets/presets/sample.jpg` created: FOUND
- `src/assets/presets/README.md` updated: FOUND
- bw.png deleted: CONFIRMED
- Commit 2753a2a: FOUND
- Commit e402c17: FOUND
