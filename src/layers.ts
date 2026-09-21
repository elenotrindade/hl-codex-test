import { type PaintScenario } from './scenarios';
import { type PaintMark } from './train-painter';

export type PaintLayer = {
  id: string;
  name: string;
  marks: PaintMark[];
  visible: boolean;
  createdAt: number;
};

export type ArtworkSnapshot = {
  scenarioId: PaintScenario['id'];
  activeLayerId: string;
  layers: PaintLayer[];
  updatedAt: string;
};

const DEFAULT_LAYER_ID = 'layer-1';

function copyMarks(marks: PaintMark[]): PaintMark[] {
  return marks.map(mark => ({ ...mark }));
}

export function createLayer(index: number, marks: PaintMark[] = [], now = Date.now()): PaintLayer {
  return { id: `layer-${now}-${index}`, name: `Layer ${index}`, marks: copyMarks(marks), visible: true, createdAt: now };
}

export function createDefaultLayer(marks: PaintMark[] = [], now = Date.now()): PaintLayer {
  return { id: DEFAULT_LAYER_ID, name: 'Layer 1', marks: copyMarks(marks), visible: true, createdAt: now };
}

export function createSnapshot(scenario: PaintScenario, layers: PaintLayer[] = [createDefaultLayer()], activeLayerId = layers[0]?.id ?? DEFAULT_LAYER_ID, updatedAt = new Date().toISOString()): ArtworkSnapshot {
  const normalizedLayers = layers.length ? layers.map(layer => ({ ...layer, marks: copyMarks(layer.marks) })) : [createDefaultLayer()];
  const selectedLayerId = normalizedLayers.some(layer => layer.id === activeLayerId) ? activeLayerId : normalizedLayers[0].id;
  return { scenarioId: scenario.id, activeLayerId: selectedLayerId, layers: normalizedLayers, updatedAt };
}

export function appendMarksToLayer(snapshot: ArtworkSnapshot, layerId: string, marks: PaintMark[], updatedAt = new Date().toISOString()): ArtworkSnapshot {
  return { ...snapshot, updatedAt, layers: snapshot.layers.map(layer => layer.id === layerId ? { ...layer, marks: [...copyMarks(layer.marks), ...copyMarks(marks)] } : { ...layer, marks: copyMarks(layer.marks) }) };
}

export function replaceLayerMarks(snapshot: ArtworkSnapshot, layerId: string, marks: PaintMark[], updatedAt = new Date().toISOString()): ArtworkSnapshot {
  return { ...snapshot, updatedAt, layers: snapshot.layers.map(layer => layer.id === layerId ? { ...layer, marks: copyMarks(marks) } : { ...layer, marks: copyMarks(layer.marks) }) };
}

export function addLayer(snapshot: ArtworkSnapshot, now = Date.now()): ArtworkSnapshot {
  const layer = createLayer(snapshot.layers.length + 1, [], now);
  return { ...snapshot, activeLayerId: layer.id, layers: [layer, ...snapshot.layers.map(existing => ({ ...existing, marks: copyMarks(existing.marks) }))], updatedAt: new Date(now).toISOString() };
}

export function selectLayer(snapshot: ArtworkSnapshot, layerId: string): ArtworkSnapshot {
  return snapshot.layers.some(layer => layer.id === layerId) ? { ...snapshot, activeLayerId: layerId } : snapshot;
}

export function toggleLayerVisibility(snapshot: ArtworkSnapshot, layerId: string, updatedAt = new Date().toISOString()): ArtworkSnapshot {
  if (!snapshot.layers.some(layer => layer.id === layerId)) return snapshot;
  return {
    ...snapshot,
    updatedAt,
    layers: snapshot.layers.map(layer => layer.id === layerId ? { ...layer, visible: !layer.visible, marks: copyMarks(layer.marks) } : { ...layer, marks: copyMarks(layer.marks) }),
  };
}

export function deleteLayer(snapshot: ArtworkSnapshot, layerId: string, updatedAt = new Date().toISOString()): ArtworkSnapshot {
  if (snapshot.layers.length <= 1 || !snapshot.layers.some(layer => layer.id === layerId)) return snapshot;
  const remaining = snapshot.layers.filter(layer => layer.id !== layerId).map(layer => ({ ...layer, marks: copyMarks(layer.marks) }));
  const activeLayerId = snapshot.activeLayerId === layerId ? remaining[0].id : snapshot.activeLayerId;
  return { ...snapshot, activeLayerId, layers: remaining, updatedAt };
}

export function reorderLayers(snapshot: ArtworkSnapshot, fromIndex: number, toIndex: number, updatedAt = new Date().toISOString()): ArtworkSnapshot {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return snapshot;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= snapshot.layers.length || toIndex >= snapshot.layers.length || fromIndex === toIndex) return snapshot;
  const layers = snapshot.layers.map(layer => ({ ...layer, marks: copyMarks(layer.marks) }));
  const [moved] = layers.splice(fromIndex, 1);
  layers.splice(toIndex, 0, moved);
  return { ...snapshot, layers, updatedAt };
}

export function getActiveLayer(snapshot: ArtworkSnapshot): PaintLayer {
  return snapshot.layers.find(layer => layer.id === snapshot.activeLayerId) ?? snapshot.layers[0];
}

export function getRenderableLayers(layers: PaintLayer[]): PaintLayer[] {
  return layers.filter(layer => layer.visible).slice().reverse().map(layer => ({ ...layer, marks: copyMarks(layer.marks) }));
}

export function getRenderableMarks(layers: PaintLayer[]): PaintMark[] {
  return getRenderableLayers(layers).flatMap(layer => copyMarks(layer.marks));
}
