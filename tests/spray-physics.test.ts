import { describe, expect, it } from 'vitest';
import { dripSteps, sprayDripLength, stampSpray } from '../src/spray-physics';

const spray = (x: number, y = 0.45, size = 0.03) => ({
  x, y, size, opacity: 0.9, color: '#e2483d', texture: 'spray',
});

describe('spray physics', () => {
  it('grows a drip with brush size and can reach the canvas floor', () => {
    const point = { x: 0.5, y: 0.2 };
    expect(sprayDripLength(point, [], spray(0.5, 0.2))).toBe(0);
    const wet = Array.from({ length: 9 }, () => spray(0.5, 0.2, 0.03));
    const thin = sprayDripLength(point, wet, spray(0.5, 0.2, 0.02));
    const fat = sprayDripLength(point, wet, spray(0.5, 0.2, 0.08));
    expect(thin).toBeGreaterThan(0);
    expect(fat).toBeGreaterThan(thin);
    const clickWet = Array.from({ length: 11 }, () => spray(0.5, 0.2, 0.03));
    expect(sprayDripLength(point, clickWet, spray(0.5, 0.2, 0.03))).toBeLessThan(0.12);
    const soaked = Array.from({ length: 80 }, () => spray(0.5, 0.2, 0.06));
    expect(sprayDripLength({ x: 0.5, y: 0.2 }, soaked, spray(0.5, 0.2, 0.06))).toBeCloseTo(0.8);
    expect(sprayDripLength(point, soaked, { ...spray(0.5, 0.2, 0.06), dripAmount: 0 })).toBe(0);
    const light = sprayDripLength(point, wet, { ...spray(0.5, 0.2, 0.08), dripAmount: 0.25 });
    const heavy = sprayDripLength(point, wet, { ...spray(0.5, 0.2, 0.08), dripAmount: 1 });
    expect(light).toBeGreaterThan(0);
    expect(heavy).toBeGreaterThan(light);
  });

  it('stamps a tapered drip with the same commands on replay', () => {
    const calls: string[] = [];
    const ctx = {
      globalAlpha: 1,
      beginPath: () => { calls.push('begin'); },
      arc: (x: number, y: number) => { calls.push(`arc:${x.toFixed(1)}:${y.toFixed(1)}`); },
      fill: () => { calls.push('fill'); },
      fillRect: () => { calls.push('rect'); },
    };
    stampSpray(ctx, 100, 80, 12, 0.8, { x: 0.4, y: 0.4 }, 0.2, 400);
    const first = [...calls];
    calls.length = 0;
    stampSpray(ctx, 100, 80, 12, 0.8, { x: 0.4, y: 0.4 }, 0.2, 400);
    expect(calls).toEqual(first);
    expect(first.filter(call => call.startsWith('arc:')).length).toBeGreaterThan(36 + dripSteps(0.2, 12, 400));
    expect(first.some(call => call === 'rect')).toBe(false);
  });
});
