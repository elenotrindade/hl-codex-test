import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPaintMark, TEXTURES, TrainPainter, type ToolState } from '../src/train-painter';

const tool: ToolState = { color: '#e2483d', texture: 'solid', brushSize: 0.025 };

function setup(initial = [] as ReturnType<typeof createPaintMark>[]) {
  const context = Object.fromEntries(['scale', 'beginPath', 'rect', 'clip', 'save', 'restore', 'arc',
    'fill', 'stroke', 'moveTo', 'lineTo', 'closePath', 'translate', 'rotate', 'fillRect', 'clearRect']
    .map(name => [name, vi.fn()]));
  const canvas = new EventTarget() as HTMLCanvasElement;
  canvas.getContext = vi.fn(() => context) as unknown as HTMLCanvasElement['getContext'];
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 400 }) as DOMRect;
  canvas.setPointerCapture = vi.fn();
  canvas.hasPointerCapture = () => false;
  vi.stubGlobal('window', new EventTarget());
  const onChange = vi.fn();
  const painter = new TrainPainter(canvas, tool, onChange, initial);
  const send = (type: string, overrides = {}) => {
    canvas.dispatchEvent(Object.assign(new Event(type), {
      pointerId: 1, isPrimary: true, button: 0, buttons: 1, clientX: 500, clientY: 200, ...overrides,
    }));
  };
  return { painter, context, onChange, send };
}
afterEach(() => vi.unstubAllGlobals());

describe('paint marks and stroke lifecycle', () => {
  it.each(TEXTURES)('copies normalized position and current %s tool into a mark', texture => {
    const current = { ...tool, texture };
    const point = { x: 0.5, y: 0.6 };
    const mark = createPaintMark(point, current);
    current.color = '#ffffff';
    point.x = 0;
    expect(mark).toEqual({ x: 0.5, y: 0.6, size: 0.025, color: '#e2483d', texture });
  });
  it.each(['pointerup', 'pointercancel', 'lostpointercapture', 'blur'])('saves once on %s', ending => {
    const { painter, send, onChange } = setup();
    send('pointerdown');
    expect(onChange).not.toHaveBeenCalled();
    if (ending === 'blur') window.dispatchEvent(new Event('blur')); else send(ending);
    send('pointerup');
    expect(onChange).toHaveBeenCalledExactlyOnceWith([createPaintMark({ x: 0.5, y: 0.5 }, tool)]);
    painter.destroy();
  });
  it('ignores outside and secondary input and uses changed tools for new marks', () => {
    const { painter, send, onChange } = setup();
    send('pointerdown', { clientY: 0 });
    send('pointerdown', { isPrimary: false });
    send('pointerup');
    expect(onChange).not.toHaveBeenCalled();
    const changed: ToolState = { color: '#72d6ae', texture: 'marker', brushSize: 0.06 };
    painter.setTool(changed);
    send('pointerdown');
    send('pointerup', { pointerId: 2 });
    expect(onChange).not.toHaveBeenCalled();
    send('pointerup');
    expect(onChange).toHaveBeenCalledWith([createPaintMark({ x: 0.5, y: 0.5 }, changed)]);
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
});
