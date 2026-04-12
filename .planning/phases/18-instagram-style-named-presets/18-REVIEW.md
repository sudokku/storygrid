---
phase: 18-instagram-style-named-presets
reviewed: 2026-04-12T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/lib/effects.ts
  - src/lib/effects.test.ts
  - src/store/gridStore.ts
  - src/store/gridStore.test.ts
  - src/Editor/EffectsPanel.tsx
  - src/Editor/__tests__/EffectsPanel.test.tsx
  - src/test/canvas-export.test.ts
  - src/test/videoExport-audio.test.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-04-12
**Depth:** standard
**Files Reviewed:** 7 (plus `src/test/videoExport-audio.test.ts` and `src/test/canvas-export.test.ts` for context — these were not modified by phase 18 beyond test helper shape updates)
**Status:** issues_found

## Summary

Phase 18 adds six Instagram-named presets (Clarendon, Lark, Juno, Reyes, Moon, Inkwell) to the EffectsPanel. The core implementation is sound: CSS filter units are all correct, `effectsToFilterString` is well-tested, the D-11 toggle-off path correctly resets all fields to `DEFAULT_EFFECTS`, and the live chip preview applies the filter to the thumbnail image correctly.

Three issues require attention. The most actionable is a test assertion in `EffectsPanel.test.tsx` that directly contradicts the store's actual behavior for D-11 toggle-off — it will either silently pass with wrong expectations or document a contract the store does not implement. The other two are logical gaps in `setEffects` that are not exploitable from the current 4-slider UI but could cause silent state corruption if the store API is called directly.

---

## Warnings

### WR-01: EffectsPanel test contradicts store contract for D-11 toggle-off

**File:** `src/Editor/__tests__/EffectsPanel.test.tsx:128-131`

**Issue:** The test for D-11 toggle-off asserts that after clicking the active Moon preset a second time, `brightness` and `contrast` retain their preset values (10 each):

```ts
// Slider values from Moon preset are preserved (D-11)
expect(leaf.effects.brightness).toBe(10);
expect(leaf.effects.contrast).toBe(10);
```

However, `gridStore.ts:276` does `{ ...DEFAULT_EFFECTS }` on toggle-off, which sets `brightness` and `contrast` to 0. The `gridStore.test.ts` tests on lines 136–178 correctly assert all fields are 0 after toggle-off. There is a direct contradiction:

- Store implementation: toggle-off resets ALL 7 numeric fields to 0 (DEFAULT_EFFECTS).
- EffectsPanel test: asserts brightness=10 and contrast=10 are preserved after toggle-off.

If the EffectsPanel test passes today, it means the assertion on the preserved values never actually runs or the test setup differs from what it appears to test. Either way, the test documents an incorrect contract. The intended behavior per the store and gridStore.test.ts is that ALL fields reset to 0.

**Fix:** Remove the two contradictory assertions (lines 129–130) and replace with the correct expectation:

```ts
// D-11: toggle off resets ALL fields including slider values
expect(leaf.effects.brightness).toBe(0);
expect(leaf.effects.contrast).toBe(0);
```

---

### WR-02: `setEffects` does not clear `preset` when `sepia`, `hueRotate`, or `grayscale` are passed directly

**File:** `src/store/gridStore.ts:243-247`

**Issue:** The `touchesNumeric` guard only watches the four slider-exposed fields:

```ts
const touchesNumeric =
  'brightness' in partial ||
  'contrast' in partial ||
  'saturation' in partial ||
  'blur' in partial;
```

The three "preset-exclusive" fields — `sepia`, `hueRotate`, `grayscale` — are not included. If any code calls `setEffects(id, { sepia: 0 })` or `setEffects(id, { grayscale: 0 })` while a preset is active, the `preset` flag is NOT cleared. The leaf ends up with `preset: 'clarendon'` (or whichever) but with overridden sepia/hueRotate/grayscale values, making the preset label in the UI incorrect relative to the actual filter applied.

The current panel UI only exposes 4 sliders so this cannot be triggered through the UI today, but it is a correctness gap in the store action contract. Any future feature that adds sepia/hueRotate/grayscale sliders, or any code calling `setEffects` directly (e.g., a copy-paste or template migration action), would silently produce corrupted state.

**Fix:** Extend `touchesNumeric` to cover all non-preset numeric fields, or rename it to `touchesSlider` and add the three preset-only fields:

```ts
const touchesNumeric =
  'brightness' in partial ||
  'contrast' in partial ||
  'saturation' in partial ||
  'blur' in partial ||
  'sepia' in partial ||
  'hueRotate' in partial ||
  'grayscale' in partial;
```

---

### WR-03: Keyboard nudge on slider pushes a new snapshot on every key press

**File:** `src/Editor/EffectsPanel.tsx:81-85`

**Issue:** `onKeyDown` calls `beginEffectsDrag` when `!isDraggingRef.current && KEYBOARD_NUDGE_KEYS.has(e.key)`. However `isDraggingRef` is only set to `true` in `onPointerDown` — it is never set during keyboard use. As a result, holding ArrowRight (or pressing it multiple times) will call `beginEffectsDrag` on every key-down event after the first, pushing a new history snapshot for each key press. The intent is one undo entry per "interaction session", but keyboard nudging produces N snapshots for N key presses.

```ts
onKeyDown={(e) => {
  if (!isDraggingRef.current && KEYBOARD_NUDGE_KEYS.has(e.key)) {
    useGridStore.getState().beginEffectsDrag(nodeId);
    // isDraggingRef is never set true here, so next key press pushes another snapshot
  }
}}
```

**Fix:** Set a separate `isKeyNudgingRef` (or reuse `isDraggingRef`) when a keyboard nudge session begins, and reset it on `onBlur` or `onKeyUp`:

```ts
onKeyDown={(e) => {
  if (!isDraggingRef.current && KEYBOARD_NUDGE_KEYS.has(e.key)) {
    isDraggingRef.current = true;
    useGridStore.getState().beginEffectsDrag(nodeId);
  }
}}
onKeyUp={() => {
  isDraggingRef.current = false;
}}
onBlur={() => {
  isDraggingRef.current = false;
}}
```

---

## Info

### IN-01: `chipFilterStr` spreads unused `preset` field into `effectsToFilterString`

**File:** `src/Editor/EffectsPanel.tsx:104`

**Issue:** The preset chip filter is computed as:

```ts
const chipFilterStr = effectsToFilterString({ ...PRESET_VALUES[name], preset: name });
```

`effectsToFilterString` never reads the `preset` field — it only uses the seven numeric fields. Passing `preset: name` is harmless but adds a redundant field that could mislead a reader into thinking `effectsToFilterString` branches on preset identity.

**Fix:** Pass only the numeric fields:

```ts
const chipFilterStr = effectsToFilterString({ ...PRESET_VALUES[name], preset: null });
```

Or rely on the `EffectSettings` type directly and keep it as-is with a comment explaining that `preset` is structurally required but not read by the function.

---

### IN-02: `DEFAULT_EFFECTS` spread in `applyPreset` toggle-off is redundant

**File:** `src/store/gridStore.ts:276`

**Issue:** The toggle-off path does:

```ts
const nextEffects: EffectSettings = { ...DEFAULT_EFFECTS };
```

The spread is unnecessary since `DEFAULT_EFFECTS` is already a plain object literal (not a proxy or mutable reference). `DEFAULT_EFFECTS` itself could be used directly, or the redundant spread can stay with a comment. This is low priority but `resetEffects` (line 295) uses the same pattern `{ ...DEFAULT_EFFECTS }`, so at least the code is consistent.

**Fix (optional):** No change required, but if the team prefers explicit copies for defensive immutability, add a comment:

```ts
// Spread to ensure we never mutate DEFAULT_EFFECTS by reference
const nextEffects: EffectSettings = { ...DEFAULT_EFFECTS };
```

---

_Reviewed: 2026-04-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
