import { type ArtworkDocument } from './artwork-document';
import { createLayerPreview } from './layer-preview';

export type LayerPanelHandlers = {
  select(layerId: string): void;
  rename(layerId: string, name: string): void;
  lock(layerId: string, locked: boolean): void;
  visible(layerId: string, visible: boolean): void;
  move(layerId: string, direction: 'up' | 'down'): void;
  duplicate(layerId: string): void;
  delete(layerId: string): void;
};

export function syncLayerStatus(layerStatus: HTMLElement, message: string, error = false): void {
  layerStatus.textContent = message;
  layerStatus.dataset.error = String(error);
}

export function renderLayerPanel(artwork: ArtworkDocument, layerList: HTMLElement, layerStatus: HTMLElement, handlers: LayerPanelHandlers): void {
  let draggedLayerId: string | null = null;
  layerList.replaceChildren(...[...artwork.layers].reverse().map(layer => {
    const row = document.createElement('article');
    row.className = 'layer-row';
    row.dataset.layerId = layer.id;
    row.setAttribute('role', 'listitem');
    row.draggable = artwork.layers.length > 1;
    row.addEventListener('dragstart', event => {
      draggedLayerId = layer.id;
      row.dataset.dragging = 'true';
      event.dataTransfer?.setData('text/plain', layer.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragover', event => {
      if (!draggedLayerId || draggedLayerId === layer.id) return;
      event.preventDefault();
      row.dataset.dropTarget = 'true';
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    });
    row.addEventListener('dragleave', () => { delete row.dataset.dropTarget; });
    row.addEventListener('drop', event => {
      event.preventDefault();
      delete row.dataset.dropTarget;
      if (!draggedLayerId || draggedLayerId === layer.id) return;
      const draggedIndex = artwork.layers.findIndex(item => item.id === draggedLayerId);
      const targetIndex = artwork.layers.findIndex(item => item.id === layer.id);
      if (draggedIndex < 0 || targetIndex < 0) return;
      const direction = targetIndex > draggedIndex ? 'up' : 'down';
      for (let index = draggedIndex; index !== targetIndex; index += direction === 'up' ? 1 : -1) handlers.move(draggedLayerId, direction);
    });
    row.addEventListener('dragend', () => {
      draggedLayerId = null;
      delete row.dataset.dragging;
      delete row.dataset.dropTarget;
    });
    const active = layer.id === artwork.activeLayerId;
    const selectLabel = `${active ? 'Active layer' : 'Select layer'} ${layer.name}`;
    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'layer-row__radio';
    select.dataset.layerSelect = 'true';
    const radioDot = document.createElement('span');
    radioDot.className = 'layer-row__radio-dot';
    radioDot.setAttribute('aria-hidden', 'true');
    select.append(radioDot);
    select.setAttribute('aria-label', selectLabel);
    select.setAttribute('title', selectLabel);
    select.setAttribute('aria-pressed', String(active));
    select.addEventListener('click', () => handlers.select(layer.id));
    const preview = createLayerPreview(layer.marks);
    const name = document.createElement('input');
    name.dataset.layerName = 'true';
    name.value = layer.name;
    name.setAttribute('aria-label', `Layer name for ${layer.name}`);
    name.addEventListener('change', () => handlers.rename(layer.id, name.value));
    const visibleLabel = `${layer.visible ? 'Hide' : 'Show'} ${layer.name}`;
    const visible = iconButton('layerVisible', visibleLabel, layer.visible ? 'eye' : 'eye-off');
    visible.setAttribute('aria-pressed', String(layer.visible));
    visible.addEventListener('click', () => handlers.visible(layer.id, !layer.visible));
    const lockLabel = `${layer.locked ? 'Unlock' : 'Lock'} ${layer.name}`;
    const lock = iconButton('layerLock', lockLabel, layer.locked ? 'lock' : 'unlock');
    lock.setAttribute('aria-pressed', String(layer.locked));
    lock.addEventListener('click', () => handlers.lock(layer.id, !layer.locked));
    const up = iconButton('layerUp', `Move ${layer.name} up`, 'up');
    up.addEventListener('click', () => handlers.move(layer.id, 'up'));
    const down = iconButton('layerDown', `Move ${layer.name} down`, 'down');
    down.addEventListener('click', () => handlers.move(layer.id, 'down'));
    const duplicate = iconButton('layerDuplicate', `Duplicate ${layer.name}`, 'duplicate');
    duplicate.addEventListener('click', () => handlers.duplicate(layer.id));
    const remove = iconButton('layerDelete', `Delete ${layer.name}`, 'delete');
    remove.className = `${remove.className} layer-row__delete`;
    remove.addEventListener('click', () => handlers.delete(layer.id));
    const index = artwork.layers.findIndex(item => item.id === layer.id);
    up.disabled = index === artwork.layers.length - 1;
    down.disabled = index === 0;
    remove.disabled = artwork.layers.length === 1;
    up.setAttribute('aria-disabled', String(up.disabled));
    down.setAttribute('aria-disabled', String(down.disabled));
    remove.setAttribute('aria-disabled', String(remove.disabled));
    const actions = document.createElement('div');
    actions.className = 'layer-row__actions';
    actions.setAttribute('role', 'group');
    actions.setAttribute('aria-label', `Actions for ${layer.name}`);
    actions.append(visible, lock, up, down, duplicate, remove);
    row.append(select, preview, name, actions);
    row.dataset.active = String(active);
    row.dataset.locked = String(layer.locked);
    row.dataset.visible = String(layer.visible);
    return row;
  }));
  syncLayerStatus(layerStatus, '');
}

type LayerIconName = 'eye' | 'eye-off' | 'lock' | 'unlock' | 'up' | 'down' | 'duplicate' | 'delete';

function iconButton(datasetKey: string, label: string, icon: LayerIconName): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'layer-row__icon';
  button.dataset[datasetKey] = 'true';
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.append(createLayerIcon(icon));
  return button;
}

function createLayerIcon(name: LayerIconName): SVGSVGElement {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('class', 'layer-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const [tag, attrs] of LAYER_ICONS[name]) {
    const node = document.createElementNS(namespace, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    svg.append(node);
  }
  return svg;
}

const stroke = { fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

const LAYER_ICONS: Record<LayerIconName, Array<[string, Record<string, string>]>> = {
  eye: [
    ['path', { ...stroke, d: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z' }],
    ['circle', { ...stroke, cx: '12', cy: '12', r: '3' }],
  ],
  'eye-off': [
    ['path', { ...stroke, d: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z' }],
    ['circle', { ...stroke, cx: '12', cy: '12', r: '3' }],
    ['path', { ...stroke, d: 'M4 4l16 16' }],
  ],
  lock: [
    ['rect', { ...stroke, x: '5', y: '11', width: '14', height: '10', rx: '1' }],
    ['path', { ...stroke, d: 'M8 11V8a4 4 0 0 1 8 0v3' }],
  ],
  unlock: [
    ['rect', { ...stroke, x: '5', y: '11', width: '14', height: '10', rx: '1' }],
    ['path', { ...stroke, d: 'M8 11V8a4 4 0 0 1 7.2-2.4' }],
  ],
  up: [
    ['path', { ...stroke, d: 'M12 19V6' }],
    ['path', { ...stroke, d: 'm6 11 6-6 6 6' }],
  ],
  down: [
    ['path', { ...stroke, d: 'M12 5v13' }],
    ['path', { ...stroke, d: 'm6 13 6 6 6-6' }],
  ],
  duplicate: [
    ['rect', { ...stroke, x: '8', y: '8', width: '12', height: '12', rx: '1' }],
    ['path', { ...stroke, d: 'M16 8V5H4v12h3' }],
  ],
  delete: [
    ['path', { ...stroke, d: 'M4 7h16' }],
    ['path', { ...stroke, d: 'M9 7V4h6v3' }],
    ['path', { ...stroke, d: 'M7 7l1 13h8l1-13' }],
    ['path', { ...stroke, d: 'M10 11v6M14 11v6' }],
  ],
};
