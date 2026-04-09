import { describe, it, expect } from 'vitest';
import {
  DEFAULT_EFFECTS,
  PRESET_VALUES,
  effectsToFilterString,
  type EffectSettings,
} from './effects';

describe('DEFAULT_EFFECTS', () => {
  it('has preset null and all sliders at 0', () => {
    expect(DEFAULT_EFFECTS).toEqual({
      preset: null,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      blur: 0,
    });
  });
});

describe('PRESET_VALUES', () => {
  it('has exactly the six documented preset keys', () => {
    expect(Object.keys(PRESET_VALUES).sort()).toEqual(
      ['bw', 'cool', 'fade', 'sepia', 'vivid', 'warm'],
    );
  });

  it('bw matches spec', () => {
    expect(PRESET_VALUES.bw).toEqual({ brightness: 0, contrast: 0, saturation: -100, blur: 0 });
  });

  it('sepia matches spec', () => {
    expect(PRESET_VALUES.sepia).toEqual({ brightness: 5, contrast: 10, saturation: -80, blur: 0 });
  });

  it('vivid matches spec', () => {
    expect(PRESET_VALUES.vivid).toEqual({ brightness: 0, contrast: 15, saturation: 40, blur: 0 });
  });

  it('fade matches spec', () => {
    expect(PRESET_VALUES.fade).toEqual({ brightness: 10, contrast: -20, saturation: -15, blur: 0 });
  });

  it('warm matches spec', () => {
    expect(PRESET_VALUES.warm).toEqual({ brightness: 5, contrast: 0, saturation: 10, blur: 0 });
  });

  it('cool matches spec', () => {
    expect(PRESET_VALUES.cool).toEqual({ brightness: -5, contrast: 0, saturation: 10, blur: 0 });
  });

  it('every entry has only the four numeric slider fields (no preset field)', () => {
    for (const key of Object.keys(PRESET_VALUES) as Array<keyof typeof PRESET_VALUES>) {
      const entry = PRESET_VALUES[key];
      expect(Object.keys(entry).sort()).toEqual(['blur', 'brightness', 'contrast', 'saturation']);
      expect(typeof entry.brightness).toBe('number');
      expect(typeof entry.contrast).toBe('number');
      expect(typeof entry.saturation).toBe('number');
      expect(typeof entry.blur).toBe('number');
    }
  });
});

describe('effectsToFilterString', () => {
  it("returns 'none' for DEFAULT_EFFECTS", () => {
    expect(effectsToFilterString(DEFAULT_EFFECTS)).toBe('none');
  });

  it('composes a single brightness filter', () => {
    const e: EffectSettings = { preset: null, brightness: 50, contrast: 0, saturation: 0, blur: 0 };
    expect(effectsToFilterString(e)).toBe('brightness(1.5)');
  });

  it('composes brightness at the lower extreme', () => {
    const e: EffectSettings = { preset: null, brightness: -100, contrast: 0, saturation: 0, blur: 0 };
    expect(effectsToFilterString(e)).toBe('brightness(0)');
  });

  it('composes brightness, contrast, saturate, blur in order', () => {
    const e: EffectSettings = { preset: null, brightness: 50, contrast: -20, saturation: 40, blur: 5 };
    expect(effectsToFilterString(e)).toBe('brightness(1.5) contrast(0.8) saturate(1.4) blur(5px)');
  });

  it('emits only blur when other sliders are zero', () => {
    const e: EffectSettings = { preset: null, brightness: 0, contrast: 0, saturation: 0, blur: 12 };
    expect(effectsToFilterString(e)).toBe('blur(12px)');
  });

  it('applies order: brightness → contrast → saturate → blur', () => {
    const e: EffectSettings = { preset: null, brightness: 10, contrast: 10, saturation: 10, blur: 2 };
    const result = effectsToFilterString(e);
    const bIdx = result.indexOf('brightness');
    const cIdx = result.indexOf('contrast');
    const sIdx = result.indexOf('saturate');
    const blIdx = result.indexOf('blur');
    expect(bIdx).toBeLessThan(cIdx);
    expect(cIdx).toBeLessThan(sIdx);
    expect(sIdx).toBeLessThan(blIdx);
  });
});
