import { TEXTURES, type PaintMark } from './train-painter';
import { isInsidePaintableTrainArea } from './train-template';

export type ArtworkSnapshot = { marks: PaintMark[]; updatedAt: string };
export const ARTWORK_KEY = 'train-graffiti.artwork.v1';
type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>;
type LoadResult = { snapshot: ArtworkSnapshot | null; status: 'loaded' | 'missing' | 'invalid' | 'unavailable' };
const browserStorage: StorageAccess = () => window.localStorage;

function isMark(value: unknown): value is PaintMark {
  if (!value || typeof value !== 'object') return false;
  const mark = value as PaintMark;
  return Number.isFinite(mark.x) && Number.isFinite(mark.y) && isInsidePaintableTrainArea(mark) &&
    typeof mark.color === 'string' && /^#[0-9a-f]{6}$/i.test(mark.color) &&
    TEXTURES.includes(mark.texture) && Number.isFinite(mark.size) && mark.size >= 0.006 && mark.size <= 0.06;
}

function isSnapshot(value: unknown): value is ArtworkSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as ArtworkSnapshot;
  return Array.isArray(snapshot.marks) && snapshot.marks.every(isMark) &&
    typeof snapshot.updatedAt === 'string' && Number.isFinite(Date.parse(snapshot.updatedAt));
}

export function loadArtwork(access: StorageAccess = browserStorage): LoadResult {
  let raw: string | null;
  try { raw = access().getItem(ARTWORK_KEY); }
  catch { return { snapshot: null, status: 'unavailable' }; }
  if (raw === null) return { snapshot: null, status: 'missing' };
  try {
    const value: unknown = JSON.parse(raw);
    if (isSnapshot(value)) return { snapshot: value, status: 'loaded' };
  } catch { /* Invalid JSON is treated like an invalid snapshot. */ }
  return { snapshot: null, status: 'invalid' };
}

export function saveArtwork(snapshot: ArtworkSnapshot, access: StorageAccess = browserStorage): boolean {
  try {
    if (!isSnapshot(snapshot)) return false;
    access().setItem(ARTWORK_KEY, JSON.stringify(snapshot));
    return true;
  } catch { return false; }
}
