import { describe, expect, it } from 'vitest';
import { BRUSH_TIPS, clampCustomBrush, DEFAULT_CUSTOM_BRUSH, fittedStampRadius, isCustomBrush, loadCustomBrush, saveCustomBrush, stampCustomBrush, type BrushTip } from '../src/custom-brush';

function stampContext() {
  const calls: string[] = [];
  const record = (name: string) => () => { calls.push(name); };
  return {
    calls,
    globalAlpha: 1,
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    rotate: record('rotate'),
    scale: record('scale'),
    transform: record('transform'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    closePath: record('closePath'),
    arc: record('arc'),
    fill: record('fill'),
    fillRect: record('fillRect'),
  };
}

describe('custom brush', () => {
  it('clamps crafted marker settings into a replayable stamp', () => {
    expect(clampCustomBrush({ angle: -400, aspect: 9, tip: 'round', softness: 4 })).toEqual({
      angle: -90,
      aspect: 1,
      tip: 'round',
      softness: 0.8,
    });
    expect(isCustomBrush(DEFAULT_CUSTOM_BRUSH)).toBe(true);
    expect(isCustomBrush({ ...DEFAULT_CUSTOM_BRUSH, tip: 'fan' })).toBe(false);
  });

  it('round trips a custom brush and falls back when storage is empty', () => {
    const data = new Map<string, string>();
    const access = () => ({
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
    });
    expect(loadCustomBrush(access)).toEqual(DEFAULT_CUSTOM_BRUSH);
    expect(saveCustomBrush({ angle: 12, aspect: 0.5, tip: 'square', softness: 0.2 }, access)).toBe(true);
    expect(loadCustomBrush(access)).toEqual({ angle: 12, aspect: 0.5, tip: 'square', softness: 0.2 });
  });

  it('stamps a chisel nib with a transform so replay can match live drawing', () => {
    const ctx = stampContext();
    stampCustomBrush(ctx, 10, 12, 8, 0.8, DEFAULT_CUSTOM_BRUSH);
    expect(ctx.globalAlpha).toBeCloseTo(0.8 * (0.42 + (1 - 0.15) * 0.48));
    expect(ctx.calls).toContain('transform');
  });

  it('draws each tip with a different stamp', () => {
    const draw = (tip: BrushTip) => {
      const ctx = stampContext();
      stampCustomBrush(ctx, 4, 6, 8, 1, { ...DEFAULT_CUSTOM_BRUSH, tip });
      return ctx.calls.join(' ');
    };
    const signatures = BRUSH_TIPS.map(draw);
    expect(new Set(signatures).size).toBe(signatures.length);
    expect(draw('square')).not.toContain('transform');
    expect(draw('wedge')).toContain('moveTo');
    expect(draw('rake').match(/fillRect/g)?.length).toBeGreaterThan(1);
    expect(draw('splatter').match(/arc/g)?.length).toBeGreaterThan(1);
  });

  it('sizes a preview stamp so a rotated nib stays inside the tile', () => {
    const radius = fittedStampRadius(80, 64, DEFAULT_CUSTOM_BRUSH);
    expect(radius * 2).toBeLessThanOrEqual(64);
    expect(fittedStampRadius(80, 48, { ...DEFAULT_CUSTOM_BRUSH, angle: 90, aspect: 1 })).toBeLessThanOrEqual(16);
  });
});
