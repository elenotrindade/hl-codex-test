import { describe, expect, it } from 'vitest';
import { findPaintCanvas } from '../src/paint-canvas';

describe('findPaintCanvas', () => {
  it('uses the stage canvas when a brush preview canvas comes first', () => {
    const preview = { id: 'custom-brush-preview' };
    const paint = { id: 'paint' };
    const root = {
      querySelector(selector: string) {
        const matches = [
          { matches: selector === 'canvas', element: preview },
          { matches: selector === 'canvas' || selector === '.paint-stage canvas', element: paint },
        ];
        return matches.find(item => item.matches)?.element ?? null;
      },
    };

    expect(findPaintCanvas(root as unknown as ParentNode)).toBe(paint);
  });
});
