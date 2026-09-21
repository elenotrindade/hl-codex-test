import { TEXTURES, type PaintMark } from './train-painter';
import { getScenario, isInsidePaintableArea, type PaintScenario } from './scenarios';
import { isGallery, type GalleryEntry } from './gallery';
import { cloneArtworkDocument, documentFromSnapshot, type ArtworkDocument, type ArtworkSnapshot } from './artwork-document';

export type { ArtworkSnapshot } from './artwork-document';

export const ARTWORK_KEY = 'train-graffiti.artwork.v1';
export const GALLERY_KEY = 'train-graffiti.gallery.v1';
type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>;
type LoadResult = { document: ArtworkDocument | null; status: 'loaded' | 'missing' | 'invalid' | 'unavailable' };
const browserStorage: StorageAccess = () => window.localStorage;

export function isMark(value: unknown, scenario: PaintScenario): value is PaintMark {
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

function isLayer(value: unknown, scenario: PaintScenario): boolean {
  if (!value || typeof value !== 'object') return false;
  const layer = value as ArtworkDocument['layers'][number];
  return typeof layer.id === 'string' && layer.id.length > 0 &&
    typeof layer.name === 'string' && layer.name.trim().length > 0 &&
    typeof layer.visible === 'boolean' && typeof layer.locked === 'boolean' &&
    Array.isArray(layer.marks) && layer.marks.every(mark => isMark(mark, scenario)) &&
    typeof layer.createdAt === 'string' && Number.isFinite(Date.parse(layer.createdAt)) &&
    typeof layer.updatedAt === 'string' && Number.isFinite(Date.parse(layer.updatedAt));
}

function isArtworkDocument(value: unknown, scenario: PaintScenario): value is ArtworkDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as ArtworkDocument;
  return document.version === 2 && typeof document.activeLayerId === 'string' &&
    typeof document.updatedAt === 'string' && Number.isFinite(Date.parse(document.updatedAt)) &&
    Array.isArray(document.layers) && document.layers.length > 0 &&
    document.layers.every(layer => isLayer(layer, scenario)) &&
    new Set(document.layers.map(layer => layer.id)).size === document.layers.length &&
    document.layers.some(layer => layer.id === document.activeLayerId);
}

export function loadArtworkDocument(access: StorageAccess = browserStorage, scenario: PaintScenario = getScenario('train')): LoadResult {
  let raw: string | null;
  try { raw = access().getItem(ARTWORK_KEY); }
  catch { return { document: null, status: 'unavailable' }; }
  if (raw === null) return { document: null, status: 'missing' };
  try {
    const value: unknown = JSON.parse(raw);
    if (isArtworkDocument(value, scenario)) return { document: cloneArtworkDocument(value), status: 'loaded' };
    if (isSnapshot(value, scenario)) return { document: documentFromSnapshot(value), status: 'loaded' };
  } catch { /* Invalid JSON is treated like an invalid snapshot. */ }
  return { document: null, status: 'invalid' };
}

export function loadArtwork(access: StorageAccess = browserStorage, scenario: PaintScenario = getScenario('train')): {
  snapshot: ArtworkSnapshot | null; status: LoadResult['status'];
} {
  const result = loadArtworkDocument(access, scenario);
  return { snapshot: result.document ? { marks: result.document.layers.flatMap(layer => layer.marks.map(mark => ({ ...mark }))), updatedAt: result.document.updatedAt } : null, status: result.status };
}

export function saveArtwork(document: ArtworkDocument | ArtworkSnapshot, access: StorageAccess = browserStorage, scenario: PaintScenario = getScenario('train')): boolean {
  try {
    const value = 'version' in document ? document : documentFromSnapshot(document);
    if (!isArtworkDocument(value, scenario)) return false;
    access().setItem(ARTWORK_KEY, JSON.stringify(value));
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
