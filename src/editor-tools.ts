import { clamp } from './color-tools';

export const SHAPE_KINDS = ['rect', 'ellipse', 'triangle', 'star', 'line', 'arrow'] as const;
export type ShapeKind = typeof SHAPE_KINDS[number];

export const EDITOR_FONTS = [
  { id: 'impact', label: 'Impact', family: 'Impact, "Arial Narrow", sans-serif' },
  { id: 'georgia', label: 'Georgia', family: 'Georgia, serif' },
  { id: 'courier', label: 'Courier', family: '"Courier New", monospace' },
  { id: 'arial', label: 'Arial Black', family: '"Arial Black", Arial, sans-serif' },
  { id: 'palatino', label: 'Palatino', family: 'Palatino, "Palatino Linotype", serif' },
] as const;
export type EditorFontId = typeof EDITOR_FONTS[number]['id'];

export type ShapeStamp = { kind: ShapeKind; x2: number; y2: number; fill: boolean };
export type TextStamp = { value: string; font: EditorFontId };

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  star: 'Star',
  line: 'Line',
  arrow: 'Arrow',
};

const CLOSED_SHAPES = new Set<ShapeKind>(['rect', 'ellipse', 'triangle', 'star']);

export function shapeUsesFill(kind: ShapeKind): boolean {
  return CLOSED_SHAPES.has(kind);
}

export function isShapeStamp(value: unknown): value is ShapeStamp {
  if (!value || typeof value !== 'object') return false;
  const shape = value as ShapeStamp;
  return SHAPE_KINDS.includes(shape.kind) &&
    Number.isFinite(shape.x2) && Number.isFinite(shape.y2) &&
    (shape.fill === true || shape.fill === false);
}

export function isTextStamp(value: unknown): value is TextStamp {
  if (!value || typeof value !== 'object') return false;
  const text = value as TextStamp;
  return typeof text.value === 'string' && text.value.trim().length > 0 && text.value.length <= 48 &&
    EDITOR_FONTS.some(font => font.id === text.font);
}

export function clampEditorText(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 48);
}

export function editorFontFamily(id: string | undefined): string {
  return EDITOR_FONTS.find(font => font.id === id)?.family ?? EDITOR_FONTS[0].family;
}

type DrawContext = Pick<CanvasRenderingContext2D, 'arc' | 'beginPath' | 'closePath' | 'fill' | 'fillText' | 'lineTo' | 'moveTo' | 'restore' | 'save' | 'scale' | 'stroke' | 'translate'> & {
  fillStyle: CanvasRenderingContext2D['fillStyle'];
  font: string;
  lineWidth: number;
  strokeStyle: CanvasRenderingContext2D['strokeStyle'];
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
};

function traceClosed(ctx: DrawContext, kind: ShapeKind, x: number, y: number, x2: number, y2: number): void {
  const left = Math.min(x, x2);
  const top = Math.min(y, y2);
  const width = Math.abs(x2 - x);
  const height = Math.abs(y2 - y);
  ctx.beginPath();
  if (kind === 'ellipse') {
    ctx.save();
    ctx.translate(left + width / 2, top + height / 2);
    ctx.scale(Math.max(width, 1) / 2, Math.max(height, 1) / 2);
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.restore();
    return;
  }
  if (kind === 'triangle') {
    ctx.moveTo((x + x2) / 2, top);
    ctx.lineTo(left, top + height);
    ctx.lineTo(left + width, top + height);
    ctx.closePath();
    return;
  }
  if (kind === 'star') {
    const cx = (x + x2) / 2;
    const cy = (y + y2) / 2;
    const outer = Math.max(width, height) / 2;
    const inner = outer * 0.42;
    for (let point = 0; point < 10; point += 1) {
      const radius = point % 2 === 0 ? outer : inner;
      const angle = -Math.PI / 2 + point * Math.PI / 5;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      if (point === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    return;
  }
  ctx.moveTo(left, top);
  ctx.lineTo(left + width, top);
  ctx.lineTo(left + width, top + height);
  ctx.lineTo(left, top + height);
  ctx.closePath();
}

function traceArrow(ctx: DrawContext, x: number, y: number, x2: number, y2: number, stroke: number): void {
  const angle = Math.atan2(y2 - y, x2 - x);
  const head = Math.max(stroke * 3.2, 14);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(angle - 0.45) * head, y2 - Math.sin(angle - 0.45) * head);
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(angle + 0.45) * head, y2 - Math.sin(angle + 0.45) * head);
}

export function drawShapeStamp(ctx: DrawContext, shape: ShapeStamp, x: number, y: number, stroke: number, color: string): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = clamp(stroke, 2, 80);
  if (shape.kind === 'line') {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(shape.x2, shape.y2);
    ctx.stroke();
    return;
  }
  if (shape.kind === 'arrow') {
    traceArrow(ctx, x, y, shape.x2, shape.y2, ctx.lineWidth);
    ctx.stroke();
    return;
  }
  traceClosed(ctx, shape.kind, x, y, shape.x2, shape.y2);
  if (shape.fill && shapeUsesFill(shape.kind)) ctx.fill();
  else ctx.stroke();
}

export function drawTextStamp(ctx: DrawContext, text: TextStamp, x: number, y: number, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.font = `${Math.max(12, size)}px ${editorFontFamily(text.font)}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.value, x, y);
}
