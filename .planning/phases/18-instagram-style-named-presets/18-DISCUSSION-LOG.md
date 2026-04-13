# Phase 18: Instagram-Style Named Presets - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 18-instagram-style-named-presets
**Areas discussed:** Filter pipeline extension, Thumbnail strategy, Filter value research, PRESET-04 reset behavior

---

## Filter Pipeline Extension

| Option | Description | Selected |
|--------|-------------|----------|
| Add preset-only fields | Add sepia (0–100), hueRotate (0–360), grayscale (0–100) to EffectSettings; sliders never touch them; effectsToFilterString() emits when non-zero | ✓ |
| Raw filter string in PRESET_VALUES | Store presetFilter string per preset, concatenated in effectsToFilterString() | |
| Approximate with existing 4 functions only | Keep EffectSettings unchanged; tune Instagram aesthetics with brightness/contrast/saturation/blur only | |

**User's choice:** Add preset-only fields (Recommended)

---

### Follow-up: Slider adjust clears preset-only fields?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, clear all preset-only fields | Moving any slider sets preset→null AND sepia/hueRotate/grayscale→0 | ✓ |
| No, keep preset-only fields on slider adjust | Slider clears preset name only; sepia/hueRotate/grayscale persist | |

**User's choice:** Yes, clear all preset-only fields

---

### Follow-up: What happens to existing contract tests?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace tests entirely | Delete old key tests; write new ones for 6 Instagram presets + new filter function coverage | ✓ |
| Keep old tests, add new ones alongside | Preserve old tests (they'd fail since old keys disappear) | |

**User's choice:** Replace tests entirely

---

## Thumbnail Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Live CSS-filter preview | Chip renders bundled sample photo with style={{filter:...}} computed live; no static PNGs needed | ✓ |
| Regenerate placeholder PNGs | Re-run generate-preset-thumbs.mjs with new names/color tints | |
| Real hand-curated photos | Source 6 actual 96×96px photos, license appropriately | |

**User's choice:** Live CSS-filter preview (Recommended)

---

### Follow-up: Base image for chips?

| Option | Description | Selected |
|--------|-------------|----------|
| Bundled sample image | Small ~96×96px royalty-free photo in src/assets/; one image for all 6 chips | ✓ |
| User's first loaded media | Dynamic preview from selected cell's media | |
| Canvas-drawn gradient | Programmatic base — no file needed | |

**User's choice:** Bundled sample image (Recommended)

---

## Filter Value Research

| Option | Description | Selected |
|--------|-------------|----------|
| Researcher investigates | gsd-phase-researcher finds known CSS Instagram filter approximations; values in PLAN.md before execution | ✓ |
| Claude's discretion | Executor picks reasonable values capturing each preset's character | |
| User provides references | User shares links or specific CSS values | |

**User's choice:** Researcher investigates (Recommended)

---

## PRESET-04 Reset Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Clicking active preset again deselects it | Chip toggle: preset→null + sepia/hueRotate/grayscale→0, sliders unchanged | ✓ |
| Add separate 'Clear preset' button | New button/x on active chip | |
| Keep existing Reset effects as-is | PRESET-04 would not be satisfied by clearing sliders too | |

**User's choice:** Clicking active preset again deselects it (Recommended)

---

### Follow-up: Reset cell button changes?

| Option | Description | Selected |
|--------|-------------|----------|
| No change to Reset cell | DEFAULT_EFFECTS with new fields at 0 handles it automatically | ✓ |
| Verify and update Reset cell | Explicitly add a test covering new fields in reset path | |

**User's choice:** No change to Reset cell (Recommended)

---

## Claude's Discretion

- Emission order of new filter functions in effectsToFilterString()
- Sample photo format (PNG vs JPEG) and exact dimensions
- TypeScript field naming (hueRotate vs hue_rotate)

## Deferred Ideas

None.
