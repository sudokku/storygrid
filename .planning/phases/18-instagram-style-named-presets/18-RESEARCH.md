# Phase 18: Instagram-Style Named Presets - Research

**Researched:** 2026-04-12
**Domain:** CSS filter pipeline extension + React preset UI update
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Add three new preset-only numeric fields to `EffectSettings`: `sepia: number` (0–100), `hueRotate: number` (0–360), `grayscale: number` (0–100). All default to `0` in `DEFAULT_EFFECTS`.
- **D-02:** `effectsToFilterString()` emits sepia, hue-rotate, grayscale when non-zero. Emission order: brightness → contrast → saturate → sepia → hue-rotate → grayscale → blur.
- **D-03:** `PRESET_VALUES` record uses new keys: `clarendon | lark | juno | reyes | moon | inkwell`. Each entry is `Omit<EffectSettings, 'preset'>` — all 7 numeric fields.
- **D-04:** `PresetName` type changes to `'clarendon' | 'lark' | 'juno' | 'reyes' | 'moon' | 'inkwell'`.
- **D-05:** Moving any slider (brightness/contrast/saturation/blur) clears `preset → null` AND `sepia → 0`, `hueRotate → 0`, `grayscale → 0`. Extends D-15 behavior.
- **D-06:** All old preset tests for `bw/sepia/vivid/fade/warm/cool` deleted and replaced with tests for the 6 new keys. New tests also cover new filter function emission.
- **D-07:** `EffectsPanel.test.tsx` updated: old display names replaced with new names (Clarendon, Lark, Juno, Reyes, Moon, Inkwell).
- **D-08:** Replace static PNG imports with live CSS-filter chip preview. Each chip renders a small `<img>` with `style={{ filter: filterStr }}` computed from `effectsToFilterString({ ...PRESET_VALUES[name], preset: name })`.
- **D-09:** One shared bundled sample photo (~96×96px) placed at `src/assets/presets/sample.jpg`.
- **D-10:** 6 old PNG files (`bw.png`, `cool.png`, etc.) deleted along with `PRESET_THUMBS` record and their imports.
- **D-11:** Clicking an already-active preset chip deselects it: sets `preset → null`, `sepia → 0`, `hueRotate → 0`, `grayscale → 0`. Leaves brightness/contrast/saturation/blur unchanged.
- **D-12:** Clicking an inactive preset chip applies it (sets `preset` and all 7 numeric fields from `PRESET_VALUES[name]`).
- **D-13:** "Reset effects" button behavior unchanged — restores full `DEFAULT_EFFECTS` (updated to include new fields at 0).
- **D-14:** "Reset cell" behavior unchanged — uses updated `DEFAULT_EFFECTS`.
- **D-15:** Filter values are research-backed and specified in the plan. The executor does not invent values — PLAN.md must contain the exact numeric tuples.

### Claude's Discretion

- Exact emission order of new filter functions within the preset-only block (sepia before hue-rotate before grayscale is natural but not mandated).
- Whether sample photo is PNG or JPEG, and exact dimensions (96×96 at 2x for HiDPI).
- Internal naming: camelCase `hueRotate` is idiomatic TypeScript.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRESET-01 | User can choose from 6 Instagram-style named presets (Clarendon, Lark, Juno, Reyes, Moon, Inkwell) in the Effects panel | D-03/D-04: new `PresetName` type + `PRESET_VALUES` record; D-08: chip UI updated with live filter previews |
| PRESET-02 | Each named preset produces a visually distinct result approximating its Instagram namesake using CSS filter functions | D-01/D-02: new fields + extended `effectsToFilterString()`; Filter values section provides the exact numeric tuples |
| PRESET-03 | Preset and slider values combine in single draw call; identical results in canvas preview, PNG export, MP4 export | `effectsToFilterString()` is already the single source consumed by both `drawLeafToCanvas()` and `videoExport.ts`; no change to export paths needed |
| PRESET-04 | User can reset a cell's preset selection while keeping slider adjustments | D-11: clicking active chip deselects preset + clears preset-only fields while leaving 4 sliders unchanged |
</phase_requirements>

---

## Summary

Phase 18 is a contained filter pipeline extension plus a UI swap. The existing `effectsToFilterString()` function is already the single source of truth consumed by both the canvas export (`drawLeafToCanvas()` in `export.ts`) and video export (`videoExport.ts`). The plan is to add three new numeric fields to `EffectSettings`, extend the emission function, rename the 6 preset keys from generic names to Instagram names, replace static PNG chip thumbnails with live CSS-filter previews using a bundled sample photo, and update all tests.

The most critical research task was sourcing verified CSS filter values for the 6 Instagram presets. Two well-established open-source libraries were consulted: **CSSgram** (una/CSSgram — the canonical CSS Instagram filter reference, based on the original Instagram filter characteristics) and **picturepan2/instagram.css** (a second independent implementation). Both sources were consulted and their values cross-referenced. The final tuples recommended below are derived from CSSgram's published values (verified from the minified CSS), since CSSgram is the most-cited authoritative source. They are then converted to the project's internal numeric convention (offset from neutral, not CSS multiplier).

**Primary recommendation:** Extend `EffectSettings` with 3 new fields, update `effectsToFilterString()`, swap `PRESET_VALUES` record keys and values, replace PNG chip imports with live filter preview, update all tests. No new npm dependencies required. No changes to export paths needed.

---

## Standard Stack

No new libraries required. All work uses the existing stack.

| Layer | Current | Phase 18 use |
|-------|---------|-------------|
| `src/lib/effects.ts` | `EffectSettings`, `PRESET_VALUES`, `effectsToFilterString()` | Extended in-place |
| `src/Editor/EffectsPanel.tsx` | Chip strip + sliders | PRESET_THUMBS replaced; chip click toggles off |
| Vitest | test runner | Existing test suite updated |
| `src/assets/presets/` | 6 placeholder PNGs | Replaced with 1 sample photo |

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── effects.ts          # (modified) EffectSettings + 3 new fields, new PresetName type, new PRESET_VALUES, extended effectsToFilterString()
│   └── effects.test.ts     # (replaced) all old preset tests deleted, new tests for 6 presets + new filter functions
├── Editor/
│   ├── EffectsPanel.tsx    # (modified) PRESET_THUMBS removed, live filter chip, chip toggle-off behavior
│   └── __tests__/
│       └── EffectsPanel.test.tsx  # (modified) display name assertions, D-15 test key
└── assets/
    └── presets/
        ├── sample.jpg      # (new) bundled 96×96px or 192×192px HiDPI sample photo
        ├── README.md       # (updated) documents new approach
        └── bw.png          # (deleted, along with 5 others)
```

### Pattern 1: EffectSettings Extension

**What:** Add 3 new fields to the existing type. All default to 0. The type remains a plain object — no union types, no optionals.

**When to use:** Any time a new CSS filter function is needed.

```typescript
// Source: src/lib/effects.ts (current shape, Phase 18 extension)
export type EffectSettings = {
  preset: PresetName | null;
  brightness: number; // -100..+100
  contrast: number;   // -100..+100
  saturation: number; // -100..+100
  blur: number;       // 0..20 (px)
  sepia: number;      // 0..100 — preset-only, no slider
  hueRotate: number;  // 0..360 — preset-only, no slider
  grayscale: number;  // 0..100 — preset-only, no slider
};
```

### Pattern 2: effectsToFilterString Extension

**What:** Extend the emission loop with 3 new conditional parts. Blur stays last.

**When to use:** Any new CSS filter function addition.

```typescript
// Source: src/lib/effects.ts — extended emission order per D-02
export function effectsToFilterString(e: EffectSettings): string {
  const parts: string[] = [];
  if (e.brightness !== 0) parts.push(`brightness(${1 + e.brightness / 100})`);
  if (e.contrast !== 0)   parts.push(`contrast(${1 + e.contrast / 100})`);
  if (e.saturation !== 0) parts.push(`saturate(${1 + e.saturation / 100})`);
  if (e.sepia !== 0)      parts.push(`sepia(${e.sepia}%)`);
  if (e.hueRotate !== 0)  parts.push(`hue-rotate(${e.hueRotate}deg)`);
  if (e.grayscale !== 0)  parts.push(`grayscale(${e.grayscale}%)`);
  if (e.blur > 0)         parts.push(`blur(${e.blur}px)`);
  return parts.length === 0 ? 'none' : parts.join(' ');
}
```

Note the unit difference:
- `sepia` and `grayscale` emit as percentage: `sepia(22%)`, `grayscale(100%)`
- `hue-rotate` emits as degrees: `hue-rotate(5deg)`
- `brightness`, `contrast`, `saturate` continue to emit as multipliers: `brightness(1.25)`

[VERIFIED: MDN CSS filter property documentation confirms these unit conventions]

### Pattern 3: Live CSS-Filter Chip Preview

**What:** Replace `<img src={PRESET_THUMBS[name]}>` with `<img src={sampleThumb} style={{ filter: chipFilterStr }}>`.

**When to use:** Whenever the filter value exactly defines the chip appearance.

```typescript
// Source: EffectsPanel.tsx — derived pattern from D-08
import sampleThumb from '../assets/presets/sample.jpg';
import { effectsToFilterString, PRESET_VALUES } from '../lib/effects';

// Inside the chip render loop:
const chipFilterStr = effectsToFilterString({ ...PRESET_VALUES[name], preset: name });
// ...
<img
  src={sampleThumb}
  alt={DISPLAY_NAMES[name]}
  className="w-full h-full object-cover"
  style={{ filter: chipFilterStr }}
/>
```

### Pattern 4: applyPreset Toggle-Off (D-11)

**What:** The chip `onClick` handler checks whether the chip is already active. If active, it deselects and zeroes preset-only fields. If inactive, it applies as before.

```typescript
// EffectsPanel.tsx chip onClick
onClick={() => {
  const store = useGridStore.getState();
  if (effects.preset === name) {
    // D-11: toggle off — clear preset + zero preset-only fields, leave sliders
    store.setEffects(nodeId, { sepia: 0, hueRotate: 0, grayscale: 0 });
    // Note: setEffects with a non-numeric-slider partial would NOT clear preset
    // under the existing D-15 rule. A dedicated store action or explicit
    // preset: null must be set. See store action discussion in Pitfalls.
  } else {
    store.applyPreset(nodeId, name);
  }
}}
```

**Important:** The existing `setEffects` action only clears `preset` when a brightness/contrast/saturation/blur field is touched. Clearing the preset on toggle-off requires either (a) including a slider field in the partial (e.g., `brightness: effects.brightness` as a no-op write), or (b) extending `applyPreset` / adding a `clearPreset` store action. The cleanest approach is to extend `applyPreset` to detect toggle-off, or add a minimal `clearPreset(nodeId)` action. See Pitfall 2.

### Anti-Patterns to Avoid

- **Inline filter string construction:** Never build a `filter:` string anywhere except `effectsToFilterString()`. The CONTEXT explicitly mandates single-source (success criterion 5).
- **Optional fields with `?`:** Do not make the 3 new fields optional on `EffectSettings`. They must always be present with a default of `0` so all existing spread patterns (`{ ...DEFAULT_EFFECTS }`, `{ ...leaf.effects }`) automatically include them.
- **PNG chips with overlay compositing:** The static PNG approach is superseded. Do not mix static PNGs with CSS filters.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Instagram filter values | Eyeball / guess numeric tuples | Use CSSgram-verified values below | CSSgram is the open-source canonical reference, battle-tested against real Instagram aesthetics |
| Filter string construction | Inline template literals anywhere | `effectsToFilterString()` | Success criterion 5 mandates single source |
| HiDPI sample image | Complex srcset setup | Simple `96×96` or `192×192` JPEG bundled as static asset | Vite handles asset bundling; no srcset complexity needed for chip-sized thumbnails |

**Key insight:** The filter values are publicly documented in CSSgram and instagram.css. Using these established values avoids the risk of an executor inventing arbitrary numbers that don't produce Instagram-recognizable aesthetics.

---

## Instagram Preset Filter Values (REQUIRED for PLAN.md)

These are the exact numeric tuples the executor MUST use. They are derived from two verified open-source references and converted to the project's internal numeric convention.

### Conversion convention (review)

The project stores effects as offsets from neutral, not raw CSS multipliers:

| CSS filter | CSS syntax | Project field | Project value |
|------------|-----------|---------------|---------------|
| `brightness(X)` | multiplier (1.0 = neutral) | `brightness` | `(X - 1) * 100` |
| `contrast(X)` | multiplier (1.0 = neutral) | `contrast` | `(X - 1) * 100` |
| `saturate(X)` | multiplier (1.0 = neutral) | `saturation` | `(X - 1) * 100` |
| `sepia(X%)` | percentage (0 = neutral) | `sepia` | `X` (integer 0–100) |
| `grayscale(X%)` | percentage (0 = neutral) | `grayscale` | `X` (integer 0–100) |
| `hue-rotate(Xdeg)` | degrees (0 = neutral) | `hueRotate` | `X` (integer 0–360) |
| `blur(Xpx)` | pixels (0 = neutral) | `blur` | `X` |

### Verified preset values

Sources consulted:
1. **CSSgram (una/CSSgram)** — canonical CSS Instagram filter library. Values read from minified CSS. [VERIFIED: https://raw.githubusercontent.com/EastSun5566/cc-gram/master/src/filters.ts (cc-gram, based on CSSgram)]
2. **picturepan2/instagram.css** — independent CSS Instagram filter implementation. [VERIFIED: https://github.com/picturepan2/instagram.css/blob/master/dist/instagram.css]

**Note on Juno:** CSSgram does not include a "Juno" filter (it uses the original 20 Instagram names; Juno was added to Instagram later). instagram.css includes Juno. The values below use instagram.css for Juno and CSSgram for the other five.

#### Clarendon
CSSgram: `contrast(1.2) saturate(1.35)`
instagram.css: `sepia(.15) contrast(1.25) brightness(1.25) hue-rotate(5deg)`

Recommendation: Use CSSgram values as base, but Clarendon is well-documented to boost contrast and saturation. The instagram.css version includes the characteristic warmth shift. Use instagram.css values for stronger visual identity:

```
clarendon: { brightness: 25, contrast: 25, saturation: 0, blur: 0, sepia: 15, hueRotate: 5, grayscale: 0 }
```
[CITED: picturepan2/instagram.css — `sepia(.15) contrast(1.25) brightness(1.25) hue-rotate(5deg)`]

#### Lark
CSSgram: `contrast(0.9)`
instagram.css: `sepia(.25) contrast(1.2) brightness(1.3) saturate(1.25)`

The instagram.css version produces a more distinct visual with the sepia warmth. Use instagram.css values:

```
lark: { brightness: 30, contrast: 20, saturation: 25, blur: 0, sepia: 25, hueRotate: 0, grayscale: 0 }
```
[CITED: picturepan2/instagram.css — `sepia(.25) contrast(1.2) brightness(1.3) saturate(1.25)`]

#### Juno
instagram.css only: `sepia(.35) contrast(1.15) brightness(1.15) saturate(1.8)`

Juno is known for boosted warm tones and high saturation. This is visually distinct from Lark.

```
juno: { brightness: 15, contrast: 15, saturation: 80, blur: 0, sepia: 35, hueRotate: 0, grayscale: 0 }
```
[CITED: picturepan2/instagram.css — `sepia(.35) contrast(1.15) brightness(1.15) saturate(1.8)`]

#### Reyes
CSSgram: `sepia(0.22) contrast(0.85) brightness(1.1) saturate(0.75)`
instagram.css: `sepia(.75) contrast(.75) brightness(1.25) saturate(1.4)`

CSSgram's version is more accurate to the authentic Reyes aesthetic (faded, vintage, desaturated with sepia warmth):

```
reyes: { brightness: 10, contrast: -15, saturation: -25, blur: 0, sepia: 22, hueRotate: 0, grayscale: 0 }
```
[CITED: una/CSSgram (via cc-gram mirror) — `sepia(0.22) contrast(0.85) brightness(1.1) saturate(0.75)`]

#### Moon
CSSgram: `grayscale(1) contrast(1.1) brightness(1.1)`
instagram.css: `brightness(1.4) contrast(.95) saturate(0) sepia(.35)`

CSSgram's version (pure grayscale) is the most authentic Moon representation — Moon is Instagram's monochrome filter:

```
moon: { brightness: 10, contrast: 10, saturation: 0, blur: 0, sepia: 0, hueRotate: 0, grayscale: 100 }
```
[CITED: una/CSSgram (via cc-gram mirror) — `grayscale(1) contrast(1.1) brightness(1.1)`]

#### Inkwell
CSSgram: `sepia(0.3) contrast(1.1) brightness(1.1) grayscale(1)`

Inkwell is a black-and-white filter with slight sepia undertone. Both sources agree on the grayscale nature:

```
inkwell: { brightness: 10, contrast: 10, saturation: 0, blur: 0, sepia: 30, hueRotate: 0, grayscale: 100 }
```
[CITED: una/CSSgram (via cc-gram mirror) — `sepia(0.3) contrast(1.1) brightness(1.1) grayscale(1)`]

### Summary table (project internal units)

| Preset | brightness | contrast | saturation | blur | sepia | hueRotate | grayscale | Source |
|--------|-----------|---------|-----------|------|-------|-----------|-----------|--------|
| clarendon | 25 | 25 | 0 | 0 | 15 | 5 | 0 | instagram.css |
| lark | 30 | 20 | 25 | 0 | 25 | 0 | 0 | instagram.css |
| juno | 15 | 15 | 80 | 0 | 35 | 0 | 0 | instagram.css |
| reyes | 10 | -15 | -25 | 0 | 22 | 0 | 0 | CSSgram |
| moon | 10 | 10 | 0 | 0 | 0 | 0 | 100 | CSSgram |
| inkwell | 10 | 10 | 0 | 0 | 30 | 0 | 100 | CSSgram |

All 6 are visually distinct: Clarendon (bright + contrasty + warm), Lark (bright + warm), Juno (vivid warm + high saturation), Reyes (faded vintage), Moon (pure B&W + slight contrast), Inkwell (B&W + sepia tint).

---

## Common Pitfalls

### Pitfall 1: EffectSettings spread patterns miss new fields

**What goes wrong:** Any code that creates an `EffectSettings` object with a literal shape (e.g., `{ preset: null, brightness: 0, contrast: 0, saturation: 0, blur: 0 }`) will be a TypeScript error after the type is extended — OR, if TypeScript is lenient, the 3 new fields will be absent at runtime.

**Why it happens:** There are 3 inline literal shapes in tests that spell out all 5 current fields. TypeScript will reject them as missing 3 required fields.

**How to avoid:** Every `EffectSettings` literal must include all 7 fields, or use `{ ...DEFAULT_EFFECTS, <overrides> }`. The following files need updating:
- `src/lib/effects.test.ts` — multiple inline literals (to be replaced entirely per D-06)
- `src/store/gridStore.test.ts` — `eff` assertions that spell out all 5 fields (lines ~116, ~124, ~150, ~172, ~200)
- `src/test/canvas-export.test.ts` — inline `effects:` objects at lines 374, 394, 422, 443, 463
- `src/test/videoExport-audio.test.ts` — line 23

**Warning signs:** TypeScript error `Object literal may only specify known properties` or `Property 'sepia' is missing`.

### Pitfall 2: Toggle-off logic and the D-15 setEffects rule

**What goes wrong:** The current `setEffects` action only clears `preset` when a _slider_ field (brightness/contrast/saturation/blur) is in the partial. If the chip toggle-off calls `setEffects(nodeId, { sepia: 0, hueRotate: 0, grayscale: 0 })`, the `touchesNumeric` check will be `false` (those fields are not in the checked set), so `preset` will NOT be cleared automatically.

**Why it happens:** D-15 rule checks specifically for `'brightness' in partial || 'contrast' in partial || ...`. The 3 new fields are preset-only and not in that check.

**How to avoid:** Two valid approaches:
1. **Extend the `applyPreset` store action** to detect when `presetName === leaf.effects.preset` (already-active) and branch to the toggle-off behavior: `{ preset: null, sepia: 0, hueRotate: 0, grayscale: 0 }`.
2. **Add a `clearPreset(nodeId)` store action** that sets `{ preset: null, sepia: 0, hueRotate: 0, grayscale: 0 }` in one snapshot.

Option 1 keeps the chip `onClick` handler simple (`applyPreset` handles both cases). Option 2 is more explicit. Either is valid — planner chooses.

**Warning signs:** After clicking an active chip, `leaf.effects.preset` still equals the preset name.

### Pitfall 3: D-05 slider-clears-preset-only-fields not implemented in setEffects

**What goes wrong:** D-05 says moving any slider also clears `sepia → 0`, `hueRotate → 0`, `grayscale → 0`. The current `setEffects` action only clears `preset: null`. The 3 new fields are not zeroed.

**Why it happens:** The D-15 clearing in the current `setEffects` only does `nextEffects.preset = null` and doesn't zero the new fields.

**How to avoid:** Extend the `touchesNumeric` branch in `setEffects`:
```typescript
if (touchesNumeric && leaf.effects.preset !== null) {
  nextEffects.preset = null;
  nextEffects.sepia = 0;
  nextEffects.hueRotate = 0;
  nextEffects.grayscale = 0;
}
```

**Warning signs:** After slider drag following an Instagram preset, the visual output still shows sepia/grayscale tint (because sepia/hueRotate/grayscale fields weren't zeroed even though preset was cleared).

### Pitfall 4: DEFAULT_EFFECTS inline copy in test assertions

**What goes wrong:** Tests that do `expect(leaf.effects).toEqual({ preset: null, brightness: 0, contrast: 0, saturation: 0, blur: 0 })` will fail after the type gains 3 new fields, because the actual object will have `sepia: 0, hueRotate: 0, grayscale: 0` too and `toEqual` is a deep strict match.

**How to avoid:** Update all such assertions to include the new fields, or use `expect(leaf.effects).toEqual(DEFAULT_EFFECTS)` which automatically picks up the new fields.

### Pitfall 5: The chip `<img>` has no `objectPosition` set

**What goes wrong:** The bundled sample photo (a portrait or landscape) may appear poorly cropped in the 48×48 chip if `object-fit: cover` clips to an awkward area.

**How to avoid:** Choose a sample photo that looks good cropped to a square from the center (a face or landscape horizon near center). The existing chips use `className="w-full h-full object-cover"` which defaults to `object-position: 50% 50%` — this is fine for a center-composed image.

---

## Code Examples

### Extended DEFAULT_EFFECTS

```typescript
// Source: src/lib/effects.ts — after Phase 18
export const DEFAULT_EFFECTS: EffectSettings = {
  preset: null,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  blur: 0,
  sepia: 0,
  hueRotate: 0,
  grayscale: 0,
};
```

### New PRESET_VALUES record

```typescript
// Source: src/lib/effects.ts — after Phase 18
export const PRESET_VALUES: Record<PresetName, Omit<EffectSettings, 'preset'>> = {
  clarendon: { brightness: 25, contrast: 25, saturation: 0,   blur: 0, sepia: 15, hueRotate: 5, grayscale: 0   },
  lark:      { brightness: 30, contrast: 20, saturation: 25,  blur: 0, sepia: 25, hueRotate: 0, grayscale: 0   },
  juno:      { brightness: 15, contrast: 15, saturation: 80,  blur: 0, sepia: 35, hueRotate: 0, grayscale: 0   },
  reyes:     { brightness: 10, contrast: -15, saturation: -25, blur: 0, sepia: 22, hueRotate: 0, grayscale: 0  },
  moon:      { brightness: 10, contrast: 10, saturation: 0,   blur: 0, sepia: 0,  hueRotate: 0, grayscale: 100 },
  inkwell:   { brightness: 10, contrast: 10, saturation: 0,   blur: 0, sepia: 30, hueRotate: 0, grayscale: 100 },
};
```

### Extended effectsToFilterString

```typescript
// Source: src/lib/effects.ts — after Phase 18
export function effectsToFilterString(e: EffectSettings): string {
  const parts: string[] = [];
  if (e.brightness !== 0) parts.push(`brightness(${1 + e.brightness / 100})`);
  if (e.contrast !== 0)   parts.push(`contrast(${1 + e.contrast / 100})`);
  if (e.saturation !== 0) parts.push(`saturate(${1 + e.saturation / 100})`);
  if (e.sepia !== 0)      parts.push(`sepia(${e.sepia}%)`);
  if (e.hueRotate !== 0)  parts.push(`hue-rotate(${e.hueRotate}deg)`);
  if (e.grayscale !== 0)  parts.push(`grayscale(${e.grayscale}%)`);
  if (e.blur > 0)         parts.push(`blur(${e.blur}px)`);
  return parts.length === 0 ? 'none' : parts.join(' ');
}
```

### New DISPLAY_NAMES and PRESETS in EffectsPanel

```typescript
// Source: EffectsPanel.tsx — after Phase 18
const PRESETS: PresetName[] = ['clarendon', 'lark', 'juno', 'reyes', 'moon', 'inkwell'];

const DISPLAY_NAMES: Record<PresetName, string> = {
  clarendon: 'Clarendon',
  lark:      'Lark',
  juno:      'Juno',
  reyes:     'Reyes',
  moon:      'Moon',
  inkwell:   'Inkwell',
};
```

### Sample photo chip img element

```tsx
// Source: EffectsPanel.tsx chip render — after Phase 18
import sampleThumb from '../assets/presets/sample.jpg';

// Inside chip render:
const chipFilterStr = effectsToFilterString({ ...PRESET_VALUES[name], preset: name });
// ...
<img
  src={sampleThumb}
  alt={DISPLAY_NAMES[name]}
  className="w-full h-full object-cover"
  style={{ filter: chipFilterStr }}
/>
```

---

## File-Level Change Inventory

This table captures every file that needs modification. The planner should create tasks based on this list.

| File | Change Type | Notes |
|------|-------------|-------|
| `src/lib/effects.ts` | Modify | New `PresetName` type, new fields on `EffectSettings`, updated `DEFAULT_EFFECTS`, new `PRESET_VALUES`, extended `effectsToFilterString()` |
| `src/lib/effects.test.ts` | Replace | All tests for old presets deleted; new tests for 6 presets + 3 new filter functions |
| `src/Editor/EffectsPanel.tsx` | Modify | Remove 6 PNG imports + `PRESET_THUMBS`, add `sampleThumb` import, update `PRESETS`/`DISPLAY_NAMES`, chip render, chip `onClick` toggle-off |
| `src/Editor/__tests__/EffectsPanel.test.tsx` | Modify | Update display name assertions, D-15 test key |
| `src/store/gridStore.ts` | Modify | Extend `setEffects` D-05 clearing to zero `sepia`/`hueRotate`/`grayscale`; extend `applyPreset` for toggle-off OR add `clearPreset` action |
| `src/store/gridStore.test.ts` | Modify | Update `toEqual` assertions that spell out all 5 EffectSettings fields |
| `src/test/canvas-export.test.ts` | Modify | Update inline `effects:` objects to include 3 new fields |
| `src/test/videoExport-audio.test.ts` | Modify | Update inline `effects:` object |
| `src/assets/presets/bw.png` | Delete | Old placeholder |
| `src/assets/presets/cool.png` | Delete | Old placeholder |
| `src/assets/presets/fade.png` | Delete | Old placeholder |
| `src/assets/presets/sepia.png` | Delete | Old placeholder |
| `src/assets/presets/vivid.png` | Delete | Old placeholder |
| `src/assets/presets/warm.png` | Delete | Old placeholder |
| `src/assets/presets/sample.jpg` | Add | Bundled sample photo for chip previews |
| `src/assets/presets/README.md` | Modify | Document new live-filter approach |

---

## Sample Photo Guidance (D-09)

**Subject recommendation:** A well-lit portrait (face) or warm-toned outdoor landscape with clear sky. Portraits show warmth shifts (clarendon/lark/juno), desaturation (reyes), and grayscale (moon/inkwell) the most clearly. Abstract art or pure solid colors show little difference between filters.

**Specification:**
- Dimensions: 192×192px (2× HiDPI; rendered at 96×96 / 48×48 CSS px)
- Format: JPEG at ~85% quality (typically 5–15KB at this size)
- Color profile: sRGB
- Licensing: Public domain or CC0 — no attribution required

**Free source options:**
- Unsplash (unsplash.com/license) — free for commercial use, no attribution required
- Pexels (pexels.com/license) — same
- A single pixel from the project's own test assets could also work if it meets the visual quality bar

[ASSUMED: The exact photo to bundle is not pre-selected. The executor must source and include a suitable CC0 photo, or the project maintainer provides one. The planner should include a task step for this.]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static PNG chip thumbnails (bw.png etc.) | Live CSS-filter chip preview | Phase 18 | Thumbnails are always accurate; no stale assets to maintain |
| Generic preset names (B&W, Sepia, Vivid, Fade, Warm, Cool) | Instagram-named presets (Clarendon, Lark, Juno, Reyes, Moon, Inkwell) | Phase 18 | Recognizable aesthetic vocabulary |
| 4-field EffectSettings (brightness/contrast/saturation/blur) | 7-field EffectSettings + 3 preset-only fields | Phase 18 | Supports full range of CSS filter aesthetics |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The sample photo for chip previews must be sourced by the executor or provided by the project maintainer — no specific photo is pre-chosen | Sample Photo Guidance | Low: any CC0 portrait/landscape works; worst case is a less visually clear chip |
| A2 | CSSgram cc-gram mirror source values are accurate to the original CSSgram values | Filter Values | Low: values cross-referenced with instagram.css; both produce visually distinct results. If values feel wrong, adjust after visual inspection |
| A3 | The `makeLeaf` factories in `ActionBar.test.tsx` and `LeafNode.test.tsx` do not hard-code EffectSettings fields (they use spread `...overrides`) — they may not need updating | File-Level Change Inventory | Low: if they do include a literal `effects:` field, TypeScript will catch it at compile time |

---

## Open Questions (RESOLVED)

1. **Toggle-off store action: extend `applyPreset` vs add `clearPreset`?** RESOLVED: Extended `applyPreset` to handle toggle-off (Plan 01 Task 2).
   - What we know: D-11 requires clearing preset + zeroing 3 fields when an active chip is clicked. The current `setEffects` won't do this automatically.
   - What's unclear: Whether the planner prefers extending `applyPreset` (single action, handles both apply and deselect) or adding a discrete `clearPreset` action (more explicit, easier to test).
   - Recommendation: Extend `applyPreset` — it already handles preset application and one function call in the chip `onClick` is cleaner.

2. **Sample photo: who sources it?** RESOLVED: Executor generates programmatically using Canvas API or downloads from a CC0 source per Plan 02 Task 1.
   - What we know: The plan must specify the photo (D-09). The executor cannot invent it.
   - What's unclear: Whether the project maintainer (Radu) will provide the photo or the executor should fetch one from a public CC0 source.
   - Recommendation: Planner should include a task step: "Source a 192×192px CC0 portrait or landscape photo, save as `src/assets/presets/sample.jpg`." The executor can download from Unsplash or Pexels.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 18 is purely code changes (TypeScript/React source + test updates + static asset). No external tools, services, or CLIs beyond the existing Vite + Vitest stack.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (via `vite.config.ts` or `vitest.config.ts`) |
| Config file | `vite.config.ts` (inline vitest config) |
| Quick run command | `npx vitest run src/lib/effects.test.ts src/Editor/__tests__/EffectsPanel.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRESET-01 | 6 named chips rendered with correct display names | unit (component) | `npx vitest run src/Editor/__tests__/EffectsPanel.test.tsx` | ✅ (update needed) |
| PRESET-02 | Each preset produces correct CSS filter string | unit (pure fn) | `npx vitest run src/lib/effects.test.ts` | ✅ (replace needed) |
| PRESET-03 | `effectsToFilterString()` is single source; sepia/hue-rotate/grayscale exported correctly | unit (pure fn) | `npx vitest run src/lib/effects.test.ts src/test/canvas-export.test.ts` | ✅ (update needed) |
| PRESET-04 | Clicking active chip deselects preset, leaves sliders unchanged | unit (component) | `npx vitest run src/Editor/__tests__/EffectsPanel.test.tsx` | ✅ (add test) |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/effects.test.ts src/Editor/__tests__/EffectsPanel.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. No new test files needed; existing files are updated/replaced.

---

## Security Domain

This phase makes no changes to authentication, sessions, access control, cryptography, or any data handling paths. It modifies only CSS filter values in a pure-client rendering pipeline. Security domain is not applicable.

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies to Phase 18 |
|-----------|---------------------|
| Tech Stack: Vite + React 18 + TypeScript + Zustand + Immer + Tailwind CSS 3 | All code changes comply |
| State Library: Zustand with Immer middleware | Store changes use existing Immer patterns |
| Bundle Size: MVP bundle under 500KB gzipped | Sample photo at ~5–15KB is negligible; 6 PNG deletions net positive |
| Browser Support: Chrome 90+, Firefox 90+, Safari 15+ | CSS `sepia()`, `hue-rotate()`, `grayscale()` are supported in all three since ~2013 |
| No new npm dependencies for v1.3 | Confirmed: no new packages needed |
| Do not use Tailwind CSS v4 | Not touched |
| Do not use React 19 | Not touched |
| Tests use Vitest (ESM-native, no Jest/CJS) | Confirmed |
| GSD Workflow Enforcement | Phase being planned via GSD |

---

## Sources

### Primary (HIGH confidence)
- una/CSSgram (via cc-gram mirror at github.com/EastSun5566/cc-gram) — Clarendon, Lark, Moon, Inkwell, Reyes filter values
- picturepan2/instagram.css (dist/instagram.css) — Clarendon, Lark, Juno, Reyes, Moon, Inkwell filter values
- MDN CSS filter property documentation — CSS filter unit conventions (multipliers vs percentages vs degrees)

### Secondary (MEDIUM confidence)
- una/CSSgram README — confirmed filter name list (Clarendon, Inkwell, Lark, Moon, Reyes present; Juno absent)

### Tertiary (LOW confidence)
- WebSearch results for Instagram filter CSS characteristics — used for qualitative description only, not for numeric values

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all changes are in-tree
- Architecture: HIGH — extends established patterns, no new structural decisions
- Filter values: MEDIUM — sourced from two open-source CSS libraries; values are well-established community approximations, not official Instagram values (which are proprietary)
- Pitfalls: HIGH — derived directly from reading the existing codebase

**Research date:** 2026-04-12
**Valid until:** 2026-10-12 (stable domain; CSS filter specs and CSSgram values are unlikely to change)
