// Single source of truth for photo effects (Phase 11).
//
// This module exports the EffectSettings type, the six preset value tables, and
// the `effectsToFilterString` function that both the preview path and the
// export path rely on. Any change to the filter string contract must happen
// here — `src/lib/effects.test.ts` locks the contract against regressions.

export type PresetName = 'bw' | 'sepia' | 'vivid' | 'fade' | 'warm' | 'cool';

export type EffectSettings = {
  preset: PresetName | null;
  brightness: number; // -100..+100
  contrast: number; // -100..+100
  saturation: number; // -100..+100
  blur: number; // 0..20 (px)
};

export const DEFAULT_EFFECTS: EffectSettings = {
  preset: null,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  blur: 0,
};

export const PRESET_VALUES: Record<PresetName, Omit<EffectSettings, 'preset'>> = {
  bw:    { brightness: 0,  contrast: 0,   saturation: -100, blur: 0 },
  sepia: { brightness: 5,  contrast: 10,  saturation: -80,  blur: 0 },
  vivid: { brightness: 0,  contrast: 15,  saturation: 40,   blur: 0 },
  fade:  { brightness: 10, contrast: -20, saturation: -15,  blur: 0 },
  warm:  { brightness: 5,  contrast: 0,   saturation: 10,   blur: 0 },
  cool:  { brightness: -5, contrast: 0,   saturation: 10,   blur: 0 },
};

/**
 * Converts an EffectSettings into a CSS `filter` string.
 *
 * Contract locked by `effects.test.ts`:
 * - Returns `'none'` when every slider is at its neutral value.
 * - Emits parts only for non-neutral sliders.
 * - Order is always brightness → contrast → saturate → blur.
 */
export function effectsToFilterString(e: EffectSettings): string {
  const parts: string[] = [];
  if (e.brightness !== 0) parts.push(`brightness(${1 + e.brightness / 100})`);
  if (e.contrast !== 0) parts.push(`contrast(${1 + e.contrast / 100})`);
  if (e.saturation !== 0) parts.push(`saturate(${1 + e.saturation / 100})`);
  if (e.blur > 0) parts.push(`blur(${e.blur}px)`);
  return parts.length === 0 ? 'none' : parts.join(' ');
}
