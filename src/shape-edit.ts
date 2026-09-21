import { type Point } from './train-template';

export const BOX_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
export const LINE_HANDLES = ['start', 'end'] as const;
export type ShapeHandleId = typeof BOX_HANDLES[number] | typeof LINE_HANDLES[number];

type EditableShape = {
  x: number;
  y: number;
  texture: string;
  erase?: boolean;
  shape?: { kind: string; x2: number; y2: number; fill: boolean };
};

export type ShapeBox = { left: number; top: number; right: number; bottom: number };

export function shapeBox(mark: EditableShape): ShapeBox | null {
  if (mark.texture !== 'shape' || !mark.shape || mark.erase) return null;
  return {
    left: Math.min(mark.x, mark.shape.x2),
    top: Math.min(mark.y, mark.shape.y2),
    right: Math.max(mark.x, mark.shape.x2),
    bottom: Math.max(mark.y, mark.shape.y2),
  };
}

export function shapeHandlePoints(mark: EditableShape): { id: ShapeHandleId; x: number; y: number }[] {
  const box = shapeBox(mark);
  if (!box || !mark.shape) return [];
  if (mark.shape.kind === 'line' || mark.shape.kind === 'arrow') {
    return [
      { id: 'start', x: mark.x, y: mark.y },
      { id: 'end', x: mark.shape.x2, y: mark.shape.y2 },
    ];
  }
  const midX = (box.left + box.right) / 2;
  const midY = (box.top + box.bottom) / 2;
  return [
    { id: 'nw', x: box.left, y: box.top },
    { id: 'n', x: midX, y: box.top },
    { id: 'ne', x: box.right, y: box.top },
    { id: 'e', x: box.right, y: midY },
    { id: 'se', x: box.right, y: box.bottom },
    { id: 's', x: midX, y: box.bottom },
    { id: 'sw', x: box.left, y: box.bottom },
    { id: 'w', x: box.left, y: midY },
  ];
}

export function hitShapeHandle(mark: EditableShape, point: Point, slop = 0.02): ShapeHandleId | null {
  let best: { id: ShapeHandleId; distance: number } | null = null;
  for (const handle of shapeHandlePoints(mark)) {
    const distance = Math.hypot(handle.x - point.x, handle.y - point.y);
    if (distance <= slop && (!best || distance < best.distance)) best = { id: handle.id, distance };
  }
  return best?.id ?? null;
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  if (length === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length));
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

export function hitShapeBody(mark: EditableShape, point: Point, slop = 0.02): boolean {
  const box = shapeBox(mark);
  if (!box || !mark.shape) return false;
  if (mark.shape.kind === 'line' || mark.shape.kind === 'arrow') {
    return distanceToSegment(point, mark, { x: mark.shape.x2, y: mark.shape.y2 }) <= slop;
  }
  return point.x >= box.left - slop && point.x <= box.right + slop &&
    point.y >= box.top - slop && point.y <= box.bottom + slop;
}

export function resizeShapeMark<T extends EditableShape>(mark: T, handle: ShapeHandleId, point: Point): T {
  const shape = mark.shape;
  if (!shape) return mark;
  if (handle === 'start') return { ...mark, x: point.x, y: point.y, shape: { ...shape } };
  if (handle === 'end') return { ...mark, shape: { ...shape, x2: point.x, y2: point.y } };
  const box = shapeBox(mark);
  if (!box) return mark;
  let left = box.left;
  let right = box.right;
  let top = box.top;
  let bottom = box.bottom;
  if (handle === 'nw' || handle === 'w' || handle === 'sw') left = point.x;
  if (handle === 'ne' || handle === 'e' || handle === 'se') right = point.x;
  if (handle === 'nw' || handle === 'n' || handle === 'ne') top = point.y;
  if (handle === 'sw' || handle === 's' || handle === 'se') bottom = point.y;
  return { ...mark, x: left, y: top, shape: { ...shape, x2: right, y2: bottom } };
}

export function moveShapeMark<T extends EditableShape>(mark: T, dx: number, dy: number): T {
  if (!mark.shape) return mark;
  return {
    ...mark,
    x: mark.x + dx,
    y: mark.y + dy,
    shape: { ...mark.shape, x2: mark.shape.x2 + dx, y2: mark.shape.y2 + dy },
  };
}
