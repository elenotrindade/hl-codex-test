import { getScenario, isInsidePaintableArea, type PaintScenario } from './scenarios';
import { type Point } from './train-template';
import { getActiveLayer, getRenderableMarks, replaceLayerMarks, type ArtworkSnapshot } from './layers';

export const TEXTURES = ['solid', 'spray', 'marker'] as const;
export type TextureId = typeof TEXTURES[number];
export type ToolState = { color: string; texture: TextureId; brushSize: number; opacity: number; weight: number };
// Positions and diameter are normalized; size is a fraction of train width.
export type PaintMark = Point & { color: string; texture: TextureId; size: number; opacity: number };
export type CursorPreviewState = { visible: boolean; x: number; y: number; size: number; color: string; opacity: number };
export type HistoryState = { canUndo: boolean; canRedo: boolean };
type PaintStroke = PaintMark[];

function applyPhotoLighting(context: CanvasRenderingContext2D, width: number, height: number): void {
  if (typeof context.createLinearGradient !== 'function' || typeof context.createRadialGradient !== 'function') return;
  const sun = context.createLinearGradient(0, 0, width, height * 0.9);
  sun.addColorStop(0, 'rgb(255 255 255 / 0.2)');
  sun.addColorStop(0.42, 'rgb(255 255 255 / 0.04)');
  sun.addColorStop(1, 'rgb(0 0 0 / 0.16)');
  context.fillStyle = sun;
  context.fillRect(0, 0, width, height);

  const contact = context.createRadialGradient(width * 0.52, height * 0.63, 0, width * 0.52, height * 0.63, width * 0.55);
  contact.addColorStop(0, 'rgb(255 255 255 / 0.08)');
  contact.addColorStop(0.7, 'rgb(0 0 0 / 0)');
  contact.addColorStop(1, 'rgb(0 0 0 / 0.18)');
  context.fillStyle = contact;
  context.fillRect(0, 0, width, height);
}

export function createPaintMark(point: Point, tool: ToolState, pressure = 0): PaintMark {
  const weight = tool.weight ?? 1;
  const pressureScale = pressure > 0 ? 0.65 + pressure * weight : weight;
  return { ...point, color: tool.color, texture: tool.texture, size: tool.brushSize * pressureScale, opacity: tool.opacity ?? 1 };
}

export class TrainPainter {
  private readonly context: CanvasRenderingContext2D;
  private readonly marks: PaintMark[] = [];
  private renderMarks: PaintMark[] = [];
  private artwork: ArtworkSnapshot | null = null;
  private currentStroke: PaintStroke = [];
  private undoStack: PaintStroke[] = [];
  private redoStack: PaintStroke[] = [];
  private activePointer: number | null = null;
  private previous: Point | null = null;
  private tool: ToolState;
  private resizeObserver?: ResizeObserver;
  private resolutionQuery?: MediaQueryList;

  constructor(private readonly canvas: HTMLCanvasElement, tool: ToolState,
    private readonly onChange: (marks: PaintMark[]) => void = () => {}, initialMarks: PaintMark[] = [],
    private scenario: PaintScenario = getScenario('train'),
    private readonly onCursorChange: (state: CursorPreviewState) => void = () => {},
    private readonly onHistoryChange: (state: HistoryState) => void = () => {}) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas painting is unavailable in this browser.');
    this.context = context;
    this.tool = { ...tool };
    this.marks.push(...initialMarks.map(mark => ({ ...mark })));
    this.undoStack = initialMarks.length ? [initialMarks.map(mark => ({ ...mark }))] : [];
    this.resize();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(canvas);
    }
    window.addEventListener('resize', this.handleResize);
    this.watchResolution();
    canvas.addEventListener('pointerdown', this.start);
    canvas.addEventListener('pointerenter', this.preview);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerleave', this.hidePreview);
    canvas.addEventListener('pointerup', this.finish);
    canvas.addEventListener('pointercancel', this.finish);
    canvas.addEventListener('lostpointercapture', this.finish);
    window.addEventListener('blur', this.handleBlur);
    this.notifyHistoryChange();
  }

  setTool(tool: ToolState): void { this.tool = { ...tool }; }

  setScenario(scenario: PaintScenario, marks: PaintMark[] = []): void {
    this.cancel();
    this.scenario = scenario;
    this.artwork = null;
    this.marks.length = 0;
    this.marks.push(...marks.map(mark => ({ ...mark })));
    this.renderMarks = this.marks.map(mark => ({ ...mark }));
    this.currentStroke = [];
    this.undoStack = marks.length ? [marks.map(mark => ({ ...mark }))] : [];
    this.redoStack = [];
    this.resize(true);
    this.notifyHistoryChange();
  }

  setArtwork(scenario: PaintScenario, snapshot: ArtworkSnapshot): void {
    this.cancel();
    this.scenario = scenario;
    this.artwork = { ...snapshot, layers: snapshot.layers.map(layer => ({ ...layer, marks: layer.marks.map(mark => ({ ...mark })) })) };
    const activeMarks = getActiveLayer(snapshot).marks;
    this.marks.length = 0;
    this.marks.push(...activeMarks.map(mark => ({ ...mark })));
    this.renderMarks = getRenderableMarks(snapshot.layers);
    this.currentStroke = [];
    this.undoStack = activeMarks.length ? [activeMarks.map(mark => ({ ...mark }))] : [];
    this.redoStack = [];
    this.resize(true);
    this.notifyHistoryChange();
  }

  getMarks(): PaintMark[] { return this.marks.map(mark => ({ ...mark })); }

  canUndo(): boolean { return this.undoStack.length > 0; }

  canRedo(): boolean { return this.redoStack.length > 0; }

  undo(): void {
    this.cancel();
    const stroke = this.undoStack.pop();
    if (!stroke) return;
    this.redoStack.push(stroke.map(mark => ({ ...mark })));
    this.replayFromHistory();
    this.emitChange();
  }

  redo(): void {
    this.cancel();
    const stroke = this.redoStack.pop();
    if (!stroke) return;
    this.undoStack.push(stroke.map(mark => ({ ...mark })));
    this.replayFromHistory();
    this.emitChange();
  }

  private watchResolution = (): void => {
    this.resolutionQuery?.removeEventListener('change', this.watchResolution);
    this.resize();
    if (typeof window.matchMedia === 'function') {
      this.resolutionQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      this.resolutionQuery.addEventListener('change', this.watchResolution);
    }
  };

  private handleResize = (): void => { this.resize(); };

  private resize = (force = false): void => {
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (!force && this.canvas.width === width && this.canvas.height === height) return;
    // Resetting the backing store clears its transform and clip; replay normalized marks.
    this.canvas.width = width;
    this.canvas.height = height;
    this.context.scale(width / this.scenario.width, height / this.scenario.height);
    this.context.beginPath();
    for (const region of this.scenario.paintableRegions) {
      this.context.rect(region.x * this.scenario.width, region.y * this.scenario.height,
        region.width * this.scenario.width, region.height * this.scenario.height);
    }
    this.context.clip();
    this.previous = null;
    const marks = this.renderMarks.length ? this.renderMarks : this.marks;
    for (const mark of marks) this.render(mark);
  };

  async createSnapshot(): Promise<string> {
    const overlay = document.createElement('canvas');
    overlay.width = this.scenario.width;
    overlay.height = this.scenario.height;
    const overlayContext = overlay.getContext('2d');
    if (!overlayContext) throw new Error('Snapshot canvas unavailable');
    // Freeze the paint before loading the SVG so later strokes cannot alter this submission.
    overlayContext.drawImage(this.canvas, 0, 0, this.scenario.width, this.scenario.height);
    const base = new Image();
    await new Promise<void>((resolve, reject) => {
      base.onload = () => resolve();
      base.onerror = () => reject(new Error(`${this.scenario.label} image could not load`));
      base.src = this.scenario.imageSrc;
    });
    const snapshot = document.createElement('canvas');
    snapshot.width = this.scenario.width;
    snapshot.height = this.scenario.height;
    const context = snapshot.getContext('2d');
    if (!context) throw new Error('Snapshot canvas unavailable');
    context.fillStyle = this.scenario.snapshotBackground;
    context.fillRect(0, 0, this.scenario.width, this.scenario.height);
    context.drawImage(base, 0, 0, this.scenario.width, this.scenario.height);
    context.drawImage(overlay, 0, 0);
    applyPhotoLighting(context, this.scenario.width, this.scenario.height);
    return snapshot.toDataURL('image/png');
  }

  clear(): void {
    this.marks.length = 0;
    this.syncLayeredArtwork();
    this.cancel(false);
    this.currentStroke = [];
    this.undoStack = [];
    this.redoStack = [];
    if (this.artwork) this.resize(true); else this.context.clearRect(0, 0, this.scenario.width, this.scenario.height);
    this.emitChange();
  }

  private point(event: PointerEvent): Point {
    const bounds = this.canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height };
  }

  private start = (event: PointerEvent): void => {
    if (this.activePointer !== null || !event.isPrimary || event.button !== 0) return;
    const point = this.point(event);
    if (!isInsidePaintableArea(this.scenario, point)) return;
    this.canvas.setPointerCapture(event.pointerId);
    this.activePointer = event.pointerId;
    this.previous = point;
    this.currentStroke = [];
    this.paint(point, event.pressure);
  };

  private move = (event: PointerEvent): void => {
    this.preview(event);
    if (event.pointerId !== this.activePointer) return;
    if (event.buttons === 0) { this.cancel(); return; }
    const point = this.point(event);
    if (!isInsidePaintableArea(this.scenario, point)) { this.previous = null; return; }
    const previous = this.previous ?? point;
    const distance = Math.hypot((point.x - previous.x) * this.scenario.width, (point.y - previous.y) * this.scenario.height);
    const steps = Math.max(1, Math.ceil(distance / (this.tool.brushSize * this.scenario.width / 4)));
    for (let step = 1; step <= steps; step++) {
      this.paint({ x: previous.x + (point.x - previous.x) * step / steps,
        y: previous.y + (point.y - previous.y) * step / steps }, event.pressure);
    }
    this.previous = point;
  };

  private paint(point: Point, pressure = 0): void {
    if (!isInsidePaintableArea(this.scenario, point)) return;
    const mark = createPaintMark(point, this.tool, pressure);
    this.marks.push(mark);
    this.syncLayeredArtwork();
    this.currentStroke.push({ ...mark });
    if (this.artwork) this.resize(true); else this.render(mark);
  }

  private replayFromHistory(): void {
    this.marks.length = 0;
    this.marks.push(...this.undoStack.flat().map(mark => ({ ...mark })));
    this.syncLayeredArtwork();
    this.resize(true);
  }

  private syncLayeredArtwork(): void {
    if (!this.artwork) {
      this.renderMarks = this.marks.map(mark => ({ ...mark }));
      return;
    }
    this.artwork = replaceLayerMarks(this.artwork, this.artwork.activeLayerId, this.marks);
    this.renderMarks = getRenderableMarks(this.artwork.layers);
  }

  private emitChange(): void {
    this.notifyHistoryChange();
    this.onChange(this.getMarks());
  }

  private notifyHistoryChange(): void {
    this.onHistoryChange({ canUndo: this.canUndo(), canRedo: this.canRedo() });
  }

  private render(mark: PaintMark): void {
    const ctx = this.context;
    const x = mark.x * this.scenario.width;
    const y = mark.y * this.scenario.height;
    const radius = mark.size * this.scenario.width / 2;
    ctx.save();
    ctx.fillStyle = mark.color;
    ctx.globalAlpha = mark.opacity ?? 1;
    if (mark.texture === 'spray') {
      // Position-seeded speckles replay identically without storing random pixels.
      let seed = (Math.round(mark.x * 1e6) ^ Math.round(mark.y * 1e6)) >>> 0;
      const random = (): number => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      ctx.globalAlpha = (mark.opacity ?? 1) * 0.45;
      for (let i = 0; i < 24; i++) {
        const angle = random() * Math.PI * 2;
        const distance = Math.sqrt(random()) * radius * 0.9;
        ctx.beginPath();
        ctx.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance,
          radius * 0.065, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (mark.texture === 'marker') {
      ctx.globalAlpha = (mark.opacity ?? 1) * 0.55;
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
    this.hidePreview();
    if (event.pointerId === this.activePointer) this.completeStroke();
  };

  private preview = (event: PointerEvent): void => {
    const point = this.point(event);
    this.onCursorChange({ visible: isInsidePaintableArea(this.scenario, point), x: point.x, y: point.y,
      size: createPaintMark(point, this.tool, event.pressure).size, color: this.tool.color, opacity: this.tool.opacity });
  };

  private hidePreview = (): void => {
    this.onCursorChange({ visible: false, x: 0, y: 0, size: 0, color: this.tool.color, opacity: this.tool.opacity });
  };

  private handleBlur = (): void => { this.cancel(); };

  private cancel = (commit = true): void => {
    const pointer = this.activePointer;
    this.hidePreview();
    if (pointer !== null && this.canvas.hasPointerCapture(pointer)) this.canvas.releasePointerCapture(pointer);
    if (pointer !== null && commit) {
      this.completeStroke();
    } else {
      this.activePointer = null;
      this.previous = null;
      this.currentStroke = [];
    }
  };

  private completeStroke(): void {
    const pointer = this.activePointer;
    this.activePointer = null;
    this.previous = null;
    if (pointer !== null && this.canvas.hasPointerCapture(pointer)) this.canvas.releasePointerCapture(pointer);
    if (this.currentStroke.length) {
      this.undoStack.push(this.currentStroke.map(mark => ({ ...mark })));
      this.redoStack = [];
      this.currentStroke = [];
      this.emitChange();
    } else {
      this.notifyHistoryChange();
    }
  }

  destroy(): void {
    this.cancel();
    this.canvas.removeEventListener('pointerdown', this.start);
    this.canvas.removeEventListener('pointerenter', this.preview);
    this.canvas.removeEventListener('pointermove', this.move);
    this.canvas.removeEventListener('pointerleave', this.hidePreview);
    this.canvas.removeEventListener('pointerup', this.finish);
    this.canvas.removeEventListener('pointercancel', this.finish);
    this.canvas.removeEventListener('lostpointercapture', this.finish);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();
    this.resolutionQuery?.removeEventListener('change', this.watchResolution);
  }
}
