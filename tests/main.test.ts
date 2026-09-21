import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderLayerPanel, syncLayerStatus, type LayerPanelHandlers } from '../src/layer-panel';
import { documentFromSnapshot, type ArtworkDocument } from '../src/artwork-document';

type Listener = () => void;

class TestElement {
  children: TestElement[] = [];
  dataset: Record<string, string> = {};
  attributes: Record<string, string> = {};
  listeners: Record<string, Listener[]> = {};
  textContent = '';
  className = '';
  value = '';
  type = '';
  disabled = false;

  constructor(readonly tagName: string) {}

  append(...children: TestElement[]) { this.children.push(...children); }
  replaceChildren(...children: TestElement[]) { this.children = children; }
  setAttribute(name: string, value: string) { this.attributes[name] = value; }
  getAttribute(name: string) { return this.attributes[name]; }
  addEventListener(type: string, listener: Listener) { this.listeners[type] = [...(this.listeners[type] ?? []), listener]; }
  dispatch(type: string) { for (const listener of this.listeners[type] ?? []) listener(); }
}

function installDocument() {
  vi.stubGlobal('document', {
    createElement: (tagName: string) => new TestElement(tagName),
    createElementNS: (_namespace: string, tagName: string) => new TestElement(tagName),
  });
}

function findByDataset(root: TestElement, key: string, value = 'true'): TestElement {
  const match = walk(root).find(element => element.dataset[key] === value);
  if (!match) throw new Error(`Missing data-${key}`);
  return match;
}

function walk(root: TestElement): TestElement[] {
  return [root, ...root.children.flatMap(child => walk(child))];
}

function artwork(): ArtworkDocument {
  const document = documentFromSnapshot({ marks: [], updatedAt: '2026-09-17T12:00:00.000Z' });
  document.layers.push({
    id: 'paint-layer-2', name: 'Highlights', visible: false, locked: true, marks: [],
    createdAt: document.updatedAt, updatedAt: document.updatedAt,
  });
  document.activeLayerId = 'paint-layer-2';
  return document;
}

function render(document = artwork(), handlers: Partial<LayerPanelHandlers> = {}) {
  installDocument();
  const layerList = new TestElement('div');
  const layerStatus = new TestElement('p');
  const baseHandlers: LayerPanelHandlers = {
    select: vi.fn(), rename: vi.fn(), lock: vi.fn(), visible: vi.fn(), move: vi.fn(), duplicate: vi.fn(), delete: vi.fn(),
    ...handlers,
  };
  renderLayerPanel(document, layerList as unknown as HTMLElement, layerStatus as unknown as HTMLElement, baseHandlers);
  return { layerList, layerStatus, handlers: baseHandlers };
}

afterEach(() => vi.unstubAllGlobals());

describe('layer panel DOM', () => {
  it('renders active and visibility ARIA state for the stack', () => {
    const { layerList, layerStatus } = render();
    expect(layerStatus.textContent).toBe('');
    expect(layerList.children).toHaveLength(2);
    const top = layerList.children[0];
    expect(top.dataset).toMatchObject({ layerId: 'paint-layer-2', active: 'true', locked: 'true', visible: 'false' });
    expect(findByDataset(top, 'layerSelect').className).toBe('layer-row__radio');
    expect(findByDataset(top, 'layerSelect').getAttribute('aria-pressed')).toBe('true');
    expect(findByDataset(top, 'layerSelect').getAttribute('title')).toBe('Active layer Highlights');
    expect(findByDataset(top, 'layerVisible').getAttribute('aria-pressed')).toBe('false');
    expect(findByDataset(top, 'layerVisible').getAttribute('title')).toBe('Show Highlights');
    expect(findByDataset(top, 'layerLock').getAttribute('aria-label')).toBe('Unlock Highlights');
    expect(findByDataset(top, 'layerLock').getAttribute('title')).toBe('Unlock Highlights');
    expect(findByDataset(top, 'layerLock').children[0]?.tagName).toBe('svg');
  });

  it('wires select, rename, lock, visibility, and duplicate events deterministically', () => {
    const handlers = { select: vi.fn(), rename: vi.fn(), lock: vi.fn(), visible: vi.fn(), duplicate: vi.fn() };
    const { layerList } = render(undefined, handlers);
    const top = layerList.children[0];
    findByDataset(top, 'layerSelect').dispatch('click');
    const name = findByDataset(top, 'layerName');
    name.value = '  Ink  ';
    name.dispatch('change');
    findByDataset(top, 'layerLock').dispatch('click');
    findByDataset(top, 'layerVisible').dispatch('click');
    findByDataset(top, 'layerDuplicate').dispatch('click');
    expect(handlers.select).toHaveBeenCalledWith('paint-layer-2');
    expect(handlers.rename).toHaveBeenCalledWith('paint-layer-2', '  Ink  ');
    expect(handlers.lock).toHaveBeenCalledWith('paint-layer-2', false);
    expect(handlers.visible).toHaveBeenCalledWith('paint-layer-2', true);
    expect(handlers.duplicate).toHaveBeenCalledWith('paint-layer-2');
  });

  it('keeps impossible stack commands present but disabled for keyboard users', () => {
    const { layerList } = render();
    const top = layerList.children[0];
    const bottom = layerList.children[1];
    expect(findByDataset(top, 'layerUp').disabled).toBe(true);
    expect(findByDataset(top, 'layerUp').getAttribute('aria-disabled')).toBe('true');
    expect(findByDataset(bottom, 'layerDown').disabled).toBe(true);
    expect(findByDataset(bottom, 'layerDelete').disabled).toBe(false);
  });

  it('marks status messages as errors only when requested', () => {
    installDocument();
    const status = new TestElement('p');
    syncLayerStatus(status as unknown as HTMLElement, 'Layer locked.', true);
    expect(status.textContent).toBe('Layer locked.');
    expect(status.dataset.error).toBe('true');
  });
});
