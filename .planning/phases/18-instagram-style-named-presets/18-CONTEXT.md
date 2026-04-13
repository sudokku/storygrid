# Phase 18: Instagram-Style Named Presets - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the 6 generic presets (B&W, Sepia, Vivid, Fade, Warm, Cool) with 6 named
Instagram-aesthetic presets (Clarendon, Lark, Juno, Reyes, Moon, Inkwell). Extend
`EffectSettings` and `effectsToFilterString()` to support the additional CSS filter
functions these require (sepia, hue-rotate, grayscale). Update the preset chip UI to
use live CSS-filter previews instead of static PNGs.

**In scope:** Renaming preset keys, extending the filter pipeline, updating the chip
UI, updating tests, sourcing a bundled sample photo for chips.

**Out of scope:** New user-facing sliders for sepia/hueRotate/grayscale, new
EffectsPanel layout changes beyond chip toggle behavior.

</domain>

<decisions>
## Implementation Decisions

### Filter Pipeline Extension
- **D-01:** Add three new preset-only numeric fields to `EffectSettings`:
  - `sepia: number` — range 0–100 (maps to CSS `sepia(N%)`)
  - `hueRotate: number` — range 0–360 (maps to CSS `hue-rotate(Ndeg)`)
  - `grayscale: number` — range 0–100 (maps to CSS `grayscale(N%)`)
  - All three default to `0` in `DEFAULT_EFFECTS`.
- **D-02:** `effectsToFilterString()` emits `sepia`, `hue-rotate`, and `grayscale`
  parts when their value is non-zero, in addition to the existing brightness/contrast/
  saturate/blur parts. Emission order: brightness → contrast → saturate → sepia →
  hue-rotate → grayscale → blur (blur stays last to avoid clip artifacts).
- **D-03:** `PRESET_VALUES` record uses new keys: `clarendon | lark | juno | reyes |
  moon | inkwell`. Each entry is `Omit<EffectSettings, 'preset'>` — all 7 numeric
  fields (brightness, contrast, saturation, blur, sepia, hueRotate, grayscale).
- **D-04:** `PresetName` type changes to `'clarendon' | 'lark' | 'juno' | 'reyes' |
  'moon' | 'inkwell'`.

### Slider Adjust Clears Preset-Only Fields (D-15 extension)
- **D-05:** Moving any slider (brightness/contrast/saturation/blur) clears:
  - `preset → null`
  - `sepia → 0`, `hueRotate → 0`, `grayscale → 0`
  Consistent with existing D-15 behavior. User is now in full manual mode with no
  partial preset bleed from the Instagram-specific filter functions.

### Test Contract
- **D-06:** All old key-specific tests in `effects.test.ts` for `bw`, `sepia`,
  `vivid`, `fade`, `warm`, `cool` are deleted and replaced with new ones for
  `clarendon`, `lark`, `juno`, `reyes`, `moon`, `inkwell`. New tests also cover:
  - `effectsToFilterString()` emits sepia/hue-rotate/grayscale correctly when non-zero
  - `effectsToFilterString()` omits them when zero (no change to 'none' behavior)
  - `DEFAULT_EFFECTS` includes the three new fields at 0
- **D-07:** `EffectsPanel.test.tsx` is updated: old display name assertions (B&W,
  Sepia, Vivid, Fade, Warm, Cool) replaced with new names (Clarendon, Lark, Juno,
  Reyes, Moon, Inkwell). D-15 test updated to use a new preset key (e.g. `lark`).

### Preset Chip UI — Thumbnail Strategy
- **D-08:** Replace static PNG imports with a **live CSS-filter preview**. Each chip
  renders a small `<img>` of a bundled sample photo with `style={{ filter: filterStr }}`
  computed from `effectsToFilterString({ ...PRESET_VALUES[name], preset: name })`.
  No static preset PNGs are used.
- **D-09:** One shared bundled sample photo (~96×96px, royalty-free) is placed in
  `src/assets/presets/sample.jpg` (or `.png`). The researcher should suggest an
  appropriate subject (portrait or warm-toned landscape) that shows filter differences
  well. All 6 chips use the same base image.
- **D-10:** The 6 old PNG files (`bw.png`, `cool.png`, etc.) are deleted along with
  the `PRESET_THUMBS` record and their imports in `EffectsPanel.tsx`.

### PRESET-04: Toggling a Preset Off
- **D-11:** Clicking an **already-active** preset chip deselects it:
  - Sets `preset → null`
  - Sets `sepia → 0`, `hueRotate → 0`, `grayscale → 0`
  - Leaves brightness, contrast, saturation, blur sliders **unchanged**
  This is the sole mechanism for PRESET-04. No new button is added.
- **D-12:** Clicking an **inactive** preset chip applies it (existing behavior — sets
  `preset` and all 7 numeric fields from `PRESET_VALUES[name]`).

### Reset Buttons (Unchanged)
- **D-13:** "Reset effects" button behavior unchanged: restores full `DEFAULT_EFFECTS`
  (preset: null, all 7 numeric fields to 0). Implemented by the existing `resetEffects`
  store action — it just needs `DEFAULT_EFFECTS` updated with the new fields.
- **D-14:** "Reset cell" button behavior unchanged. `resetCell()` sets `DEFAULT_EFFECTS`
  which will include the new fields at 0 automatically once `DEFAULT_EFFECTS` is updated.

### Filter Value Research
- **D-15:** The researcher agent investigates known CSS Instagram filter approximations
  (well-documented open-source implementations exist). Values are research-backed and
  specified in the plan before execution. The executor does not invent values — the
  PLAN.md must contain the exact numeric tuples for all 6 presets.

### Claude's Discretion
- Exact emission order of the new filter functions in `effectsToFilterString()` within
  the preset-only block (sepia before hue-rotate before grayscale is natural but not
  mandated beyond what produces correct visual output).
- Whether the sample photo for chips is PNG or JPEG, and exact dimensions (96×96 at 2×
  for HiDPI, same as old placeholders, is the natural choice).
- Internal naming of `hueRotate` vs `hue_rotate` in the TypeScript field (camelCase
  `hueRotate` is idiomatic for TypeScript).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §PRESET-01 through PRESET-04 — the 4 acceptance criteria for this phase
- `.planning/ROADMAP.md` §Phase 18 success criteria — 5 success criteria including the effectsToFilterString single-source requirement

### Existing Implementation
- `src/lib/effects.ts` — `EffectSettings`, `PresetName`, `DEFAULT_EFFECTS`, `PRESET_VALUES`, `effectsToFilterString()`; the single source of truth for filter pipeline
- `src/lib/effects.test.ts` — contract tests to be fully replaced for new preset keys + new filter functions
- `src/Editor/EffectsPanel.tsx` — preset chip UI, slider behavior, D-15 clearing logic
- `src/Editor/__tests__/EffectsPanel.test.tsx` — panel tests to update
- `src/assets/presets/README.md` — documents the old PNG approach (to be superseded)
- `src/types/index.ts` — `LeafNode.effects: EffectSettings` field declaration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `effectsToFilterString(e: EffectSettings): string` — extend in-place, same signature
- `applyPreset(nodeId, presetName)` store action — already sets all slider fields from `PRESET_VALUES`; needs to also set sepia/hueRotate/grayscale and be updated to clear them on chip-toggle-off
- `beginEffectsDrag` / slider `onChange` in `EffectsPanel` — the D-05 clearing of preset-only fields on slider move happens here

### Established Patterns
- `PRESET_VALUES: Record<PresetName, Omit<EffectSettings, 'preset'>>` — same shape, just add 3 new numeric fields to each entry
- Chip rendering loop: `PRESETS.map(name => <button ...>` with `DISPLAY_NAMES[name]` and `PRESET_THUMBS[name]` — `PRESET_THUMBS` is replaced by computed filter strings
- The existing D-15 clearing in `EffectsPanel.tsx` sets `preset: null` when any slider changes after a preset — extend to also zero the 3 new fields

### Integration Points
- `drawLeafToCanvas()` in `src/lib/export.ts` calls `effectsToFilterString(leaf.effects)` — no change needed if `effectsToFilterString` is extended correctly
- `videoExport.ts` uses the same filter string for canvas 2D context — same, no change needed
- All test factories (`makeLeaf`, `makeTestLeaf`) that construct `EffectSettings` need updating to include the 3 new fields

</code_context>

<specifics>
## Specific Ideas

- The live CSS-filter chip approach means chips are always visually accurate to the
  actual filter values — no stale PNGs to maintain.
- The researcher should look at projects like "CSSgram" or equivalent Instagram filter
  CSS approximation libraries for reference values.
- The bundled sample photo should be a clear, well-lit image that shows warm/cool tones
  and contrast differences well — a portrait or outdoor scene works better than abstract art.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 18-instagram-style-named-presets*
*Context gathered: 2026-04-12*
