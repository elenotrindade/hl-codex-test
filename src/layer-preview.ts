import { type PaintMark } from './train-painter';

function markShape(mark: PaintMark): SVGElement {
  const namespace = 'http://www.w3.org/2000/svg';
  const size = Math.max(2, mark.size * 100);
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
    const shape = markShape(mark);
    shape.setAttribute('fill', mark.color);
    shape.setAttribute('opacity', String(mark.opacity ?? 1));
    preview.append(shape);
  }
  return preview;
}
