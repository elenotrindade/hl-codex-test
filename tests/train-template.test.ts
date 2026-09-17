import { describe, expect, it } from 'vitest';
import { isInsidePaintableTrainArea, PAINTABLE_REGIONS, trainTemplate } from '../src/train-template';

describe('paintable train geometry', () => {
  it('accepts the center and corners of every panel', () => {
    for (const region of PAINTABLE_REGIONS) {
      expect(isInsidePaintableTrainArea({ x: region.x + region.width / 2, y: region.y + region.height / 2 })).toBe(true);
      expect(isInsidePaintableTrainArea({ x: region.x, y: region.y })).toBe(true);
      expect(isInsidePaintableTrainArea({ x: region.x + region.width, y: region.y + region.height })).toBe(true);
    }
  });
  it.each([
    [0.5, 0.1], [0.17, 0.3], [0.235, 0.78], [0.5, 0.9],
    [0.089, 0.6], [0.911, 0.6], [0.5, 0.701], [0.5, 0.449],
    [-1, 0.5], [2, 0.5], [NaN, 0.5], [0.5, Infinity],
  ])('rejects non-paintable position (%s, %s)', (x, y) => {
    expect(isInsidePaintableTrainArea({ x, y })).toBe(false);
  });
  it('renders a train using the same coordinate space as the painter', () => {
    expect(trainTemplate()).toContain('viewBox="0 0 1000 400"');
    expect(trainTemplate()).toContain('width="820" height="100"');
  });
});
