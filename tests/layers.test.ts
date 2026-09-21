import { describe, expect, it } from 'vitest';
import { addLayer, appendMarksToLayer, createDefaultLayer, createSnapshot, getRenderableLayers, getRenderableMarks, selectLayer } from '../src/layers';
import { getScenario } from '../src/scenarios';
import { type PaintMark } from '../src/train-painter';

const mark = (x: number, color = '#e2483d'): PaintMark => ({ x, y: 0.5, size: 0.025, opacity: 0.8, color, texture: 'solid' });

describe('layers', () => {
  it('creates a selected default layer and preserves copied marks', () => {
    const source = [mark(0.4)];
    const snapshot = createSnapshot(getScenario('train'), [createDefaultLayer(source, 1000)], undefined, '2026-09-17T12:00:00.000Z');
    source[0].x = 0.6;
    expect(snapshot).toMatchObject({ scenarioId: 'train', activeLayerId: 'layer-1', updatedAt: '2026-09-17T12:00:00.000Z' });
    expect(snapshot.layers[0]).toMatchObject({ id: 'layer-1', name: 'Layer 1', visible: true, createdAt: 1000, marks: [mark(0.4)] });
  });

  it('adds new layers at the top and selects only existing layer ids', () => {
    let snapshot = createSnapshot(getScenario('train'), [createDefaultLayer([], 1000)], undefined, '2026-09-17T12:00:00.000Z');
    snapshot = addLayer(snapshot, 2000);
    expect(snapshot.layers.map(layer => layer.name)).toEqual(['Layer 2', 'Layer 1']);
    expect(snapshot.activeLayerId).toBe('layer-2000-2');
    expect(selectLayer(snapshot, 'layer-1').activeLayerId).toBe('layer-1');
    expect(selectLayer(snapshot, 'missing').activeLayerId).toBe('layer-2000-2');
  });

  it('appends marks to the selected layer without changing other layers', () => {
    const bottom = createDefaultLayer([mark(0.3)], 1000);
    const top = { ...createDefaultLayer([], 2000), id: 'top', name: 'Layer 2' };
    const snapshot = createSnapshot(getScenario('train'), [top, bottom], 'top', '2026-09-17T12:00:00.000Z');
    const next = appendMarksToLayer(snapshot, 'top', [mark(0.7, '#72d6ae')], '2026-09-17T12:01:00.000Z');
    expect(next.layers[0].marks).toEqual([mark(0.7, '#72d6ae')]);
    expect(next.layers[1].marks).toEqual([mark(0.3)]);
    expect(next.updatedAt).toBe('2026-09-17T12:01:00.000Z');
  });

  it('returns visible layers bottom-to-top for single canvas replay', () => {
    const layers = [
      { ...createDefaultLayer([mark(0.8, '#111111')], 3000), id: 'top', name: 'Top' },
      { ...createDefaultLayer([mark(0.5, '#222222')], 2000), id: 'hidden', name: 'Hidden', visible: false },
      { ...createDefaultLayer([mark(0.2, '#333333')], 1000), id: 'bottom', name: 'Bottom' },
    ];
    expect(getRenderableLayers(layers).map(layer => layer.id)).toEqual(['bottom', 'top']);
    expect(getRenderableMarks(layers).map(item => item.x)).toEqual([0.2, 0.8]);
  });
});
