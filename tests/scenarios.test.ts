import { describe, expect, it } from 'vitest';
import { getScenario, isInsidePaintableArea, paintableDripFloor, scenarios } from '../src/scenarios';

describe('paint scenarios', () => {
  it('exposes train, wall, and vehicle scenes with shared geometry contracts', () => {
    expect(scenarios.map(scenario => scenario.id)).toEqual(['train', 'wall', 'vehicle']);
    for (const scenario of scenarios) {
      expect(scenario.width).toBe(1000);
      expect(scenario.height).toBe(400);
      expect(scenario.imageSrc).toMatch(/^\/references\/.+\.png$/);
      expect(scenario.snapshotBackground).toMatch(/^#[0-9a-f]{6}$/i);
      expect(scenario.template()).toContain('class="scene-photo"');
      expect(scenario.template()).toContain('class="scene-lighting"');
      expect(scenario.paintableRegions.length).toBeGreaterThan(0);
    }
  });

  it('hit tests every scenario against its own paintable regions', () => {
    for (const scenario of scenarios) {
      for (const region of scenario.paintableRegions) {
        expect(isInsidePaintableArea(scenario, { x: region.x + region.width / 2, y: region.y + region.height / 2 })).toBe(true);
      }
      const firstRegion = scenario.paintableRegions[0];
      expect(isInsidePaintableArea(scenario, { x: firstRegion.x - 0.001, y: firstRegion.y + firstRegion.height / 2 })).toBe(false);
      expect(isInsidePaintableArea(scenario, { x: NaN, y: scenario.paintableRegions[0].y })).toBe(false);
    }
  });

  it('matches the visible reference surfaces instead of the full photo frame', () => {
    expect(getScenario('train').paintableRegions).toEqual([
      { x: 0.055, y: 0.24, width: 0.89, height: 0.43 },
    ]);
    expect(getScenario('wall').paintableRegions).toEqual([
      { x: 0, y: 0.2, width: 1, height: 0.62 },
    ]);
    expect(getScenario('vehicle').paintableRegions).toEqual([
      { x: 0.15, y: 0.13, width: 0.64, height: 0.36 },
      { x: 0.15, y: 0.49, width: 0.66, height: 0.22 },
      { x: 0.79, y: 0.2, width: 0.17, height: 0.46 },
    ]);

    expect(isInsidePaintableArea(getScenario('vehicle'), { x: 0.5, y: 0.1 })).toBe(false);
    expect(isInsidePaintableArea(getScenario('vehicle'), { x: 0.5, y: 0.3 })).toBe(true);
    expect(isInsidePaintableArea(getScenario('vehicle'), { x: 0.95, y: 0.68 })).toBe(false);
    expect(paintableDripFloor(getScenario('train'), { x: 0.5, y: 0.3 })).toBeCloseTo(0.37);
    expect(paintableDripFloor(getScenario('train'), { x: 0.01, y: 0.3 })).toBe(0);
  });

  it('looks up scenarios and falls back to train for unknown values', () => {
    expect(getScenario('wall').label).toBe('Wall');
    expect(getScenario('missing' as 'train').id).toBe('train');
  });
});
