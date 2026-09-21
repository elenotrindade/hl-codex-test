import { describe, expect, it } from 'vitest';
import { cloneArtworkDocument, createDefaultArtworkDocument, DEFAULT_LAYER_NAME, documentFromSnapshot, flattenVisibleMarks, getActiveLayer } from '../src/artwork-document';
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
});
