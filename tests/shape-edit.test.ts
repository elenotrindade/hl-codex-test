import { describe, expect, it } from 'vitest';
import { hitShapeBody, hitShapeHandle, moveShapeMark, resizeShapeMark, shapeHandlePoints } from '../src/shape-edit';

const rect = { x: 0.2, y: 0.3, texture: 'shape', shape: { kind: 'rect', x2: 0.6, y2: 0.5, fill: true } };
const ellipse = { x: 0.7, y: 0.55, texture: 'shape', shape: { kind: 'ellipse', x2: 0.4, y2: 0.35, fill: false } };

describe('shape editing', () => {
  it('puts resize handles on the box, even when the drag ran up and left', () => {
    expect(shapeHandlePoints(ellipse).find(handle => handle.id === 'se')).toEqual({ id: 'se', x: 0.7, y: 0.55 });
    expect(shapeHandlePoints(ellipse).find(handle => handle.id === 'nw')).toEqual({ id: 'nw', x: 0.4, y: 0.35 });
  });

  it('resizes the grabbed side and keeps the opposite corner', () => {
    const next = resizeShapeMark(rect, 'se', { x: 0.8, y: 0.62 });
    expect(next).toMatchObject({ x: 0.2, y: 0.3, shape: { x2: 0.8, y2: 0.62, kind: 'rect' } });
    const edge = resizeShapeMark(rect, 'e', { x: 0.9, y: 0.1 });
    expect(edge).toMatchObject({ x: 0.2, y: 0.3, shape: { x2: 0.9, y2: 0.5 } });
  });

  it('moves both corners together', () => {
    expect(moveShapeMark(rect, 0.05, -0.04)).toMatchObject({ x: 0.25, y: 0.26, shape: { x2: 0.65, y2: 0.46 } });
  });

  it('hits the body and the nearest handle', () => {
    expect(hitShapeBody(rect, { x: 0.4, y: 0.4 })).toBe(true);
    expect(hitShapeBody(rect, { x: 0.9, y: 0.9 })).toBe(false);
    expect(hitShapeHandle(rect, { x: 0.6, y: 0.5 })).toBe('se');
    expect(hitShapeHandle({ ...rect, shape: { ...rect.shape, kind: 'line' } }, { x: 0.2, y: 0.3 })).toBe('start');
  });
});
