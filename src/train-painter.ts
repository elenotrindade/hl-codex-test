import { isInsidePaintableTrainArea, PAINTABLE_REGIONS, TRAIN_HEIGHT, TRAIN_WIDTH, trainTemplate, type Point } from './train-template';

export const TEXTURES = ['solid', 'spray', 'sticker', 'marker'] as const;
export type TextureId = typeof TEXTURES[number];
export type ToolState = { color: string; texture: TextureId; brushSize: number };
// Positions and diameter are normalized; size is a fraction of train width.
export type PaintMark = Point & { color: string; texture: TextureId; size: number };

export function createPaintMark(point: Point, tool: ToolState): PaintMark {
  return { ...point, color: tool.color, texture: tool.texture, size: tool.brushSize };
}

export class TrainPainter {
  private readonly context: CanvasRenderingContext2D;
  private readonly marks: PaintMark[] = [];
  private activePointer: number | null = null;
  private previous: Point | null = null;
  private tool: ToolState;
  private resizeObserver?: ResizeObserver;
  private resolutionQuery?: MediaQueryList;

  constructor(private readonly canvas: HTMLCanvasElement, tool: ToolState,
    private readonly onChange: (marks: PaintMark[]) => void = () => {}, initialMarks: PaintMark[] = []) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas painting is unavailable in this browser.');
    this.context = context;
    this.tool = { ...tool };
    this.marks.push(...initialMarks.map(mark => ({ ...mark })));
    this.resize();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.resize);
      this.resizeObserver.observe(canvas);
    }
    window.addEventListener('resize', this.resize);
    this.watchResolution();
    canvas.addEventListener('pointerdown', this.start);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.finish);
    canvas.addEventListener('pointercancel', this.finish);
    canvas.addEventListener('lostpointercapture', this.finish);
    window.addEventListener('blur', this.cancel);
  }

  setTool(tool: ToolState): void { this.tool = { ...tool }; }

  private watchResolution = (): void => {
    this.resolutionQuery?.removeEventListener('change', this.watchResolution);
    this.resize();
    if (typeof window.matchMedia === 'function') {
      this.resolutionQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      this.resolutionQuery.addEventListener('change', this.watchResolution);
    }
  };

  private resize = (): void => {
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (this.canvas.width === width && this.canvas.height === height) return;
    // Resetting the backing store clears its transform and clip; replay normalized marks.
    this.canvas.width = width;
    this.canvas.height = height;
    this.context.scale(width / TRAIN_WIDTH, height / TRAIN_HEIGHT);
    this.context.beginPath();
    for (const region of PAINTABLE_REGIONS) {
      this.context.rect(region.x * TRAIN_WIDTH, region.y * TRAIN_HEIGHT,
        region.width * TRAIN_WIDTH, region.height * TRAIN_HEIGHT);
    }
    this.context.clip();
    this.previous = null;
    for (const mark of this.marks) this.render(mark);
  };

  async createSnapshot(): Promise<string> {
    const overlay = document.createElement('canvas');
    overlay.width = TRAIN_WIDTH;
    overlay.height = TRAIN_HEIGHT;
    const overlayContext = overlay.getContext('2d');
    if (!overlayContext) throw new Error('Snapshot canvas unavailable');
    // Freeze the paint before loading the SVG so later strokes cannot alter this submission.
    overlayContext.drawImage(this.canvas, 0, 0, TRAIN_WIDTH, TRAIN_HEIGHT);
    const train = new Image();
    await new Promise<void>((resolve, reject) => {
      train.onload = () => resolve();
      train.onerror = () => reject(new Error('Train image could not load'));
      train.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trainTemplate().replace('<svg ',
        `<svg width="${TRAIN_WIDTH}" height="${TRAIN_HEIGHT}" `))}`;
    });
    const snapshot = document.createElement('canvas');
    snapshot.width = TRAIN_WIDTH;
    snapshot.height = TRAIN_HEIGHT;
    const context = snapshot.getContext('2d');
    if (!context) throw new Error('Snapshot canvas unavailable');
    context.fillStyle = '#ebe1c9';
    context.fillRect(0, 0, TRAIN_WIDTH, TRAIN_HEIGHT);
    context.drawImage(train, 0, 0, TRAIN_WIDTH, TRAIN_HEIGHT);
    context.drawImage(overlay, 0, 0);
    return snapshot.toDataURL('image/png');
  }

  clear(): void {
    this.marks.length = 0;
    const wasActive = this.activePointer !== null;
    this.cancel();
    this.context.clearRect(0, 0, TRAIN_WIDTH, TRAIN_HEIGHT);
    if (!wasActive) this.onChange([]);
  }

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
    const mark = createPaintMark(point, this.tool);
    this.marks.push(mark);
    this.render(mark);
  }

  private render(mark: PaintMark): void {
    const ctx = this.context;
    const x = mark.x * TRAIN_WIDTH;
    const y = mark.y * TRAIN_HEIGHT;
    const radius = mark.size * TRAIN_WIDTH / 2;
    ctx.save();
    ctx.fillStyle = mark.color;
    if (mark.texture === 'spray') {
      // Position-seeded speckles replay identically without storing random pixels.
      let seed = (Math.round(mark.x * 1e6) ^ Math.round(mark.y * 1e6)) >>> 0;
      const random = (): number => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < 24; i++) {
        const angle = random() * Math.PI * 2;
        const distance = Math.sqrt(random()) * radius * 0.9;
        ctx.beginPath();
        ctx.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance,
          radius * 0.065, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (mark.texture === 'sticker') {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = i * Math.PI / 5 - Math.PI / 2;
        const r = radius * (i % 2 ? 0.48 : 1);
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = '#fff4db';
      ctx.lineWidth = Math.max(0.5, radius * 0.12);
      ctx.fill();
      ctx.stroke();
    } else if (mark.texture === 'marker') {
      ctx.globalAlpha = 0.55;
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 6);
      ctx.fillRect(-radius, -radius * 0.3, radius * 2, radius * 0.6);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private finish = (event: PointerEvent): void => {
    if (event.pointerId === this.activePointer) this.cancel();
  };

  private cancel = (): void => {
    const pointer = this.activePointer;
    this.activePointer = null;
    this.previous = null;
    if (pointer !== null && this.canvas.hasPointerCapture(pointer)) this.canvas.releasePointerCapture(pointer);
    if (pointer !== null) this.onChange(this.marks.map(mark => ({ ...mark })));
  };

  destroy(): void {
    this.cancel();
    this.canvas.removeEventListener('pointerdown', this.start);
    this.canvas.removeEventListener('pointermove', this.move);
    this.canvas.removeEventListener('pointerup', this.finish);
    this.canvas.removeEventListener('pointercancel', this.finish);
    this.canvas.removeEventListener('lostpointercapture', this.finish);
    window.removeEventListener('blur', this.cancel);
    window.removeEventListener('resize', this.resize);
    this.resizeObserver?.disconnect();
    this.resolutionQuery?.removeEventListener('change', this.watchResolution);
  }
}
