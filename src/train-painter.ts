import { isInsidePaintableTrainArea, PAINTABLE_REGIONS, TRAIN_HEIGHT, TRAIN_WIDTH, type Point } from './train-template';

export type TextureId = 'solid';
export type ToolState = { color: string; texture: TextureId; brushSize: number };
// Positions and diameter are normalized; size is a fraction of train width.
export type PaintMark = Point & { color: string; texture: TextureId; size: number };

export class TrainPainter {
  private readonly context: CanvasRenderingContext2D;
  private readonly marks: PaintMark[] = [];
  private activePointer: number | null = null;
  private previous: Point | null = null;
  private tool: ToolState;

  constructor(private readonly canvas: HTMLCanvasElement, tool: ToolState) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas painting is unavailable in this browser.');
    this.context = context;
    this.tool = { ...tool };
    canvas.width = TRAIN_WIDTH * 2;
    canvas.height = TRAIN_HEIGHT * 2;
    context.scale(2, 2);
    context.beginPath();
    for (const region of PAINTABLE_REGIONS) {
      context.rect(region.x * TRAIN_WIDTH, region.y * TRAIN_HEIGHT,
        region.width * TRAIN_WIDTH, region.height * TRAIN_HEIGHT);
    }
    context.clip();
    canvas.addEventListener('pointerdown', this.start);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.finish);
    canvas.addEventListener('pointercancel', this.finish);
    canvas.addEventListener('lostpointercapture', this.finish);
    window.addEventListener('blur', this.cancel);
  }

  setTool(tool: ToolState): void { this.tool = { ...tool }; }

  private point(event: PointerEvent): Point {
    const bounds = this.canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height };
  }

  private start = (event: PointerEvent): void => {
    if (this.activePointer !== null || !event.isPrimary || event.button !== 0) return;
    const point = this.point(event);
    if (!isInsidePaintableTrainArea(point)) return;
    this.canvas.setPointerCapture(event.pointerId);
    this.activePointer = event.pointerId;
    this.previous = point;
    this.paint(point);
  };

  private move = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointer) return;
    if (event.buttons === 0) { this.cancel(); return; }
    const point = this.point(event);
    if (!isInsidePaintableTrainArea(point)) { this.previous = null; return; }
    const previous = this.previous ?? point;
    const distance = Math.hypot((point.x - previous.x) * TRAIN_WIDTH, (point.y - previous.y) * TRAIN_HEIGHT);
    const steps = Math.max(1, Math.ceil(distance / (this.tool.brushSize * TRAIN_WIDTH / 4)));
    for (let step = 1; step <= steps; step++) {
      this.paint({ x: previous.x + (point.x - previous.x) * step / steps,
        y: previous.y + (point.y - previous.y) * step / steps });
    }
    this.previous = point;
  };

  private paint(point: Point): void {
    if (!isInsidePaintableTrainArea(point)) return;
    const mark: PaintMark = { ...point, color: this.tool.color, texture: this.tool.texture, size: this.tool.brushSize };
    this.marks.push(mark);
    this.context.fillStyle = mark.color;
    this.context.beginPath();
    this.context.arc(mark.x * TRAIN_WIDTH, mark.y * TRAIN_HEIGHT, mark.size * TRAIN_WIDTH / 2, 0, Math.PI * 2);
    this.context.fill();
  }

  private finish = (event: PointerEvent): void => {
    if (event.pointerId === this.activePointer) this.cancel();
  };

  private cancel = (): void => {
    const pointer = this.activePointer;
    this.activePointer = null;
    this.previous = null;
    if (pointer !== null && this.canvas.hasPointerCapture(pointer)) this.canvas.releasePointerCapture(pointer);
  };

  destroy(): void {
    this.cancel();
    this.canvas.removeEventListener('pointerdown', this.start);
    this.canvas.removeEventListener('pointermove', this.move);
    this.canvas.removeEventListener('pointerup', this.finish);
    this.canvas.removeEventListener('pointercancel', this.finish);
    this.canvas.removeEventListener('lostpointercapture', this.finish);
    window.removeEventListener('blur', this.cancel);
  }
}
