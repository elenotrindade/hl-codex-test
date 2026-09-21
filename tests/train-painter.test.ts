import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPaintMark, TEXTURES, TrainPainter, type ToolState } from '../src/train-painter';
import { dripSteps, SPRAY_CLICK_BURST, sprayDripLength } from '../src/spray-physics';
import { getScenario } from '../src/scenarios';
import { documentFromSnapshot, type ArtworkDocument } from '../src/artwork-document';

const tool: ToolState = { color: '#e2483d', texture: 'solid', brushSize: 0.025, opacity: 0.8, weight: 1 };

function clickStroke(point: { x: number; y: number }, current: ToolState) {
  const marks: ReturnType<typeof createPaintMark>[] = [];
  for (let i = 0; i < SPRAY_CLICK_BURST; i++) {
    const mark = createPaintMark(point, current);
    if (!current.erase) {
      const drip = sprayDripLength(point, marks, { ...mark, dripAmount: current.drip ?? 1 });
      if (drip > 0) mark.drip = drip;
    }
    marks.push(mark);
  }
  return marks;
}

function setup(initial: ReturnType<typeof createPaintMark>[] | ArtworkDocument = [], windowProperties = {}, onHistory = vi.fn()) {
  const context = Object.fromEntries(['scale', 'beginPath', 'rect', 'clip', 'save', 'restore', 'arc',
    'fill', 'stroke', 'moveTo', 'lineTo', 'closePath', 'translate', 'rotate', 'transform', 'fillRect', 'clearRect']
    .map(name => [name, vi.fn()]));
  const canvas = new EventTarget() as HTMLCanvasElement;
  canvas.getContext = vi.fn(() => context) as unknown as HTMLCanvasElement['getContext'];
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 400 }) as DOMRect;
  canvas.setPointerCapture = vi.fn();
  canvas.hasPointerCapture = () => false;
  vi.stubGlobal('window', Object.assign(new EventTarget(), windowProperties));
  const onChange = vi.fn();
  const onCursor = vi.fn();
  const painter = new TrainPainter(canvas, tool, onChange, initial, undefined, onCursor, onHistory);
  const send = (type: string, overrides = {}) => {
    canvas.dispatchEvent(Object.assign(new Event(type), {
      pointerId: 1, isPrimary: true, button: 0, buttons: 1, clientX: 500, clientY: 200, ...overrides,
    }));
  };
  return { painter, canvas, context, onChange, onCursor, send };
}
function canvasContext() {
  return Object.fromEntries(['scale', 'beginPath', 'rect', 'clip', 'save', 'restore', 'arc',
    'fill', 'stroke', 'moveTo', 'lineTo', 'closePath', 'translate', 'rotate', 'transform', 'fillRect', 'clearRect', 'drawImage']
    .map(name => [name, vi.fn()]));
}
afterEach(() => vi.unstubAllGlobals());

describe('responsive canvas', () => {
  it('resizes for viewport and pixel density, replays paint without saving, and removes listeners', () => {
    const { painter, canvas, context, onChange, send } = setup();
    send('pointerdown');
    send('pointerup');
    onChange.mockClear();
    context.arc.mockClear();
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    canvas.getBoundingClientRect = () => ({ left: 20, top: 10, width: 300, height: 120 }) as DOMRect;
    window.dispatchEvent(new Event('resize'));
    expect([canvas.width, canvas.height]).toEqual([600, 240]);
    expect(context.scale).toHaveBeenLastCalledWith(0.6, 0.6);
    const replayArcs = clickStroke({ x: 0.5, y: 0.5 }, tool).reduce(
      (total, mark) => total + 1 + (mark.drip ? dripSteps(mark.drip, mark.size * 1000 / 2, 400) + 1 : 0),
      0,
    );
    expect(context.arc).toHaveBeenCalledTimes(replayArcs);
    expect(onChange).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('resize'));
    expect(context.arc).toHaveBeenCalledTimes(replayArcs);
    send('pointerdown', { clientX: 170, clientY: 70 });
    send('pointerup');
    expect(onChange.mock.calls[0][0][1]).toEqual(createPaintMark({ x: 0.5, y: 0.5 }, tool));
    painter.destroy();
    canvas.getBoundingClientRect = () => ({ width: 500, height: 200 }) as DOMRect;
    window.dispatchEvent(new Event('resize'));
    expect(canvas.width).toBe(600);
  });

  it('observes element and density changes and disconnects both on destroy', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    let resize!: () => void;
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resize = callback; }
      observe = observe;
      disconnect = disconnect;
    });
    const query = new EventTarget();
    const remove = vi.spyOn(query, 'removeEventListener');
    const matchMedia = vi.fn(() => query);
    const { painter, canvas } = setup([], { matchMedia, devicePixelRatio: 1 });
    expect(observe).toHaveBeenCalledWith(canvas);
    canvas.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect;
    resize();
    expect(canvas.width).toBe(1000);
    canvas.getBoundingClientRect = () => ({ width: 250, height: 100 }) as DOMRect;
    resize();
    expect(canvas.width).toBe(250);
    Object.defineProperty(window, 'devicePixelRatio', { value: 2 });
    query.dispatchEvent(new Event('change'));
    expect(canvas.width).toBe(500);
    expect(matchMedia).toHaveBeenLastCalledWith('(resolution: 2dppx)');
    painter.destroy();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledTimes(2);
  });
});

describe('gallery snapshots', () => {
  it('freezes paint before loading the train and exports base then overlay as PNG', async () => {
    const { painter, canvas } = setup();
    const overlayContext = canvasContext();
    const outputContext = { drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: '' };
    const overlay = { getContext: () => overlayContext, width: 0, height: 0 };
    const output = { getContext: () => outputContext, toDataURL: vi.fn(() => 'data:image/png;base64,YQ=='), width: 0, height: 0 };
    vi.stubGlobal('document', { createElement: vi.fn().mockReturnValueOnce(overlay).mockReturnValueOnce(output) });
    let train: { onload: () => void; src: string };
    vi.stubGlobal('Image', class { constructor() { train = this as unknown as typeof train; } });
    const result = painter.createSnapshot();
    expect(overlayContext.arc).toHaveBeenCalledTimes(0);
    expect(outputContext.drawImage).not.toHaveBeenCalled();
    expect(train!.src).toBe('/references/train-cart.png');
    painter.clear();
    train!.onload();
    expect(await result).toBe('data:image/png;base64,YQ==');
    expect(outputContext.drawImage.mock.calls).toEqual([[train!, 0, 0, 1000, 400], [overlay, 0, 0]]);
    expect(output.toDataURL).toHaveBeenCalledWith('image/png');
    expect(output.width).toBe(1000);
    expect(output.height).toBe(400);
    painter.destroy();
  });
  it('rejects unavailable canvas and image load errors', async () => {
    const { painter } = setup();
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
    await expect(painter.createSnapshot()).rejects.toThrow('canvas unavailable');
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ drawImage: vi.fn() }) }) });
    vi.stubGlobal('Image', class {
      onerror = () => {};
      set src(_value: string) { this.onerror(); }
    });
    await expect(painter.createSnapshot()).rejects.toThrow('could not load');
    painter.destroy();
  });
});

describe('scenario-driven painting', () => {
  it('switches clipping and hit testing to the active scenario', () => {
    const { painter, context, send, onChange } = setup();
    context.rect.mockClear();
    painter.setScenario(getScenario('wall'));
    send('pointerdown', { clientX: 500, clientY: 110 });
    send('pointerup');
    expect(context.rect).toHaveBeenCalledWith(0, 80, 1000, 248);
    expect(onChange).toHaveBeenCalledWith(clickStroke({ x: 0.5, y: 0.275 }, tool));
    onChange.mockClear();
    send('pointerdown', { clientX: 500, clientY: 340 });
    send('pointerup');
    expect(onChange).not.toHaveBeenCalled();
    painter.destroy();
  });

  it('uses the active scenario template and background for snapshots', async () => {
    const { painter } = setup();
    painter.setScenario(getScenario('vehicle'));
    const overlayContext = { drawImage: vi.fn() };
    const outputContext = { drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: '' };
    const overlay = { getContext: () => overlayContext, width: 0, height: 0 };
    const output = { getContext: () => outputContext, toDataURL: vi.fn(() => 'data:image/png;base64,Yg=='), width: 0, height: 0 };
    vi.stubGlobal('document', { createElement: vi.fn().mockReturnValueOnce(overlay).mockReturnValueOnce(output) });
    let image: { onload: () => void; src: string };
    vi.stubGlobal('Image', class { constructor() { image = this as unknown as typeof image; } });
    const result = painter.createSnapshot();
    expect(image!.src).toBe('/references/car.png');
    image!.onload();
    await expect(result).resolves.toBe('data:image/png;base64,Yg==');
    expect(outputContext.fillStyle).toBe('#d7d0be');
    painter.destroy();
  });
});

describe('paint marks and stroke lifecycle', () => {
  it.each(TEXTURES)('copies normalized position and current %s tool into a mark', texture => {
    const current = { ...tool, texture };
    const point = { x: 0.5, y: 0.6 };
    const mark = createPaintMark(point, current);
    current.color = '#ffffff';
    point.x = 0;
    expect(mark).toMatchObject({ x: 0.5, y: 0.6, size: 0.025, opacity: 0.8, color: '#e2483d', texture });
    if (texture === 'custom') expect(mark.brush).toEqual({ angle: -30, aspect: 0.35, tip: 'chisel', softness: 0.15 });
    else expect(mark.brush).toBeUndefined();
  });
  it('marks eraser dabs so replay can punch paint out', () => {
    const mark = createPaintMark({ x: 0.5, y: 0.45 }, { ...tool, erase: true });
    expect(mark).toMatchObject({ x: 0.5, y: 0.45, erase: true, color: '#000000' });
  });
  it('stores deterministic pressure-adjusted size and opacity', () => {
    const mark = createPaintMark({ x: 0.5, y: 0.5 }, { ...tool, brushSize: 0.02, weight: 1.5, opacity: 0.35 }, 0.5);
    expect(mark).toMatchObject({ x: 0.5, y: 0.5, color: '#e2483d', texture: 'solid', opacity: 0.35 });
    expect(mark.size).toBeCloseTo(0.028);
  });
  it('emits clipped cursor preview state without saving artwork', () => {
    const { painter, send, onChange, onCursor } = setup();
    send('pointerenter', { pressure: 0.5 });
    const activePreview = onCursor.mock.lastCall![0];
    expect(activePreview).toMatchObject({ visible: true, x: 0.5, y: 0.5, color: '#e2483d', opacity: 0.8 });
    expect(activePreview.size).toBeCloseTo(0.02875);
    send('pointermove', { clientY: 0 });
    expect(onCursor).toHaveBeenLastCalledWith({ visible: false, x: 0.5, y: 0, size: 0.025, color: '#e2483d', opacity: 0.8 });
    send('pointerleave');
    expect(onCursor).toHaveBeenLastCalledWith({ visible: false, x: 0, y: 0, size: 0, color: '#e2483d', opacity: 0.8 });
    expect(onChange).not.toHaveBeenCalled();
    painter.destroy();
  });
  it.each(['pointerup', 'pointercancel', 'lostpointercapture', 'blur'])('saves once on %s', ending => {
    const { painter, send, onChange } = setup();
    send('pointerdown');
    expect(onChange).not.toHaveBeenCalled();
    if (ending === 'blur') window.dispatchEvent(new Event('blur')); else send(ending);
    send('pointerup');
    expect(onChange).toHaveBeenCalledExactlyOnceWith(clickStroke({ x: 0.5, y: 0.5 }, tool));
    painter.destroy();
  });
  it('groups marks by stroke and undoes or redoes one stroke at a time', () => {
    const { painter, send, onChange } = setup();
    send('pointerdown', { clientX: 400 });
    send('pointerup', { clientX: 400 });
    send('pointerdown', { clientX: 600 });
    send('pointerup', { clientX: 600 });
    expect(painter.canUndo()).toBe(true);
    expect(painter.canRedo()).toBe(false);
    expect(painter.getMarks()).toEqual([
      ...clickStroke({ x: 0.4, y: 0.5 }, tool),
      ...clickStroke({ x: 0.6, y: 0.5 }, tool),
    ]);
    painter.undo();
    expect(painter.getMarks()).toEqual(clickStroke({ x: 0.4, y: 0.5 }, tool));
    expect(onChange).toHaveBeenLastCalledWith(clickStroke({ x: 0.4, y: 0.5 }, tool));
    expect(painter.canRedo()).toBe(true);
    painter.redo();
    expect(painter.getMarks()).toEqual([
      ...clickStroke({ x: 0.4, y: 0.5 }, tool),
      ...clickStroke({ x: 0.6, y: 0.5 }, tool),
    ]);
    painter.destroy();
  });
  it('clears redo when painting after undo and reports history state changes', () => {
    const history = vi.fn();
    const fresh = setup([], {}, history);
    fresh.send('pointerdown', { clientX: 400 });
    fresh.send('pointerup', { clientX: 400 });
    fresh.send('pointerdown', { clientX: 600 });
    fresh.send('pointerup', { clientX: 600 });
    fresh.painter.undo();
    expect(fresh.painter.canRedo()).toBe(true);
    fresh.send('pointerdown', { clientX: 700 });
    fresh.send('pointerup', { clientX: 700 });
    expect(fresh.painter.canRedo()).toBe(false);
    expect(fresh.painter.getMarks()).toEqual([
      ...clickStroke({ x: 0.4, y: 0.5 }, tool),
      ...clickStroke({ x: 0.7, y: 0.5 }, tool),
    ]);
    expect(history).toHaveBeenLastCalledWith({ canUndo: true, canRedo: false });
    fresh.painter.destroy();
  });
  it('does not record eraser strokes on an empty canvas', () => {
    const { painter, send, onChange } = setup();
    painter.setTool({ ...tool, erase: true });
    send('pointerdown');
    send('pointerup');
    expect(painter.getMarks()).toEqual([]);
    expect(painter.canUndo()).toBe(false);
    expect(painter.canRedo()).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    painter.destroy();
  });
  it('still records eraser strokes after paint exists', () => {
    const { painter, send } = setup();
    send('pointerdown');
    send('pointerup');
    painter.setTool({ ...tool, erase: true });
    send('pointerdown', { clientX: 500 });
    send('pointerup', { clientX: 500 });
    expect(painter.canUndo()).toBe(true);
    expect(painter.getMarks().some(mark => mark.erase)).toBe(true);
    painter.destroy();
  });
  it('cancels an active stroke on clear without adding undo history', () => {
    const { painter, send, onChange } = setup();
    send('pointerdown');
    painter.clear();
    send('pointerup');
    expect(painter.getMarks()).toEqual([]);
    expect(painter.canUndo()).toBe(false);
    expect(painter.canRedo()).toBe(false);
    expect(onChange).toHaveBeenCalledExactlyOnceWith([]);
    painter.destroy();
  });
  it('ignores outside and secondary input and uses changed tools for new marks', () => {
    const { painter, send, onChange } = setup();
    send('pointerdown', { clientY: 0 });
    send('pointerdown', { isPrimary: false });
    send('pointerup');
    expect(onChange).not.toHaveBeenCalled();
    const changed: ToolState = { color: '#72d6ae', texture: 'marker', brushSize: 0.06, opacity: 0.6, weight: 1.2 };
    painter.setTool(changed);
    send('pointerdown');
    send('pointerup', { pointerId: 2 });
    expect(onChange).not.toHaveBeenCalled();
    send('pointerup');
    expect(onChange).toHaveBeenCalledWith(clickStroke({ x: 0.5, y: 0.5 }, changed));
    painter.destroy();
  });
  it.each([false, true])('clears and saves an empty snapshot, active stroke: %s', active => {
    const { painter, context, send, onChange } = setup([createPaintMark({ x: 0.5, y: 0.5 }, tool)]);
    expect(onChange).not.toHaveBeenCalled();
    if (active) send('pointerdown');
    painter.clear();
    send('pointerup');
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 1000, 400);
    expect(onChange).toHaveBeenCalledExactlyOnceWith([]);
    painter.destroy();
  });
  it('stores no drip when drip amount is off', () => {
    const { painter, send, onChange } = setup();
    painter.setTool({ ...tool, drip: 0 });
    send('pointerdown');
    send('pointerup');
    const marks = onChange.mock.calls[0][0] as ReturnType<typeof createPaintMark>[];
    expect(marks.every(mark => !mark.drip)).toBe(true);
    painter.destroy();
  });
  it.each(TEXTURES)('a %s click bursts wet paint so a drip is stored on the stroke', texture => {
    const { painter, send, onChange } = setup();
    painter.setTool({ ...tool, texture });
    send('pointerdown');
    send('pointerup');
    const marks = onChange.mock.calls[0][0] as ReturnType<typeof createPaintMark>[];
    expect(marks).toEqual(clickStroke({ x: 0.5, y: 0.5 }, { ...tool, texture }));
    expect(marks.some(mark => (mark.drip ?? 0) > 0)).toBe(true);
    expect(Math.max(...marks.map(mark => mark.drip ?? 0))).toBeLessThan(0.12);
    painter.destroy();
  });
  it.each(TEXTURES)('replays %s with the same drawing commands as live painting', texture => {
    const live = setup();
    live.painter.setTool({ ...tool, texture });
    live.send('pointerdown');
    live.send('pointerup');
    const replay = setup(live.onChange.mock.calls[0][0]);
    for (const name of Object.keys(live.context)) {
      if (typeof live.context[name] === 'function') {
        expect(replay.context[name].mock.calls).toEqual(live.context[name].mock.calls);
      }
    }
    expect(replay.onChange).not.toHaveBeenCalled();
    live.painter.destroy();
    replay.painter.destroy();
  });

  it('appends new strokes to the selected unlocked layer', () => {
    const document = documentFromSnapshot({ marks: [createPaintMark({ x: 0.4, y: 0.5 }, tool)], updatedAt: '2026-09-17T12:00:00.000Z' });
    const { painter, send, onChange } = setup(document);
    painter.createLayer('Highlights');
    send('pointerdown', { clientX: 600 });
    send('pointerup', { clientX: 600 });
    const saved = onChange.mock.lastCall![0] as ArtworkDocument;
    expect(saved.layers[0].marks).toEqual([createPaintMark({ x: 0.4, y: 0.5 }, tool)]);
    expect(saved.layers[1]).toMatchObject({ name: 'Highlights', marks: clickStroke({ x: 0.6, y: 0.5 }, tool) });
    painter.destroy();
  });

  it('rejects painting into locked active layers', () => {
    const document = documentFromSnapshot({ marks: [], updatedAt: '2026-09-17T12:00:00.000Z' });
    const { painter, send, onChange } = setup(document);
    painter.setLayerLocked('paint-layer-1', true);
    onChange.mockClear();
    send('pointerdown');
    send('pointerup');
    expect(painter.getDocument().layers[0].marks).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
    painter.destroy();
  });

  it('replays visible layers in stack order and excludes hidden layers from snapshots', async () => {
    const document = documentFromSnapshot({ marks: [createPaintMark({ x: 0.4, y: 0.5 }, tool)], updatedAt: '2026-09-17T12:00:00.000Z' });
    document.layers.push({
      id: 'paint-layer-2', name: 'Top', visible: true, locked: false,
      marks: [createPaintMark({ x: 0.6, y: 0.5 }, { ...tool, color: '#72d6ae' })],
      createdAt: document.updatedAt, updatedAt: document.updatedAt,
    });
    document.activeLayerId = 'paint-layer-2';
    const { painter, context } = setup(document);
    expect(context.arc.mock.calls.map(call => call[0])).toEqual([400, 600]);
    context.arc.mockClear();
    painter.setLayerVisible('paint-layer-2', false);
    expect(context.arc.mock.calls.map(call => call[0])).toEqual([400]);
    const overlayContext = canvasContext();
    const outputContext = { drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: '' };
    const overlay = { getContext: () => overlayContext, width: 0, height: 0 };
    const output = { getContext: () => outputContext, toDataURL: vi.fn(() => 'data:image/png;base64,Yw=='), width: 0, height: 0 };
    vi.stubGlobal('document', { createElement: vi.fn().mockReturnValueOnce(overlay).mockReturnValueOnce(output) });
    let image: { onload: () => void; src: string };
    vi.stubGlobal('Image', class { constructor() { image = this as unknown as typeof image; } });
    const result = painter.createSnapshot();
    expect(overlayContext.arc.mock.calls.map(call => call[0])).toEqual([400]);
    image!.onload();
    await expect(result).resolves.toBe('data:image/png;base64,Yw==');
    painter.destroy();
  });

  it('duplicates, reorders, and deletes layers while keeping stroke history targets stable', () => {
    const document = documentFromSnapshot({ marks: [createPaintMark({ x: 0.4, y: 0.5 }, tool)], updatedAt: '2026-09-17T12:00:00.000Z' });
    const { painter, send } = setup(document);
    painter.createLayer('Top');
    send('pointerdown', { clientX: 600 });
    send('pointerup', { clientX: 600 });
    painter.duplicateLayer('paint-layer-2');
    painter.moveLayer('paint-layer-3', 'down');
    painter.deleteLayer('paint-layer-2');
    expect(painter.getDocument().activeLayerId).toBe('paint-layer-3');
    painter.undo();
    expect(painter.getDocument().layers.some(layer => layer.id === 'paint-layer-2')).toBe(false);
    painter.redo();
    expect(painter.getDocument().layers.some(layer => layer.id === 'paint-layer-2')).toBe(false);
    painter.destroy();
  });
});
