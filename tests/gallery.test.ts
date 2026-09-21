import { describe, expect, it } from 'vitest';
import { getRecentGallery, isGallery, publishArtwork, rankGallery, seededGallery, upvote } from '../src/gallery';
import { ARTWORK_KEY, GALLERY_KEY, loadGallery, saveGallery } from '../src/storage';

const image = 'data:image/png;base64,aGVsbG8=';
const date = '2026-09-17T12:00:00.000Z';
function memory(raw?: string) {
  const data = new Map<string, string>([[ARTWORK_KEY, 'untouched draft']]);
  if (raw !== undefined) data.set(GALLERY_KEY, raw);
  return { data, access: () => ({ getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); } }) };
}

describe('mock gallery', () => {
  it('provides independent seeded examples', () => {
    const entries = seededGallery();
    expect(isGallery(entries)).toBe(true);
    entries[0].votes++;
    expect(seededGallery()[0].votes).toBe(8);
  });
  it('publishes an immutable snapshot alongside seeds and numbers local submissions', () => {
    const seeds = seededGallery();
    const entries = publishArtwork(seeds, image, 'local-1', date);
    expect(entries[0]).toEqual({ id: 'local-1', title: 'Your train / 001', imageDataUrl: image,
      createdAt: date, votes: 0, source: 'local' });
    expect(seeds).toHaveLength(2);
    expect(publishArtwork(entries, image, 'local-2', date)[0].title).toBe('Your train / 002');
    expect(() => publishArtwork(entries, image, 'local-1', date)).toThrow();
    expect(() => publishArtwork(seeds, 'https://example.com/image', 'bad', date)).toThrow();
  });
  it('uses validated custom local titles and keeps fallback numbering', () => {
    const seeds = seededGallery();
    expect(publishArtwork(seeds, image, 'local-1', date, '  Midnight   layup  ')[0].title).toBe('Midnight layup');
    expect(publishArtwork(seeds, image, 'local-1', date, '   ')[0].title).toBe('Your train / 001');
    expect(publishArtwork(seeds, image, 'local-1', date, 'x'.repeat(90))[0].title).toHaveLength(80);
  });
  it('returns the newest three entries without changing ranking data', () => {
    const entries = [
      ...seededGallery(),
      { id: 'local-1', title: 'One', imageDataUrl: image, createdAt: '2026-09-17T12:00:00.000Z', votes: 1, source: 'local' as const },
      { id: 'local-2', title: 'Two', imageDataUrl: image, createdAt: '2026-09-18T12:00:00.000Z', votes: 0, source: 'local' as const },
      { id: 'local-3', title: 'Three', imageDataUrl: image, createdAt: '2026-09-19T12:00:00.000Z', votes: 10, source: 'local' as const },
    ];
    expect(getRecentGallery(entries, 3).map(entry => entry.id)).toEqual(['local-3', 'local-2', 'local-1']);
    expect(rankGallery(entries)[0].id).toBe('local-3');
    expect(entries[0].id).toBe('seed-1');
  });
  it('upvotes repeatedly and sorts ranking without reordering the feed', () => {
    const original = seededGallery();
    let entries = original;
    for (let i = 0; i < 4; i++) entries = upvote(entries, 'seed-2');
    expect(rankGallery(entries).map(entry => entry.id)).toEqual(['seed-2', 'seed-1']);
    expect(entries[0].id).toBe('seed-1');
    expect(original[1].votes).toBe(5);
    expect(upvote(entries, 'missing')).toEqual(entries);
    const tied = entries.map(entry => ({ ...entry, votes: 8 }));
    expect(rankGallery(tied.reverse())[0].id).toBe('seed-1');
    const capped = entries.map(entry => ({ ...entry, votes: Number.MAX_SAFE_INTEGER }));
    expect(upvote(capped, 'seed-1')[0].votes).toBe(Number.MAX_SAFE_INTEGER);
  });
  it('persists submissions and seed/local votes separately from the draft', () => {
    const storage = memory();
    const entries = upvote(upvote(publishArtwork(seededGallery(), image, 'local-1', date), 'local-1'), 'seed-1');
    expect(saveGallery(entries, storage.access)).toBe(true);
    expect(loadGallery(storage.access)).toEqual({ entries, status: 'loaded' });
    expect(storage.data.get(ARTWORK_KEY)).toBe('untouched draft');
  });
  it('handles missing, blocked, and quota-limited storage', () => {
    expect(loadGallery(memory().access).status).toBe('missing');
    const blocked = () => { throw new Error('blocked'); };
    expect(loadGallery(blocked).status).toBe('unavailable');
    expect(saveGallery(seededGallery(), blocked)).toBe(false);
    const failing = () => ({ getItem: blocked, setItem: blocked });
    expect(loadGallery(failing).status).toBe('unavailable');
    expect(saveGallery(seededGallery(), failing)).toBe(false);
  });
  it.each(['{', 'null', '{}', '[]', '[null]'])('rejects malformed gallery %s', raw => {
    expect(loadGallery(memory(raw).access)).toEqual({ entries: null, status: 'invalid' });
  });
  it.each([
    { votes: -1 }, { votes: 1.5 }, { votes: Number.MAX_SAFE_INTEGER + 1 },
    { title: '' }, { createdAt: 'invalid' }, { source: 'remote' },
    { imageDataUrl: 'javascript:alert(1)' }, { imageDataUrl: 'data:image/svg+xml,<svg/>' },
  ])('rejects invalid entry fields %s without overwriting saved gallery', fields => {
    const entries = publishArtwork(seededGallery(), image, 'local-1', date);
    const storage = memory(JSON.stringify(entries));
    const invalid = [{ ...entries[0], ...fields }, ...entries.slice(1)];
    expect(isGallery(invalid)).toBe(false);
    expect(saveGallery(invalid as typeof entries, storage.access)).toBe(false);
    expect(loadGallery(storage.access).entries).toEqual(entries);
    expect(loadGallery(memory(JSON.stringify(invalid)).access).status).toBe('invalid');
  });
  it('rejects duplicate IDs, missing seeds, and altered seed images', () => {
    const entries = seededGallery();
    expect(isGallery([...entries, entries[0]])).toBe(false);
    expect(isGallery(entries.slice(1))).toBe(false);
    entries[0].imageDataUrl = image;
    expect(isGallery(entries)).toBe(false);
  });
});
