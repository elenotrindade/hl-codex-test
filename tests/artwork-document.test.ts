import { describe, expect, it } from 'vitest';
import { cloneArtworkDocument, createDefaultArtworkDocument, createLayer, DEFAULT_LAYER_NAME, documentFromSnapshot, flattenVisibleMarks, getActiveLayer, renameLayer, selectLayer, setLayerLocked } from '../src/artwork-document';
import { type PaintMark } from '../src/train-painter';

const mark: PaintMark = { x: 0.5, y: 0.5, size: 0.025, opacity: 0.8, color: '#e2483d', texture: 'solid' };

describe('artwork documents', () => {
  it('creates a default editable layer document', () => {
    const document = createDefaultArtworkDocument('2026-09-17T12:00:00.000Z');
    expect(document).toMatchObject({ version: 2, activeLayerId: 'paint-layer-1', updatedAt: '2026-09-17T12:00:00.000Z' });
    expect(document.layers).toEqual([{ id: 'paint-layer-1', name: DEFAULT_LAYER_NAME, visible: true, locked: false, marks: [], createdAt: document.updatedAt, updatedAt: document.updatedAt }]);
  });

  it('migrates flat snapshots into one active paint layer', () => {
    const document = documentFromSnapshot({ marks: [mark], updatedAt: '2026-09-17T12:00:00.000Z' });
    expect(getActiveLayer(document)?.marks).toEqual([mark]);
    expect(flattenVisibleMarks(document)).toEqual([mark]);
  });

  it('deep clones documents and marks', () => {
    const document = documentFromSnapshot({ marks: [mark], updatedAt: '2026-09-17T12:00:00.000Z' });
    const clone = cloneArtworkDocument(document);
    clone.layers[0].marks[0].x = 0.6;
    expect(document.layers[0].marks[0].x).toBe(0.5);
  });

  it('creates and selects a top layer with a safe generated name', () => {
    const document = createDefaultArtworkDocument('2026-09-17T12:00:00.000Z');
    const layer = createLayer(document, '  ', '2026-09-17T12:01:00.000Z');
    expect(layer).toMatchObject({ id: 'paint-layer-2', name: 'Paint layer 2', visible: true, locked: false, marks: [] });
    expect(document.activeLayerId).toBe('paint-layer-2');
    expect(document.layers.at(-1)).toBe(layer);
  });

  it('selects, renames, and locks existing layers without changing missing ids', () => {
    const document = createDefaultArtworkDocument('2026-09-17T12:00:00.000Z');
    const layer = createLayer(document, 'Highlights', '2026-09-17T12:01:00.000Z');
    expect(selectLayer(document, 'paint-layer-1', '2026-09-17T12:02:00.000Z')?.id).toBe('paint-layer-1');
    expect(document.activeLayerId).toBe('paint-layer-1');
    expect(renameLayer(document, layer.id, '  Fresh highlights  ', '2026-09-17T12:03:00.000Z')?.name).toBe('Fresh highlights');
    expect(setLayerLocked(document, layer.id, true, '2026-09-17T12:04:00.000Z')?.locked).toBe(true);
    expect(selectLayer(document, 'missing')).toBeNull();
    expect(renameLayer(document, 'missing', 'Nope')).toBeNull();
    expect(setLayerLocked(document, 'missing', false)).toBeNull();
  });
});
