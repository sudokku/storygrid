import { describe, it, expect } from 'vitest';
import {
  DEFAULT_EFFECTS,
  PRESET_VALUES,
  effectsToFilterString,
  type EffectSettings,
} from './effects';

describe('DEFAULT_EFFECTS', () => {
  it('has preset null and all 7 sliders at 0', () => {
    expect(DEFAULT_EFFECTS).toEqual({
      preset: null,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      blur: 0,
      sepia: 0,
      hueRotate: 0,
      grayscale: 0,
    });
  });
});

describe('PRESET_VALUES', () => {
  it('has exactly the six Instagram preset keys', () => {
    expect(Object.keys(PRESET_VALUES).sort()).toEqual(
      ['clarendon', 'inkwell', 'juno', 'lark', 'moon', 'reyes'],
    );
  });

  it('clarendon matches spec', () => {
    expect(PRESET_VALUES.clarendon).toEqual({ brightness: 25, contrast: 25, saturation: 0, blur: 0, sepia: 15, hueRotate: 5, grayscale: 0 });
  });

  it('lark matches spec', () => {
    expect(PRESET_VALUES.lark).toEqual({ brightness: 30, contrast: 20, saturation: 25, blur: 0, sepia: 25, hueRotate: 0, grayscale: 0 });
  });

  it('juno matches spec', () => {
    expect(PRESET_VALUES.juno).toEqual({ brightness: 15, contrast: 15, saturation: 80, blur: 0, sepia: 35, hueRotate: 0, grayscale: 0 });
  });

  it('reyes matches spec', () => {
    expect(PRESET_VALUES.reyes).toEqual({ brightness: 10, contrast: -15, saturation: -25, blur: 0, sepia: 22, hueRotate: 0, grayscale: 0 });
  });

  it('moon matches spec', () => {
    expect(PRESET_VALUES.moon).toEqual({ brightness: 10, contrast: 10, saturation: 0, blur: 0, sepia: 0, hueRotate: 0, grayscale: 100 });
  });

  it('inkwell matches spec', () => {
    expect(PRESET_VALUES.inkwell).toEqual({ brightness: 10, contrast: 10, saturation: 0, blur: 0, sepia: 30, hueRotate: 0, grayscale: 100 });
  });

  it('every entry has exactly the seven numeric fields', () => {
    for (const key of Object.keys(PRESET_VALUES) as Array<keyof typeof PRESET_VALUES>) {
      const entry = PRESET_VALUES[key];
      expect(Object.keys(entry).sort()).toEqual(['blur', 'brightness', 'contrast', 'grayscale', 'hueRotate', 'saturation', 'sepia']);
      expect(typeof entry.brightness).toBe('number');
      expect(typeof entry.contrast).toBe('number');
      expect(typeof entry.saturation).toBe('number');
      expect(typeof entry.blur).toBe('number');
      expect(typeof entry.sepia).toBe('number');
      expect(typeof entry.hueRotate).toBe('number');
      expect(typeof entry.grayscale).toBe('number');
    }
  });

  it('every preset produces a non-none filter string', () => {
    for (const key of Object.keys(PRESET_VALUES) as Array<keyof typeof PRESET_VALUES>) {
      const effects: EffectSettings = { preset: key, ...PRESET_VALUES[key] };
      expect(effectsToFilterString(effects)).not.toBe('none');
    }
  });
});

describe('effectsToFilterString', () => {
  it("returns 'none' for DEFAULT_EFFECTS", () => {
    expect(effectsToFilterString(DEFAULT_EFFECTS)).toBe('none');
  });

  it('composes a single brightness filter', () => {
    const e: EffectSettings = { ...DEFAULT_EFFECTS, brightness: 50 };
    expect(effectsToFilterString(e)).toBe('brightness(1.5)');
  });

  it('composes brightness at the lower extreme', () => {
    const e: EffectSettings = { ...DEFAULT_EFFECTS, brightness: -100 };
    expect(effectsToFilterString(e)).toBe('brightness(0)');
  });

  it('emits sepia(22%) when sepia=22', () => {
    const e: EffectSettings = { ...DEFAULT_EFFECTS, sepia: 22 };
    expect(effectsToFilterString(e)).toBe('sepia(22%)');
  });

  it('emits hue-rotate(5deg) when hueRotate=5', () => {
    const e: EffectSettings = { ...DEFAULT_EFFECTS, hueRotate: 5 };
    expect(effectsToFilterString(e)).toBe('hue-rotate(5deg)');
  });

  it('emits grayscale(100%) when grayscale=100', () => {
    const e: EffectSettings = { ...DEFAULT_EFFECTS, grayscale: 100 };
    expect(effectsToFilterString(e)).toBe('grayscale(100%)');
  });

  it('omits sepia/hue-rotate/grayscale when zero — emits only blur(5px)', () => {
    const e: EffectSettings = { ...DEFAULT_EFFECTS, blur: 5 };
    expect(effectsToFilterString(e)).toBe('blur(5px)');
  });

  it('full order: brightness, contrast, saturate, sepia, hue-rotate, grayscale, blur', () => {
    const e: EffectSettings = { preset: null, brightness: 50, contrast: -20, saturation: 40, blur: 5, sepia: 22, hueRotate: 5, grayscale: 50 };
    expect(effectsToFilterString(e)).toBe('brightness(1.5) contrast(0.8) saturate(1.4) sepia(22%) hue-rotate(5deg) grayscale(50%) blur(5px)');
  });

  it('applies order: brightness < contrast < saturate < sepia < hue-rotate < grayscale < blur', () => {
    const e: EffectSettings = { preset: null, brightness: 10, contrast: 10, saturation: 10, blur: 2, sepia: 10, hueRotate: 10, grayscale: 10 };
    const result = effectsToFilterString(e);
    const bIdx = result.indexOf('brightness');
    const cIdx = result.indexOf('contrast');
    const sIdx = result.indexOf('saturate');
    const sepIdx = result.indexOf('sepia');
    const hrIdx = result.indexOf('hue-rotate');
    const gIdx = result.indexOf('grayscale');
    const blIdx = result.indexOf('blur');
    expect(bIdx).toBeLessThan(cIdx);
    expect(cIdx).toBeLessThan(sIdx);
    expect(sIdx).toBeLessThan(sepIdx);
    expect(sepIdx).toBeLessThan(hrIdx);
    expect(hrIdx).toBeLessThan(gIdx);
    expect(gIdx).toBeLessThan(blIdx);
  });

  it('emits only blur when other sliders are zero', () => {
    const e: EffectSettings = { ...DEFAULT_EFFECTS, blur: 12 };
    expect(effectsToFilterString(e)).toBe('blur(12px)');
  });
});
