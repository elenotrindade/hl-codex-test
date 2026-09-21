import { TEXTURES, type PaintMark } from './train-painter';
import { getScenario, isInsidePaintableArea, type PaintScenario } from './scenarios';
import { isGallery, type GalleryEntry } from './gallery';

export type ArtworkSnapshot = { marks: PaintMark[]; updatedAt: string };
export const ARTWORK_KEY = 'train-graffiti.artwork.v1';
export const GALLERY_KEY = 'train-graffiti.gallery.v1';
type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>;
type LoadResult = { snapshot: ArtworkSnapshot | null; status: 'loaded' | 'missing' | 'invalid' | 'unavailable' };
const browserStorage: StorageAccess = () => window.localStorage;

function isMark(value: unknown, scenario: PaintScenario): value is PaintMark {
  if (!value || typeof value !== 'object') return false;
  const mark = value as PaintMark;
  return Number.isFinite(mark.x) && Number.isFinite(mark.y) && isInsidePaintableArea(scenario, mark) &&
    typeof mark.color === 'string' && /^#[0-9a-f]{6}$/i.test(mark.color) &&
    TEXTURES.includes(mark.texture) && Number.isFinite(mark.size) && mark.size >= 0.003 && mark.size <= 0.12 &&
    (mark.opacity === undefined || Number.isFinite(mark.opacity) && mark.opacity >= 0.05 && mark.opacity <= 1);
}

function isSnapshot(value: unknown, scenario: PaintScenario): value is ArtworkSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as ArtworkSnapshot;
  return Array.isArray(snapshot.marks) && snapshot.marks.every(mark => isMark(mark, scenario)) &&
    typeof snapshot.updatedAt === 'string' && Number.isFinite(Date.parse(snapshot.updatedAt));
}

export function loadArtwork(access: StorageAccess = browserStorage, scenario: PaintScenario = getScenario('train')): LoadResult {
  let raw: string | null;
  try { raw = access().getItem(ARTWORK_KEY); }
  catch { return { snapshot: null, status: 'unavailable' }; }
  if (raw === null) return { snapshot: null, status: 'missing' };
  try {
    const value: unknown = JSON.parse(raw);
    if (isSnapshot(value, scenario)) return { snapshot: value, status: 'loaded' };
  } catch { /* Invalid JSON is treated like an invalid snapshot. */ }
  return { snapshot: null, status: 'invalid' };
}

export function saveArtwork(snapshot: ArtworkSnapshot, access: StorageAccess = browserStorage, scenario: PaintScenario = getScenario('train')): boolean {
  try {
    if (!isSnapshot(snapshot, scenario)) return false;
    access().setItem(ARTWORK_KEY, JSON.stringify(snapshot));
    return true;
  } catch { return false; }
}

export function loadGallery(access: StorageAccess = browserStorage): {
  entries: GalleryEntry[] | null; status: LoadResult['status'];
} {
  let raw: string | null;
  try { raw = access().getItem(GALLERY_KEY); }
  catch { return { entries: null, status: 'unavailable' }; }
  if (raw === null) return { entries: null, status: 'missing' };
  try {
    const value: unknown = JSON.parse(raw);
    if (isGallery(value)) return { entries: value, status: 'loaded' };
  } catch { /* Invalid gallery data falls back to built-in examples. */ }
  return { entries: null, status: 'invalid' };
}

export function saveGallery(entries: GalleryEntry[], access: StorageAccess = browserStorage): boolean {
  try {
    if (!isGallery(entries)) return false;
    access().setItem(GALLERY_KEY, JSON.stringify(entries));
    return true;
  } catch { return false; }
}
