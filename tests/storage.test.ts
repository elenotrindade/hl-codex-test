import { describe, expect, it } from 'vitest';
import { ARTWORK_KEY, loadArtwork, saveArtwork, type ArtworkSnapshot } from '../src/storage';
import { TEXTURES } from '../src/train-painter';
import { getScenario } from '../src/scenarios';

const snapshot: ArtworkSnapshot = {
  marks: TEXTURES.map(texture => ({ x: 0.5, y: 0.5, size: 0.025, opacity: 0.8, color: '#e2483d', texture })),
  updatedAt: '2026-09-17T12:00:00.000Z',
};
function memory(raw: string | null = null) {
  const data = new Map<string, string>();
  if (raw !== null) data.set(ARTWORK_KEY, raw);
  return () => ({ getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); } });
}

describe('artwork storage', () => {
  it('handles missing artwork', () => {
    expect(loadArtwork(memory())).toEqual({ snapshot: null, status: 'missing' });
  });
  it('round trips every texture and persists clearing', () => {
    const storage = memory();
    expect(saveArtwork(snapshot, storage)).toBe(true);
    expect(loadArtwork(storage)).toEqual({ snapshot, status: 'loaded' });
    const cleared = { ...snapshot, marks: [] };
    expect(saveArtwork(cleared, storage)).toBe(true);
    expect(loadArtwork(storage).snapshot).toEqual(cleared);
  });
  it('keeps accepting existing flat mark snapshots without stroke history metadata', () => {
    const rawFlatSnapshot = JSON.stringify({ marks: [snapshot.marks[0]], updatedAt: snapshot.updatedAt });
    expect(loadArtwork(memory(rawFlatSnapshot))).toEqual({
      snapshot: { marks: [snapshot.marks[0]], updatedAt: snapshot.updatedAt },
      status: 'loaded',
    });
  });
  it.each(['{', 'null', '[]', '{}', JSON.stringify({ ...snapshot, updatedAt: 'no date' }),
    JSON.stringify({ ...snapshot, marks: {} }),
    ...[null, { ...snapshot.marks[0], x: 2 }, { ...snapshot.marks[0], y: 0.1 },
      { ...snapshot.marks[0], size: -1 }, { ...snapshot.marks[0], size: 1 },
      { ...snapshot.marks[0], color: 'url(bad)' }, { ...snapshot.marks[0], texture: 'unknown' }]
      .map(mark => JSON.stringify({ ...snapshot, marks: [mark] })),
  ])('rejects malformed data: %s', raw => {
    expect(loadArtwork(memory(raw))).toEqual({ snapshot: null, status: 'invalid' });
  });
  it('handles blocked storage access, read failures, and quota errors', () => {
    const blocked = () => { throw new Error('denied'); };
    expect(loadArtwork(blocked).status).toBe('unavailable');
    expect(saveArtwork(snapshot, blocked)).toBe(false);
    const failing = () => ({ getItem: blocked, setItem: blocked });
    expect(loadArtwork(failing).status).toBe('unavailable');
    expect(saveArtwork(snapshot, failing)).toBe(false);
  });
  it('does not overwrite a valid draft with invalid data', () => {
    const storage = memory(JSON.stringify(snapshot));
    expect(saveArtwork({ ...snapshot, marks: [{ ...snapshot.marks[0], size: NaN }] }, storage)).toBe(false);
    expect(loadArtwork(storage).snapshot).toEqual(snapshot);
  });
  it('validates marks against the requested scenario geometry', () => {
    const wallSnapshot: ArtworkSnapshot = {
      marks: [{ x: 0.5, y: 0.3, size: 0.025, opacity: 0.8, color: '#e2483d', texture: 'solid' }],
      updatedAt: '2026-09-17T12:00:00.000Z',
    };
    const storage = memory();
    expect(saveArtwork(wallSnapshot, storage, getScenario('wall'))).toBe(true);
    expect(loadArtwork(storage, getScenario('wall'))).toEqual({ snapshot: wallSnapshot, status: 'loaded' });
    expect(loadArtwork(storage, getScenario('train'))).toEqual({ snapshot: null, status: 'invalid' });
  });
});
