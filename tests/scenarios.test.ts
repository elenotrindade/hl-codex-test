import { describe, expect, it } from 'vitest';
import { getScenario, isInsidePaintableArea, scenarios } from '../src/scenarios';

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
      const region = scenario.paintableRegions[0];
      expect(isInsidePaintableArea(scenario, { x: region.x + region.width / 2, y: region.y + region.height / 2 })).toBe(true);
      expect(isInsidePaintableArea(scenario, { x: region.x - 0.001, y: region.y + region.height / 2 })).toBe(false);
      expect(isInsidePaintableArea(scenario, { x: NaN, y: region.y })).toBe(false);
    }
  });

  it('looks up scenarios and falls back to train for unknown values', () => {
    expect(getScenario('wall').label).toBe('Wall');
    expect(getScenario('missing' as 'train').id).toBe('train');
  });
});
