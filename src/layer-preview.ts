import { isMetalTexture, metalFallback } from './metal-paint';
import { type PaintMark } from './train-painter';

function markShape(mark: PaintMark): SVGElement {
  const namespace = 'http://www.w3.org/2000/svg';
  const size = Math.max(2, mark.size * 100);
  if (mark.texture === 'custom' && mark.brush) {
    const rect = document.createElementNS(namespace, 'rect');
    const width = size * 2;
    const height = Math.max(2, width * mark.brush.aspect);
    rect.setAttribute('x', String(mark.x * 100 - width / 2));
    rect.setAttribute('y', String(mark.y * 40 - height / 2));
    rect.setAttribute('width', String(width));
    rect.setAttribute('height', String(height));
    rect.setAttribute('rx', mark.brush.tip === 'round' ? String(height / 2) : '0');
    rect.setAttribute('transform', `rotate(${mark.brush.angle} ${mark.x * 100} ${mark.y * 40})`);
    return rect;
  }
  if (mark.texture === 'text') {
    const text = document.createElementNS(namespace, 'text');
    text.setAttribute('x', String(mark.x * 100));
    text.setAttribute('y', String(mark.y * 40));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', String(Math.max(4, size)));
    text.textContent = (mark.text?.value ?? 'T').slice(0, 12);
    return text;
  }
  if (mark.texture === 'shape' && mark.shape) {
    const x2 = mark.shape.x2 * 100;
    const y2 = mark.shape.y2 * 40;
    if (mark.shape.kind === 'line' || mark.shape.kind === 'arrow') {
      const line = document.createElementNS(namespace, 'line');
      line.setAttribute('x1', String(mark.x * 100));
      line.setAttribute('y1', String(mark.y * 40));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(y2));
      return line;
    }
    const box = document.createElementNS(namespace, 'rect');
    box.setAttribute('x', String(Math.min(mark.x * 100, x2)));
    box.setAttribute('y', String(Math.min(mark.y * 40, y2)));
    box.setAttribute('width', String(Math.max(1, Math.abs(x2 - mark.x * 100))));
    box.setAttribute('height', String(Math.max(1, Math.abs(y2 - mark.y * 40))));
    return box;
  }
  if (mark.texture === 'marker') {
    const rect = document.createElementNS(namespace, 'rect');
    rect.setAttribute('x', String(mark.x * 100 - size));
    rect.setAttribute('y', String(mark.y * 40 - size * 0.3));
    rect.setAttribute('width', String(size * 2));
    rect.setAttribute('height', String(size * 0.6));
    rect.setAttribute('transform', `rotate(-15 ${mark.x * 100} ${mark.y * 40})`);
    return rect;
  }

  const circle = document.createElementNS(namespace, 'circle');
  circle.setAttribute('cx', String(mark.x * 100));
  circle.setAttribute('cy', String(mark.y * 40));
  circle.setAttribute('r', String(mark.texture === 'spray' ? size * 0.7 : size * 0.5));
  return circle;
}

export function createLayerPreview(marks: PaintMark[]): SVGSVGElement {
  const namespace = 'http://www.w3.org/2000/svg';
  const preview = document.createElementNS(namespace, 'svg');
  preview.setAttribute('class', 'layer-preview');
  preview.setAttribute('viewBox', '0 0 100 40');
  preview.setAttribute('aria-hidden', 'true');
  preview.setAttribute('focusable', 'false');
  const background = document.createElementNS(namespace, 'rect');
  background.setAttribute('width', '100');
  background.setAttribute('height', '40');
  background.setAttribute('rx', '2');
  preview.append(background);
  for (const mark of marks) {
    if (mark.erase) continue;
    const shape = markShape(mark);
    const outline = mark.texture === 'shape' && mark.shape && (mark.shape.kind === 'line' || mark.shape.kind === 'arrow' || !mark.shape.fill);
    const finish = mark.finish && isMetalTexture(mark.finish) ? mark.finish : isMetalTexture(mark.texture) ? mark.texture : undefined;
    shape.setAttribute('fill', outline ? 'none' : finish ? metalFallback(finish) : mark.color);
    if (mark.texture === 'shape') shape.setAttribute('stroke', mark.color);
    shape.setAttribute('opacity', String(mark.opacity ?? 1));
    preview.append(shape);
  }
  return preview;
}
