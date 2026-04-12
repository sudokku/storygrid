// Single source of truth for photo effects (Phase 11, extended Phase 18).
//
// This module exports the EffectSettings type, the six Instagram-named preset
// value tables, and the `effectsToFilterString` function that both the preview
// path and the export path rely on. Any change to the filter string contract
// must happen here — `src/lib/effects.test.ts` locks the contract against
// regressions.

export type PresetName = 'clarendon' | 'lark' | 'juno' | 'reyes' | 'moon' | 'inkwell';

export type EffectSettings = {
  preset: PresetName | null;
  brightness: number; // -100..+100
  contrast: number; // -100..+100
  saturation: number; // -100..+100
  blur: number; // 0..20 (px)
  sepia: number; // 0-100
  hueRotate: number; // 0-360
  grayscale: number; // 0-100
};

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

export const PRESET_VALUES: Record<PresetName, Omit<EffectSettings, 'preset'>> = {
  clarendon: { brightness: 25, contrast: 25,  saturation: 0,   blur: 0, sepia: 15, hueRotate: 5, grayscale: 0   },
  lark:      { brightness: 30, contrast: 20,  saturation: 25,  blur: 0, sepia: 25, hueRotate: 0, grayscale: 0   },
  juno:      { brightness: 15, contrast: 15,  saturation: 80,  blur: 0, sepia: 35, hueRotate: 0, grayscale: 0   },
  reyes:     { brightness: 10, contrast: -15, saturation: -25, blur: 0, sepia: 22, hueRotate: 0, grayscale: 0   },
  moon:      { brightness: 10, contrast: 10,  saturation: 0,   blur: 0, sepia: 0,  hueRotate: 0, grayscale: 100 },
  inkwell:   { brightness: 10, contrast: 10,  saturation: 0,   blur: 0, sepia: 30, hueRotate: 0, grayscale: 100 },
};

/**
 * Converts an EffectSettings into a CSS `filter` string.
 *
 * Contract locked by `effects.test.ts`:
 * - Returns `'none'` when every slider is at its neutral value.
 * - Emits parts only for non-neutral sliders.
 * - Order is always brightness → contrast → saturate → sepia → hue-rotate → grayscale → blur.
 */
export function effectsToFilterString(e: EffectSettings): string {
  const parts: string[] = [];
  if (e.brightness !== 0) parts.push(`brightness(${1 + e.brightness / 100})`);
  if (e.contrast !== 0) parts.push(`contrast(${1 + e.contrast / 100})`);
  if (e.saturation !== 0) parts.push(`saturate(${1 + e.saturation / 100})`);
  if (e.sepia !== 0) parts.push(`sepia(${e.sepia}%)`);
  if (e.hueRotate !== 0) parts.push(`hue-rotate(${e.hueRotate}deg)`);
  if (e.grayscale !== 0) parts.push(`grayscale(${e.grayscale}%)`);
  if (e.blur > 0) parts.push(`blur(${e.blur}px)`);
  return parts.length === 0 ? 'none' : parts.join(' ');
}
