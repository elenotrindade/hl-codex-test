import { type PaintMark } from './train-painter';

export type ArtworkLayer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  marks: PaintMark[];
  createdAt: string;
  updatedAt: string;
};

export type ArtworkDocument = {
  version: 2;
  activeLayerId: string;
  layers: ArtworkLayer[];
  updatedAt: string;
};

export const DEFAULT_LAYER_ID = 'paint-layer-1';
export const DEFAULT_LAYER_NAME = 'Paint layer 1';

export type ArtworkSnapshot = { marks: PaintMark[]; updatedAt: string };

function cloneMark(mark: PaintMark): PaintMark {
  return mark.brush ? { ...mark, brush: { ...mark.brush } } : { ...mark };
}

function timestamp(updatedAt = new Date().toISOString()): string { return updatedAt; }

function uniqueLayerId(document: ArtworkDocument): string {
  const ids = new Set(document.layers.map(layer => layer.id));
  let index = document.layers.length + 1;
  while (ids.has(`paint-layer-${index}`)) index++;
  return `paint-layer-${index}`;
}

export function normalizeLayerName(name: string | undefined, fallback: string): string {
  const trimmed = name?.trim() ?? '';
  return trimmed || fallback;
}

export function cloneArtworkDocument(document: ArtworkDocument): ArtworkDocument {
  return {
    version: 2,
    activeLayerId: document.activeLayerId,
    updatedAt: document.updatedAt,
    layers: document.layers.map(layer => ({ ...layer, marks: layer.marks.map(cloneMark) })),
  };
}

export function createDefaultArtworkDocument(updatedAt = new Date().toISOString()): ArtworkDocument {
  return documentFromSnapshot({ marks: [], updatedAt });
}

export function documentFromSnapshot(snapshot: ArtworkSnapshot): ArtworkDocument {
  return {
    version: 2,
    activeLayerId: DEFAULT_LAYER_ID,
    updatedAt: snapshot.updatedAt,
    layers: [{
      id: DEFAULT_LAYER_ID,
      name: DEFAULT_LAYER_NAME,
      visible: true,
      locked: false,
      marks: snapshot.marks.map(cloneMark),
      createdAt: snapshot.updatedAt,
      updatedAt: snapshot.updatedAt,
    }],
  };
}

export function getActiveLayer(document: ArtworkDocument): ArtworkLayer | null {
  return document.layers.find(layer => layer.id === document.activeLayerId) ?? null;
}

export function createLayer(document: ArtworkDocument, name?: string, updatedAt = timestamp()): ArtworkLayer {
  const id = uniqueLayerId(document);
  const layer: ArtworkLayer = {
    id,
    name: normalizeLayerName(name, `Paint layer ${document.layers.length + 1}`),
    visible: true,
    locked: false,
    marks: [],
    createdAt: updatedAt,
    updatedAt,
  };
  document.layers.push(layer);
  document.activeLayerId = id;
  document.updatedAt = updatedAt;
  return layer;
}

export function selectLayer(document: ArtworkDocument, layerId: string, updatedAt = timestamp()): ArtworkLayer | null {
  const layer = document.layers.find(item => item.id === layerId) ?? null;
  if (!layer) return null;
  document.activeLayerId = layerId;
  document.updatedAt = updatedAt;
  return layer;
}

export function renameLayer(document: ArtworkDocument, layerId: string, name: string, updatedAt = timestamp()): ArtworkLayer | null {
  const layer = document.layers.find(item => item.id === layerId) ?? null;
  if (!layer) return null;
  layer.name = normalizeLayerName(name, layer.name || DEFAULT_LAYER_NAME);
  layer.updatedAt = updatedAt;
  document.updatedAt = updatedAt;
  return layer;
}

export function setLayerLocked(document: ArtworkDocument, layerId: string, locked: boolean, updatedAt = timestamp()): ArtworkLayer | null {
  const layer = document.layers.find(item => item.id === layerId) ?? null;
  if (!layer) return null;
  layer.locked = locked;
  layer.updatedAt = updatedAt;
  document.updatedAt = updatedAt;
  return layer;
}

export function setLayerVisible(document: ArtworkDocument, layerId: string, visible: boolean, updatedAt = timestamp()): ArtworkLayer | null {
  const layer = document.layers.find(item => item.id === layerId) ?? null;
  if (!layer) return null;
  layer.visible = visible;
  layer.updatedAt = updatedAt;
  document.updatedAt = updatedAt;
  return layer;
}

export function duplicateLayer(document: ArtworkDocument, layerId: string, updatedAt = timestamp()): ArtworkLayer | null {
  const index = document.layers.findIndex(item => item.id === layerId);
  if (index < 0) return null;
  const source = document.layers[index];
  const layer: ArtworkLayer = {
    ...source,
    id: uniqueLayerId(document),
    name: normalizeLayerName(`${source.name} copy`, `Paint layer ${document.layers.length + 1}`),
    marks: source.marks.map(cloneMark),
    createdAt: updatedAt,
    updatedAt,
  };
  document.layers.splice(index + 1, 0, layer);
  document.activeLayerId = layer.id;
  document.updatedAt = updatedAt;
  return layer;
}

export function moveLayer(document: ArtworkDocument, layerId: string, direction: 'up' | 'down', updatedAt = timestamp()): boolean {
  const index = document.layers.findIndex(item => item.id === layerId);
  if (index < 0) return false;
  const target = direction === 'up' ? index + 1 : index - 1;
  if (target < 0 || target >= document.layers.length) return false;
  const [layer] = document.layers.splice(index, 1);
  document.layers.splice(target, 0, layer);
  layer.updatedAt = updatedAt;
  document.updatedAt = updatedAt;
  return true;
}

export function deleteLayer(document: ArtworkDocument, layerId: string, updatedAt = timestamp()): ArtworkLayer | null {
  if (document.layers.length <= 1) return null;
  const index = document.layers.findIndex(item => item.id === layerId);
  if (index < 0) return null;
  const [removed] = document.layers.splice(index, 1);
  if (document.activeLayerId === removed.id) {
    const fallbackIndex = Math.min(index, document.layers.length - 1);
    document.activeLayerId = document.layers[fallbackIndex].id;
  }
  document.updatedAt = updatedAt;
  return removed;
}

export function flattenVisibleMarks(document: ArtworkDocument): PaintMark[] {
  return document.layers.flatMap(layer => layer.visible ? layer.marks.map(cloneMark) : []);
}

export function touchDocument(document: ArtworkDocument, updatedAt = new Date().toISOString()): void {
  document.updatedAt = updatedAt;
  const activeLayer = getActiveLayer(document);
  if (activeLayer) activeLayer.updatedAt = updatedAt;
}
