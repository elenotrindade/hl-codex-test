import { describe, expect, it } from 'vitest';
import { metalStops, paintMetal } from '../src/metal-paint';

describe('metal paint', () => {
  it('keeps gold and chrome on different palettes', () => {
    expect(metalStops('gold')[0]).toBe('#fff6c2');
    expect(metalStops('chrome')[0]).toBe('#f7f9fb');
    expect(metalStops('copper')).toContain('#e08a52');
    expect(metalStops('iridescent')).toEqual(metalStops('iridescent'));
  });

  it('fills every dab from one scene-wide sheen', () => {
    const created: number[][] = [];
    const stops: string[] = [];
    const ctx = {
      fillStyle: '' as string | object,
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => {
        created.push([x0, y0, x1, y1]);
        return { addColorStop: (offset: number, color: string) => { stops.push(`${offset}:${color}`); } };
      },
    };
    const context = ctx as unknown as Parameters<typeof paintMetal>[0];
    paintMetal(context, 'gold', 20, 30, 8, 1000, 400);
    paintMetal(context, 'gold', 80, 90, 8, 1000, 400);
    expect(created).toEqual([[0, 48, 1000, 352]]);
    expect(stops[0]).toBe('0:#fff6c2');
    expect(stops.at(-1)).toContain('#e7b423');
  });
});
