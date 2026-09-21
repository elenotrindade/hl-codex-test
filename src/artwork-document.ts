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

function cloneMark(mark: PaintMark): PaintMark { return { ...mark }; }

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

export function flattenVisibleMarks(document: ArtworkDocument): PaintMark[] {
  return document.layers.flatMap(layer => layer.visible ? layer.marks.map(cloneMark) : []);
}

export function touchDocument(document: ArtworkDocument, updatedAt = new Date().toISOString()): void {
  document.updatedAt = updatedAt;
  const activeLayer = getActiveLayer(document);
  if (activeLayer) activeLayer.updatedAt = updatedAt;
}
