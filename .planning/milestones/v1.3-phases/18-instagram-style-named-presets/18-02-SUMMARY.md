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
  - "sample.jpg replaced with Unsplash mountain landscape (photo-1464822759023, 35KB) for better filter visibility"
  - "chipFilterStr computed inline per chip in the render loop using effectsToFilterString({ ...PRESET_VALUES[name], preset: name })"
  - "D-11 toggle-off uses { ...DEFAULT_EFFECTS } spread — resets all 7 fields including brightness/contrast/saturation/blur"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-12"
  tasks_completed: 4
  tasks_total: 4
  files_modified: 6
---

# Phase 18 Plan 02: EffectsPanel UI — Live Filter Chips, Toggle-Off, Sample Photo Summary

Updated EffectsPanel to show 6 Instagram-named preset chips with live CSS-filter previews using a bundled sample.jpg, deleted the 6 old static PNG thumbnails, and added D-11 toggle-off test coverage.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update EffectsPanel UI — live filter chips, toggle-off, sample photo, delete old PNGs | 2753a2a | src/Editor/EffectsPanel.tsx, src/assets/presets/sample.jpg, src/assets/presets/README.md, (deleted 6 PNGs) |
| 2 | Update EffectsPanel.test.tsx for new preset names and D-05/D-11 behavior | e402c17 | src/Editor/__tests__/EffectsPanel.test.tsx |
| 3 | Replace sample preset image with mountain landscape | 4c36338 | src/assets/presets/sample.jpg |
| 4 | Fix toggle-off to reset all effect sliders to neutral defaults | ed7d876 | src/store/gridStore.ts, src/store/gridStore.test.ts |

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

**Task 3 — Replace sample image (post-checkpoint fix):**
- Downloaded mountain landscape from Unsplash (photo-1464822759023-fed622ff2c3b, w=400, q=80)
- 35KB JPEG — sufficient color range and contrast to make warm/cool/bw filter effects visually distinct
- Replaces the 2KB flat color-block JPEG that had poor filter differentiation

**Task 4 — Fix toggle-off resets all sliders (post-checkpoint fix):**
- D-11 toggle-off path in `applyPreset` previously spread `...leaf.effects` then zeroed only `sepia/hueRotate/grayscale`, leaving `brightness/contrast/saturation/blur` at preset values
- Fixed: toggle-off now spreads `{ ...DEFAULT_EFFECTS }` — all 7 numeric fields plus `preset: null` reset to neutral
- Added 2 new `gridStore.test.ts` tests verifying the full reset (one for clarendon, one for juno covering saturation)
- 642 tests pass / 2 pre-existing phase17 failures unrelated to this work

## Deviations from Plan

### Auto-fixed Issues

None — post-checkpoint fixes were user-reported issues, not auto-detected deviations.

### Asset Generation Method (Task 1)

The plan specified using `npx tsx` with the `canvas` npm package or ImageMagick's `convert`. Neither was available. Used `ffmpeg` with lavfi color source. The resulting 2KB flat-color image was then replaced in Task 3 with a real mountain photograph per user feedback.

## Known Stubs

None.

## Verification

- `npx tsc --noEmit` — 0 errors
- `npx vitest run` — 642 pass / 2 pre-existing failures in phase17-has-audio-track.test.ts (unrelated)
- D-11 toggle-off tests: 2 new tests pass in src/store/gridStore.test.ts

## Self-Check: PASSED

- `src/Editor/EffectsPanel.tsx` modified: FOUND
- `src/assets/presets/sample.jpg` replaced with mountain photo (35KB): FOUND
- `src/store/gridStore.ts` toggle-off fix: FOUND (commit ed7d876)
- `src/store/gridStore.test.ts` D-11 tests added: FOUND
- Commit 2753a2a: FOUND
- Commit e402c17: FOUND
- Commit 4c36338: FOUND
- Commit ed7d876: FOUND
