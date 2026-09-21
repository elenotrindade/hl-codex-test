import { getScenario, isInsidePaintableArea, type PaintScenario } from './scenarios';
import { type Point } from './train-template';
import { cloneArtworkDocument, createDefaultArtworkDocument, createLayer as addDocumentLayer, deleteLayer as deleteDocumentLayer, duplicateLayer as duplicateDocumentLayer, flattenVisibleMarks, getActiveLayer, moveLayer as moveDocumentLayer, renameLayer as renameDocumentLayer, selectLayer, setLayerLocked as setDocumentLayerLocked, setLayerVisible as setDocumentLayerVisible, touchDocument, type ArtworkDocument } from './artwork-document';

import { clampCustomBrush, stampCustomBrush, type CustomBrush } from './custom-brush';
import { clamp, paintColorHex } from './color-tools';
import { SprayCanAudio } from './spray-audio';
import { SPRAY_CLICK_BURST, sprayDripLength, stampDrip, stampSpray } from './spray-physics';

export const TEXTURES = ['solid', 'spray', 'marker', 'custom'] as const;
export type TextureId = typeof TEXTURES[number];
export type ToolState = { color: string; texture: TextureId; brushSize: number; opacity: number; weight: number; drip?: number; erase?: boolean; brush?: CustomBrush };
// Positions and diameter are normalized; size is a fraction of train width.
export type PaintMark = Point & { color: string; texture: TextureId; size: number; opacity: number; erase?: boolean; brush?: CustomBrush; drip?: number };
export type CursorPreviewState = { visible: boolean; x: number; y: number; size: number; color: string; opacity: number };
export type HistoryState = { canUndo: boolean; canRedo: boolean };
type LayerPaintStroke = { layerId: string; marks: PaintMark[] };

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
  const mark: PaintMark = {
    ...point,
    color: tool.erase ? '#000000' : paintColorHex(tool.color),
    texture: tool.texture,
    size: clamp(tool.brushSize * pressureScale, 0.003, 0.12),
    opacity: tool.opacity ?? 1,
  };
  if (tool.erase) mark.erase = true;
  if (tool.texture === 'custom') mark.brush = clampCustomBrush(tool.brush);
  return mark;
}

export class TrainPainter {
  private readonly context: CanvasRenderingContext2D;
  private document: ArtworkDocument;
  private currentStroke: LayerPaintStroke = { layerId: '', marks: [] };
  private undoStack: LayerPaintStroke[] = [];
  private redoStack: LayerPaintStroke[] = [];
  private activePointer: number | null = null;
  private previous: Point | null = null;
  private tool: ToolState;
  private readonly emitLegacyMarks: boolean;
  private resizeObserver?: ResizeObserver;
  private resolutionQuery?: MediaQueryList;
  private readonly sprayAudio = new SprayCanAudio();
  private sprayPump?: number;

  constructor(private readonly canvas: HTMLCanvasElement, tool: ToolState,
    private readonly onChange: (document: ArtworkDocument | PaintMark[]) => void = () => {}, initialDocument: ArtworkDocument | PaintMark[] = createDefaultArtworkDocument(),
    private scenario: PaintScenario = getScenario('train'),
    private readonly onCursorChange: (state: CursorPreviewState) => void = () => {},
    private readonly onHistoryChange: (state: HistoryState) => void = () => {}) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas painting is unavailable in this browser.');
    this.context = context;
    this.tool = { ...tool };
    this.emitLegacyMarks = Array.isArray(initialDocument);
    this.document = Array.isArray(initialDocument)
      ? createDefaultArtworkDocument()
      : cloneArtworkDocument(initialDocument);
    if (Array.isArray(initialDocument)) this.document.layers[0].marks = initialDocument.map(mark => ({ ...mark }));
    const activeLayer = getActiveLayer(this.document);
    this.undoStack = activeLayer && activeLayer.marks.length ? [{ layerId: activeLayer.id, marks: activeLayer.marks.map(mark => ({ ...mark })) }] : [];
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

  setTool(tool: ToolState): void {
    this.tool = { ...tool };
    if (this.tool.erase) this.stopSprayFx();
  }

  setScenario(scenario: PaintScenario, document: ArtworkDocument | PaintMark[] = createDefaultArtworkDocument()): void {
    this.cancel();
    this.scenario = scenario;
    this.document = Array.isArray(document) ? createDefaultArtworkDocument() : cloneArtworkDocument(document);
    if (Array.isArray(document)) this.document.layers[0].marks = document.map(mark => ({ ...mark }));
    this.currentStroke = { layerId: '', marks: [] };
    const activeLayer = getActiveLayer(this.document);
    this.undoStack = activeLayer && activeLayer.marks.length ? [{ layerId: activeLayer.id, marks: activeLayer.marks.map(mark => ({ ...mark })) }] : [];
    this.redoStack = [];
    this.context.clearRect(0, 0, this.scenario.width, this.scenario.height);
    this.resize(true);
    this.notifyHistoryChange();
  }

  getMarks(): PaintMark[] { return flattenVisibleMarks(this.document); }

  getDocument(): ArtworkDocument { return cloneArtworkDocument(this.document); }

  setActiveLayer(layerId: string): void {
    this.cancel();
    if (!selectLayer(this.document, layerId)) return;
    this.emitChange(false);
  }

  createLayer(name?: string): void {
    this.cancel();
    addDocumentLayer(this.document, name);
    this.emitChange(false);
  }

  renameLayer(layerId: string, name: string): void {
    this.cancel();
    if (!renameDocumentLayer(this.document, layerId, name)) return;
    this.emitChange(false);
  }

  setLayerLocked(layerId: string, locked: boolean): void {
    this.cancel();
    if (!setDocumentLayerLocked(this.document, layerId, locked)) return;
    this.emitChange(false);
  }

  setLayerVisible(layerId: string, visible: boolean): void {
    this.cancel();
    if (!setDocumentLayerVisible(this.document, layerId, visible)) return;
    this.resize(true);
    this.emitChange(false);
  }

  duplicateLayer(layerId: string): void {
    this.cancel();
    if (!duplicateDocumentLayer(this.document, layerId)) return;
    this.resize(true);
    this.emitChange(false);
  }

  moveLayer(layerId: string, direction: 'up' | 'down'): void {
    this.cancel();
    if (!moveDocumentLayer(this.document, layerId, direction)) return;
    this.resize(true);
    this.emitChange(false);
  }

  deleteLayer(layerId: string): void {
    this.cancel();
    if (!deleteDocumentLayer(this.document, layerId)) return;
    this.resize(true);
    this.emitChange(false);
  }

  canUndo(): boolean { return this.undoStack.length > 0; }

  canRedo(): boolean { return this.redoStack.length > 0; }

  undo(): void {
    this.cancel();
    const stroke = this.undoStack.pop();
    if (!stroke) return;
    this.redoStack.push({ layerId: stroke.layerId, marks: stroke.marks.map(mark => ({ ...mark })) });
    this.replayFromHistory();
    this.emitChange();
  }

  redo(): void {
    this.cancel();
    const stroke = this.redoStack.pop();
    if (!stroke) return;
    this.undoStack.push({ layerId: stroke.layerId, marks: stroke.marks.map(mark => ({ ...mark })) });
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
    this.previous = null;
    this.replayMarks(this.context);
  };

  async createSnapshot(): Promise<string> {
    const overlay = document.createElement('canvas');
    overlay.width = this.scenario.width;
    overlay.height = this.scenario.height;
    const overlayContext = overlay.getContext('2d');
    if (!overlayContext) throw new Error('Snapshot canvas unavailable');
    // Freeze the current visible document state before loading the SVG.
    this.replayMarks(overlayContext);
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
    const activeLayer = getActiveLayer(this.document);
    if (activeLayer) activeLayer.marks = [];
    this.cancel(false);
    this.currentStroke = { layerId: '', marks: [] };
    this.undoStack = [];
    this.redoStack = [];
    this.context.clearRect(0, 0, this.scenario.width, this.scenario.height);
    this.resize(true);
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
    try { this.canvas.setPointerCapture(event.pointerId); } catch { /* synthetic events may not capture */ }
    this.activePointer = event.pointerId;
    this.previous = point;
    this.currentStroke = { layerId: '', marks: [] };
    this.paint(point, event.pressure);
    if (!this.tool.erase) {
      for (let i = 1; i < SPRAY_CLICK_BURST; i++) this.paint(point, event.pressure);
    }
    this.startSprayFx();
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
    const activeLayer = getActiveLayer(this.document);
    if (!activeLayer || activeLayer.locked) return;
    const mark = createPaintMark(point, this.tool, pressure);
    if (!mark.erase) {
      const drip = sprayDripLength(point, this.currentStroke.marks, { ...mark, dripAmount: this.tool.drip ?? 1 });
      if (drip > 0) mark.drip = drip;
    }
    activeLayer.marks.push(mark);
    if (!this.currentStroke.layerId) this.currentStroke.layerId = activeLayer.id;
    this.currentStroke.marks.push({ ...mark });
    this.render(mark);
  }

  private replayFromHistory(): void {
    for (const layer of this.document.layers) layer.marks = [];
    for (const stroke of this.undoStack) {
      const layer = this.document.layers.find(item => item.id === stroke.layerId);
      if (layer) layer.marks.push(...stroke.marks.map(mark => ({ ...mark })));
    }
    this.resize(true);
  }

  private emitChange(touch = true): void {
    this.notifyHistoryChange();
    if (touch) touchDocument(this.document);
    this.onChange(this.emitLegacyMarks ? this.getMarks() : this.getDocument());
  }

  private notifyHistoryChange(): void {
    this.onHistoryChange({ canUndo: this.canUndo(), canRedo: this.canRedo() });
  }

  private render(mark: PaintMark): void {
    this.renderTo(this.context, mark);
  }

  private replayMarks(ctx: CanvasRenderingContext2D): void {
    for (const mark of flattenVisibleMarks(this.document)) this.renderTo(ctx, mark);
  }

  private clipPaintable(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    for (const region of this.scenario.paintableRegions) {
      ctx.rect(region.x * this.scenario.width, region.y * this.scenario.height,
        region.width * this.scenario.width, region.height * this.scenario.height);
    }
    ctx.clip();
  }

  private renderTo(ctx: CanvasRenderingContext2D, mark: PaintMark): void {
    const x = mark.x * this.scenario.width;
    const y = mark.y * this.scenario.height;
    const radius = mark.size * this.scenario.width / 2;
    ctx.save();
    if (mark.erase) ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = mark.color;
    ctx.globalAlpha = mark.opacity ?? 1;
    ctx.save();
    this.clipPaintable(ctx);
    if (mark.texture === 'spray') {
      stampSpray(ctx, x, y, radius, mark.opacity ?? 1, mark, 0, this.scenario.height);
    } else if (mark.texture === 'custom') {
      stampCustomBrush(ctx, x, y, radius, mark.opacity ?? 1, clampCustomBrush(mark.brush));
    } else if (mark.texture === 'marker') {
      ctx.save();
      ctx.globalAlpha = (mark.opacity ?? 1) * 0.55;
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 6);
      ctx.fillRect(-radius, -radius * 0.3, radius * 2, radius * 0.6);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (!mark.erase) stampDrip(ctx, x, y, radius, mark.opacity ?? 1, mark.drip ?? 0, this.scenario.height, mark);
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
    this.stopSprayFx();
    const pointer = this.activePointer;
    this.hidePreview();
    if (pointer !== null && this.canvas.hasPointerCapture(pointer)) this.canvas.releasePointerCapture(pointer);
    if (pointer !== null && commit) {
      this.completeStroke();
    } else {
      this.activePointer = null;
      this.previous = null;
      this.currentStroke = { layerId: '', marks: [] };
    }
  };

  private isNoopEraseStroke(): boolean {
    return this.currentStroke.marks.every(mark => mark.erase) &&
      !flattenVisibleMarks(this.document).some(mark => !mark.erase);
  }

  private discardCurrentStrokeMarks(): void {
    const layer = this.document.layers.find(item => item.id === this.currentStroke.layerId);
    if (!layer) return;
    layer.marks.splice(Math.max(0, layer.marks.length - this.currentStroke.marks.length), this.currentStroke.marks.length);
  }

  private startSprayFx(): void {
    if (this.tool.erase) return;
    this.sprayAudio.start();
    if (this.sprayPump !== undefined || typeof window.setInterval !== 'function') return;
    this.sprayPump = window.setInterval(() => {
      if (this.previous) this.paint(this.previous);
    }, 40);
  }

  private stopSprayFx(): void {
    if (this.sprayPump !== undefined) {
      window.clearInterval(this.sprayPump);
      this.sprayPump = undefined;
    }
    this.sprayAudio.stop();
  }

  private completeStroke(): void {
    this.stopSprayFx();
    const pointer = this.activePointer;
    this.activePointer = null;
    this.previous = null;
    if (pointer !== null && this.canvas.hasPointerCapture(pointer)) this.canvas.releasePointerCapture(pointer);
    if (this.currentStroke.marks.length && this.isNoopEraseStroke()) {
      this.discardCurrentStrokeMarks();
      this.currentStroke = { layerId: '', marks: [] };
      this.notifyHistoryChange();
      return;
    }
    if (this.currentStroke.marks.length) {
      this.undoStack.push({ layerId: this.currentStroke.layerId, marks: this.currentStroke.marks.map(mark => ({ ...mark })) });
      this.redoStack = [];
      this.currentStroke = { layerId: '', marks: [] };
      this.emitChange();
    } else {
      this.notifyHistoryChange();
    }
  }

  destroy(): void {
    this.cancel();
    this.sprayAudio.dispose();
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
