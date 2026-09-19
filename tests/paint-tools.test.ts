import { describe, expect, it } from 'vitest';
import { DEFAULT_COLOR, colorFromWheelPoint } from '../src/paint-tools';

describe('paint tools', () => {
  it('exports the default paint color', () => {
    expect(DEFAULT_COLOR).toBe('#e2483d');
  });

  it('converts wheel points into hsl colors', () => {
    expect(colorFromWheelPoint(1, 0)).toEqual({ x: 1, y: 0, color: 'hsl(0 100% 52%)' });
    expect(colorFromWheelPoint(0, 1)).toEqual({ x: 0, y: 1, color: 'hsl(90 100% 52%)' });
    expect(colorFromWheelPoint(0, 0)).toEqual({ x: 0, y: 0, color: 'hsl(0 0% 52%)' });
  });

  it('clamps points outside the circular wheel', () => {
    expect(colorFromWheelPoint(2, 0)).toEqual({ x: 1, y: 0, color: 'hsl(0 100% 52%)' });
    expect(colorFromWheelPoint(1, 1)).toEqual({
      x: 1 / Math.SQRT2,
      y: 1 / Math.SQRT2,
      color: 'hsl(45 100% 52%)',
    });
  });
});
