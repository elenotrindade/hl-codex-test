import { describe, expect, it } from 'vitest';
import { drawShapeStamp, drawTextStamp, isShapeStamp, isTextStamp, type ShapeStamp } from '../src/editor-tools';

function recorder() {
  const calls: string[] = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    beginPath: () => calls.push('begin'),
    moveTo: () => calls.push('move'),
    lineTo: () => calls.push('line'),
    closePath: () => calls.push('close'),
    arc: () => calls.push('arc'),
    fill: () => calls.push('fill'),
    stroke: () => calls.push('stroke'),
    fillText: (value: string) => calls.push(`text:${value}:${ctx.font}`),
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    translate: () => calls.push('translate'),
    scale: () => calls.push('scale'),
  };
  return { ctx, calls };
}

describe('editor stamps', () => {
  it('fills a closed shape and strokes an outline', () => {
    const filled = recorder();
    const shape: ShapeStamp = { kind: 'rect', x2: 80, y2: 40, fill: true };
    drawShapeStamp(filled.ctx, shape, 10, 12, 8, '#e2483d');
    expect(filled.calls).toContain('fill');

    const outline = recorder();
    drawShapeStamp(outline.ctx, { ...shape, fill: false }, 10, 12, 8, '#e2483d');
    expect(outline.calls).not.toContain('fill');
    expect(outline.calls).toContain('stroke');
  });

  it('draws a star and an arrow with different paths', () => {
    const star = recorder();
    drawShapeStamp(star.ctx, { kind: 'star', x2: 90, y2: 70, fill: true }, 20, 20, 6, '#24485c');
    const arrow = recorder();
    drawShapeStamp(arrow.ctx, { kind: 'arrow', x2: 90, y2: 70, fill: true }, 20, 20, 6, '#24485c');
    expect(star.calls.filter(call => call === 'line').length).toBeGreaterThan(arrow.calls.filter(call => call === 'line').length);
    expect(arrow.calls).not.toContain('fill');
    expect(arrow.calls).toContain('stroke');
  });

  it('places text in the chosen font', () => {
    const drawn = recorder();
    drawTextStamp(drawn.ctx, { value: 'YARD', font: 'georgia' }, 40, 20, 28, '#e2483d');
    expect(drawn.calls).toEqual(['text:YARD:28px Georgia, serif']);
  });

  it('rejects stamps that cannot be saved', () => {
    expect(isShapeStamp({ kind: 'fan', x2: 0.2, y2: 0.2, fill: true })).toBe(false);
    expect(isTextStamp({ value: 'YARD', font: 'comic' })).toBe(false);
    expect(isTextStamp({ value: ' ', font: 'impact' })).toBe(false);
  });
});
