---
phase: 18-instagram-style-named-presets
plan: "01"
subsystem: effects-data-layer
tags: [effects, presets, instagram, filter-pipeline, store]
dependency_graph:
  requires: []
  provides: [extended-EffectSettings-type, instagram-PRESET_VALUES, D-05-slider-clearing, D-11-toggle-off]
  affects: [src/lib/effects.ts, src/store/gridStore.ts, src/Editor/EffectsPanel.tsx]
tech_stack:
  added: []
  patterns: [TDD-red-green, immer-draft-mutations, zustand-immer-middleware]
key_files:
  created: []
  modified:
    - src/lib/effects.ts
    - src/lib/effects.test.ts
    - src/store/gridStore.ts
    - src/store/gridStore.test.ts
    - src/test/canvas-export.test.ts
    - src/test/videoExport-audio.test.ts
    - src/Editor/EffectsPanel.tsx
    - src/Editor/__tests__/EffectsPanel.test.tsx
decisions:
  - "EffectsPanel.tsx updated with new Instagram preset names and placeholder thumbnails (old asset files reused); Plan 02 will replace with proper thumbnails"
  - "phase17-has-audio-track.test.ts failures confirmed pre-existing, out of scope for this plan"
metrics:
  duration: "~18 minutes"
  completed: "2026-04-12"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 8
---

# Phase 18 Plan 01: Filter Pipeline Extension + Instagram Preset Data Layer Summary

Extended the filter pipeline with 3 new CSS filter fields (sepia, hueRotate, grayscale), replaced the 6 generic preset keys with 6 Instagram-named presets (clarendon, lark, juno, reyes, moon, inkwell), and wired D-05 slider-clears-preset-only-fields and D-11 toggle-off logic into the store.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend effects.ts types, defaults, preset values, and effectsToFilterString | 92d3c4f | src/lib/effects.ts, src/lib/effects.test.ts |
| 2 | Update gridStore setEffects/applyPreset + fix all test inline EffectSettings assertions | 3c5f9a1 | src/store/gridStore.ts, src/store/gridStore.test.ts, src/test/canvas-export.test.ts, src/test/videoExport-audio.test.ts, src/Editor/EffectsPanel.tsx, src/Editor/__tests__/EffectsPanel.test.tsx |

## What Was Built

**Task 1 — effects.ts data layer:**
- `PresetName` type replaced: 6 old generic keys → 6 Instagram keys (`clarendon | lark | juno | reyes | moon | inkwell`)
- `EffectSettings` extended with 3 new numeric fields: `sepia: number`, `hueRotate: number`, `grayscale: number`
- `DEFAULT_EFFECTS` extended with `sepia: 0, hueRotate: 0, grayscale: 0`
- `PRESET_VALUES` replaced with 6 research-backed Instagram tuples
- `effectsToFilterString` extended to emit `sepia(N%)`, `hue-rotate(Ndeg)`, `grayscale(N%)` in correct order (between saturate and blur)
- Full test suite replacement: 20 tests covering all presets, filter emission, order verification

**Task 2 — Store logic + test fixes:**
- `setEffects` (D-05): when a slider changes while a preset is active, zeros `sepia`, `hueRotate`, and `grayscale` in addition to clearing `preset: null`
- `applyPreset` (D-11): clicking the active preset toggles it off — clears preset flag and zeros preset-only fields, leaving brightness/contrast/saturation/blur unchanged
- All test files updated to use new preset names and 3 new required EffectSettings fields
- `EffectsPanel.tsx` updated to use new Instagram preset names with placeholder thumbnails (Rule 1 auto-fix)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] EffectsPanel.tsx used invalid PresetName values**
- **Found during:** Task 2 test run
- **Issue:** `EffectsPanel.tsx` hardcoded old preset names ('bw', 'sepia', 'vivid', 'fade', 'warm', 'cool') which are no longer valid `PresetName` values — TypeScript would error and tests were failing
- **Fix:** Updated `EffectsPanel.tsx` to use new Instagram preset names (`clarendon`, `lark`, `juno`, `reyes`, `moon`, `inkwell`) with existing thumbnail assets as placeholders. Updated `EffectsPanel.test.tsx` to match.
- **Files modified:** `src/Editor/EffectsPanel.tsx`, `src/Editor/__tests__/EffectsPanel.test.tsx`
- **Commit:** 3c5f9a1

## Pre-existing Failures (Out of Scope)

`src/test/phase17-has-audio-track.test.ts` — 2 test failures confirmed pre-existing before this plan's changes. Logged to deferred items, not caused by or related to Plan 01 changes.

## Known Stubs

- `EffectsPanel.tsx` uses existing Phase 11 thumbnail images (`bw.png`, `sepia.png`, etc.) mapped to new preset names as placeholders. Plan 02 will add proper Instagram-style thumbnails.

## Verification

- `npx vitest run src/lib/effects.test.ts` — 20/20 pass
- `npx vitest run` — 638/640 pass (2 pre-existing failures in phase17-has-audio-track.test.ts, unrelated)
- `npx tsc --noEmit` — 0 errors

## Self-Check: PASSED

- `src/lib/effects.ts` modified: FOUND
- `src/lib/effects.test.ts` modified: FOUND
- `src/store/gridStore.ts` modified: FOUND
- `src/store/gridStore.test.ts` modified: FOUND
- Commit 92d3c4f: FOUND
- Commit 3c5f9a1: FOUND
