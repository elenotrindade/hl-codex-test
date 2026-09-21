import { describe, expect, it } from 'vitest';
import { clampHsv, clampRgb, describePaintColor, formatHexColor, hslToRgb, hsvToRgb, paintColorHex, parseCssColor, parseHexColor, rgbToHsv } from '../src/color-tools';

describe('color tools', () => {
  it('parses short and long hex colors and rejects invalid input', () => {
    expect(parseHexColor('#e2483d')).toEqual({ r: 226, g: 72, b: 61 });
    expect(parseHexColor('abc')).toEqual({ r: 170, g: 187, b: 204 });
    expect(parseHexColor('bad-color')).toBeNull();
  });

  it('formats and clamps RGB values', () => {
    expect(formatHexColor({ r: 300, g: 15.2, b: -1 })).toBe('#ff0f00');
    expect(clampRgb({ r: -4, g: 42.6, b: 999 })).toEqual({ r: 0, g: 43, b: 255 });
  });

  it('converts HSL and CSS color strings into hex and rgba readouts', () => {
    expect(hslToRgb(0, 100, 52)).toEqual({ r: 255, g: 10, b: 10 });
    expect(parseCssColor('hsl(0 100% 52%)')).toEqual({ r: 255, g: 10, b: 10 });
    expect(describePaintColor('#000000', 0.9)).toEqual({ hex: '#000000', rgba: 'rgba(0, 0, 0, 0.9)' });
    expect(describePaintColor('#ffffff', 1)).toEqual({ hex: '#ffffff', rgba: 'rgba(255, 255, 255, 1)' });
    expect(paintColorHex('hsl(0 100% 52%)')).toBe('#ff0a0a');
  });

  it('converts between RGB and HSV with clamped ranges', () => {
    expect(rgbToHsv({ r: 226, g: 72, b: 61 })).toEqual({ h: 4, s: 73, v: 89 });
    expect(hsvToRgb({ h: 4, s: 73, v: 89 })).toEqual({ r: 227, g: 72, b: 61 });
    expect(clampHsv({ h: 500, s: -20, v: Number.NaN })).toEqual({ h: 360, s: 0, v: 0 });
  });
});
