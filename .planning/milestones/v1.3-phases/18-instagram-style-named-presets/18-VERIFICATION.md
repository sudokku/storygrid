---
phase: 18-instagram-style-named-presets
verified: 2026-04-12T02:10:00Z
status: gaps_found
score: 4/6 must-haves verified
re_verification: false
gaps:
  - truth: "Toggling off an active preset clears preset and zeros sepia/hueRotate/grayscale but leaves sliders unchanged"
    status: failed
    reason: "applyPreset toggle-off resets ALL fields to DEFAULT_EFFECTS (brightness/contrast/saturation/blur all go to 0). This contradicts roadmap SC-4, PRESET-04, and EffectsPanel.test.tsx line 129 which asserts brightness and contrast are preserved at the Moon preset values (10, 10). The gridStore.test.ts D-11 tests were written to verify the 'reset all' behavior, creating a test-vs-requirement conflict."
    artifacts:
      - path: "src/store/gridStore.ts"
        issue: "applyPreset toggle-off path (line 276) spreads { ...DEFAULT_EFFECTS } instead of preserving brightness/contrast/saturation/blur while only clearing preset, sepia, hueRotate, grayscale"
      - path: "src/store/gridStore.test.ts"
        issue: "D-11 tests at lines 136 and 159 assert all slider fields reset to 0, which is the wrong behavior per roadmap SC-4 and PRESET-04"
      - path: "src/Editor/__tests__/EffectsPanel.test.tsx"
        issue: "D-11 test at line 129 correctly asserts brightness=10 and contrast=10 preserved — this test FAILS"
    missing:
      - "applyPreset toggle-off should preserve brightness, contrast, saturation, blur (leaf.effects values) and only null out preset + zero sepia/hueRotate/grayscale"
      - "gridStore.test.ts D-11 tests must be updated to assert brightness/contrast/saturation/blur are preserved (not zeroed)"
  - truth: "Tests pass (full suite green)"
    status: failed
    reason: "3 tests fail: 1 from D-11 toggle-off behavior mismatch (EffectsPanel.test.tsx), 2 pre-existing failures in phase17-has-audio-track.test.ts. The phase17 failures are pre-existing and unrelated to Phase 18 changes, but the EffectsPanel D-11 failure is directly caused by Phase 18's applyPreset implementation."
    artifacts:
      - path: "src/Editor/__tests__/EffectsPanel.test.tsx"
        issue: "Test 'clicking an already-active preset chip toggles it off (D-11)' FAILS — expected brightness=10 but got 0"
    missing:
      - "Fix applyPreset toggle-off to preserve slider values (fixes EffectsPanel D-11 test and aligns with roadmap)"
human_verification:
  - test: "Visual filter preview distinctness"
    expected: "Each of the 6 preset chips shows a visually distinct thumbnail preview — Clarendon (warm, contrasty), Lark (warm, saturated), Juno (vivid orange), Reyes (faded sepia), Moon (grayscale), Inkwell (B&W with slight sepia undertone)"
    why_human: "CSS filter rendering cannot be verified programmatically in jsdom — requires a real browser"
  - test: "Export parity — PNG matches canvas preview"
    expected: "A cell with a preset applied exports as PNG with the same filter appearance as the canvas preview"
    why_human: "html-to-image PNG export requires a real browser with Canvas 2D and CSS filter rendering — cannot be tested in jsdom (Canvas 2D context not available in test environment)"
  - test: "Toggle-off UX flow"
    expected: "After toggling off a preset by clicking its active chip, the slider positions remain at the preset values (once the fix is applied)"
    why_human: "Requires visual confirmation that slider UI reflects preserved values"
---

# Phase 18: Instagram-Style Named Presets Verification Report

**Phase Goal:** Users can choose from 6 named Instagram-aesthetic presets (Clarendon, Lark, Juno, Reyes, Moon, Inkwell) that produce visually distinct results through the existing single-draw-path pipeline.
**Verified:** 2026-04-12T02:10:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | effectsToFilterString emits sepia, hue-rotate, grayscale parts when non-zero | VERIFIED | `effects.ts` lines 55-57: `if (e.sepia !== 0) parts.push(\`sepia(\${e.sepia}%)\`)` etc. |
| 2 | PRESET_VALUES contains exactly 6 keys: clarendon, lark, juno, reyes, moon, inkwell | VERIFIED | `effects.ts` lines 33-40: all 6 keys present, all with 7 numeric fields |
| 3 | EffectsPanel shows 6 named chips with live CSS-filter previews using sample.jpg | VERIFIED | `EffectsPanel.tsx` lines 102-131: PRESETS array, chipFilterStr computed, applied to img style |
| 4 | Moving a slider while a preset is active clears preset AND zeros sepia/hueRotate/grayscale (D-05) | VERIFIED | `gridStore.ts` lines 249-253: `nextEffects.preset = null; nextEffects.sepia = 0; nextEffects.hueRotate = 0; nextEffects.grayscale = 0` |
| 5 | Toggling off an active preset clears preset and zeros sepia/hueRotate/grayscale but leaves sliders unchanged (D-11) | FAILED | `gridStore.ts` line 276: toggle-off path uses `{ ...DEFAULT_EFFECTS }` which resets ALL fields including brightness/contrast/saturation/blur to 0. EffectsPanel.test.tsx D-11 test FAILS (expected brightness=10, got 0). Roadmap SC-4 and PRESET-04 require sliders to be preserved. |
| 6 | Tests pass (full suite green) | FAILED | 3 failures: 1 Phase 18 D-11 test failure (EffectsPanel.test.tsx:129), 2 pre-existing Phase 17 failures |

**Score:** 4/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/effects.ts` | Extended EffectSettings type, PresetName, PRESET_VALUES, extended effectsToFilterString | VERIFIED | All 6 presets, 7 fields, filter emission correct |
| `src/lib/effects.test.ts` | Full test suite for 6 new presets + filter functions | VERIFIED | Contains 'clarendon', no 'bw' or 'vivid' as test keys |
| `src/store/gridStore.ts` | D-05 sepia/hueRotate/grayscale clearing; toggle-off in applyPreset | PARTIAL | D-05 correct; toggle-off clears wrong fields (all vs only preset-only) |
| `src/Editor/EffectsPanel.tsx` | Live chip UI using sample.jpg and effectsToFilterString | VERIFIED | sample.jpg imported, chipFilterStr computed per chip, applied to img style |
| `src/assets/presets/sample.jpg` | Bundled sample photo for chip previews | VERIFIED | 400x267 JPEG, 35KB mountain landscape |
| `src/Editor/__tests__/EffectsPanel.test.tsx` | Updated tests including D-11 | PARTIAL | D-11 test written and correctly specifies behavior, but test FAILS due to implementation mismatch |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/effects.ts` | `src/lib/export.ts` | `effectsToFilterString` consumed by `drawLeafToCanvas` | WIRED | `export.ts` line 2: imports effectsToFilterString; line 341: used in drawLeafToCanvas |
| `src/store/gridStore.ts` | `src/lib/effects.ts` | `PRESET_VALUES` and `DEFAULT_EFFECTS` imports | WIRED | `gridStore.ts` line 6: `import { DEFAULT_EFFECTS, PRESET_VALUES } from '../lib/effects'` |
| `src/Editor/EffectsPanel.tsx` | `src/lib/effects.ts` | imports `effectsToFilterString` and `PRESET_VALUES` | WIRED | `EffectsPanel.tsx` line 5: both imported and used in chip render loop |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `EffectsPanel.tsx` chips | `chipFilterStr` | `effectsToFilterString({ ...PRESET_VALUES[name], preset: name })` | Yes — computed from hardcoded preset constants | FLOWING |
| `export.ts` drawLeafToCanvas | `filterStr` | `effectsToFilterString(effects)` where effects comes from leaf node | Yes — leaf effects written by store actions | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| effectsToFilterString emits sepia/hue-rotate/grayscale | Verified by code read | Lines 55-57 in effects.ts | PASS |
| PRESET_VALUES has 6 Instagram keys | Verified by code read | Lines 33-40 in effects.ts | PASS |
| sample.jpg is a valid JPEG | `file src/assets/presets/sample.jpg` | JPEG 400x267, 35KB | PASS |
| Old PNG files deleted | `ls src/assets/presets/` | Only README.md and sample.jpg | PASS |
| applyPreset toggle-off preserves slider values | `npm test -- --run` | EffectsPanel D-11 test FAILS (brightness=0, expected=10) | FAIL |
| Full test suite passes | `npm test -- --run` | 3 failed: 1 Phase 18, 2 pre-existing Phase 17 | FAIL |
| TypeScript: 0 errors | `npx tsc --noEmit` | 0 errors | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PRESET-01 | 18-01, 18-02 | 6 Instagram-style named presets in Effects panel | SATISFIED | 6 chips rendered, PRESET_VALUES with all 6 keys |
| PRESET-02 | 18-01, 18-02 | Each preset produces visually distinct CSS filter result | NEEDS HUMAN | Filter values are distinct (moon=grayscale:100, juno=saturation:80, etc.) but visual verification requires a real browser |
| PRESET-03 | 18-01, 18-02 | Preset + slider values combine in single draw call, identical across preview/PNG/MP4 | NEEDS HUMAN | effectsToFilterString wired to both drawLeafToCanvas and EffectsPanel preview; export parity needs visual verification |
| PRESET-04 | 18-01, 18-02 | User can reset preset selection while keeping slider adjustments | BLOCKED | Toggle-off resets ALL fields including brightness/contrast/saturation/blur — contradicts requirement. EffectsPanel D-11 test correctly checks this and FAILS. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/store/gridStore.ts` | 276 | `{ ...DEFAULT_EFFECTS }` in toggle-off spreads all zeros onto slider fields | Blocker | Violates roadmap SC-4 and PRESET-04; causes EffectsPanel D-11 test failure |
| `src/store/gridStore.test.ts` | 147-156, 170-177 | D-11 tests assert brightness=0/contrast=0 after toggle-off | Blocker | Tests were written to match the wrong implementation; must be updated alongside the fix |

### Human Verification Required

#### 1. Visual Filter Preview Distinctness

**Test:** Run `npm run dev`, open the app, create a grid, add an image. Select the cell and scroll to Effects section. Inspect each preset chip thumbnail.
**Expected:** Each chip shows a visually distinct CSS filter applied to the sample.jpg mountain photo. Clarendon = brighter/contrasty warm, Juno = vivid/saturated, Moon = grayscale, Inkwell = B&W with slight sepia.
**Why human:** CSS filter rendering in jsdom does not produce visual output; requires a real browser.

#### 2. Export Parity

**Test:** Apply a preset to a cell, then export as PNG. Compare the exported PNG to the canvas preview.
**Expected:** The exported PNG matches the canvas preview exactly — same filter effect visible.
**Why human:** Canvas 2D + html-to-image requires a real browser; jsdom reports "Canvas 2D context not available."

### Gaps Summary

**Root cause: Single implementation error in `applyPreset` toggle-off path.**

The toggle-off branch (D-11) in `gridStore.ts` was changed during Plan 02 Task 4 to use `{ ...DEFAULT_EFFECTS }` (reset all fields) based on user feedback during a checkpoint. This contradicts:
- Roadmap SC-4: "Resetting a preset clears the named preset selection while leaving brightness/contrast/saturation/blur slider values unchanged"
- PRESET-04: "User can reset a cell's preset selection while keeping slider adjustments"
- `EffectsPanel.test.tsx` D-11 test (line 129): asserts brightness=10 and contrast=10 are preserved after Moon toggle-off

The `gridStore.test.ts` D-11 tests were written to match the wrong implementation and will need to be updated alongside the fix.

**Fix required:**
```typescript
// In gridStore.ts applyPreset toggle-off path:
// WRONG (current):
const nextEffects: EffectSettings = { ...DEFAULT_EFFECTS };

// CORRECT (per roadmap):
const nextEffects: EffectSettings = {
  ...leaf.effects,   // preserve brightness, contrast, saturation, blur
  preset: null,
  sepia: 0,
  hueRotate: 0,
  grayscale: 0,
};
```

Then update `gridStore.test.ts` D-11 tests to assert that brightness/contrast/saturation/blur are preserved at the applied preset's values.

The 2 pre-existing Phase 17 failures (`phase17-has-audio-track.test.ts`) are unrelated to Phase 18 changes and do not block this phase.

---

_Verified: 2026-04-12T02:10:00Z_
_Verifier: Claude (gsd-verifier)_
