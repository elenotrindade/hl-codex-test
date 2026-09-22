import { getScenario, isInsidePaintableArea, paintableDripFloor, type PaintScenario } from './scenarios';
import { type Point } from './train-template';
import { cloneArtworkDocument, createDefaultArtworkDocument, createLayer as addDocumentLayer, deleteLayer as deleteDocumentLayer, duplicateLayer as duplicateDocumentLayer, flattenVisibleMarks, getActiveLayer, moveLayer as moveDocumentLayer, renameLayer as renameDocumentLayer, selectLayer, setLayerLocked as setDocumentLayerLocked, setLayerVisible as setDocumentLayerVisible, touchDocument, type ArtworkDocument } from './artwork-document';

import { clampCustomBrush, stampCustomBrush, type CustomBrush } from './custom-brush';
import { clamp, paintColorHex } from './color-tools';
import { clampEditorText, drawShapeStamp, drawTextStamp, type EditorFontId, type ShapeKind, type ShapeStamp, type TextStamp } from './editor-tools';
import { hitShapeBody, hitShapeHandle, moveShapeMark, resizeShapeMark, shapeBox, shapeHandlePoints, type ShapeHandleId } from './shape-edit';
import { SprayCanAudio } from './spray-audio';
import { isMetalTexture, METAL_TEXTURES, metalPaintStyle, type MetalTexture } from './metal-paint';
import { SPRAY_CLICK_BURST, sprayDripLength, sprayTaperAt, stampDrip, stampSpray, type SprayCap } from './spray-physics';

export const BRUSH_TEXTURES = ['solid', 'spray', 'marker', 'custom'] as const;
export { METAL_TEXTURES };
export const TEXTURES = [...BRUSH_TEXTURES, ...METAL_TEXTURES, 'shape', 'text'] as const;
export type TextureId = typeof TEXTURES[number];
export type ToolState = {
  color: string; texture: TextureId; brushSize: number; opacity: number; weight: number; drip?: number; erase?: boolean; brush?: CustomBrush;
  shapeKind?: ShapeKind; shapeFill?: boolean; text?: string; font?: EditorFontId; adjust?: boolean;
  taper?: number; cap?: SprayCap; finish?: MetalTexture;
};
// Positions and diameter are normalized; size is a fraction of train width.
export type PaintMark = Point & {
  color: string; texture: TextureId; size: number; opacity: number; erase?: boolean; brush?: CustomBrush; drip?: number;
  shape?: ShapeStamp; text?: TextStamp; cap?: SprayCap; finish?: MetalTexture;
};
export type CursorPreviewState = { visible: boolean; x: number; y: number; size: number; color: string; opacity: number };
export type HistoryState = { canUndo: boolean; canRedo: boolean };
export type ShapeEditFrame = {
  box: { x: number; y: number; width: number; height: number };
  handles: { id: ShapeHandleId; x: number; y: number }[];
  size: number;
  opacity: number;
};
type LayerPaintStroke = { layerId: string; marks: PaintMark[] };
type ReplaceStroke = { type: 'replace'; layerId: string; index: number; before: PaintMark; after: PaintMark };
type HistoryEntry = LayerPaintStroke | ReplaceStroke;
type ShapeSelection = { layerId: string; index: number };
type AdjustDrag = { kind: 'resize'; handle: ShapeHandleId } | { kind: 'move'; last: Point };

function copyPaintMark(mark: PaintMark): PaintMark {
  const next = { ...mark };
  if (mark.brush) next.brush = { ...mark.brush };
  if (mark.shape) next.shape = { ...mark.shape };
  if (mark.text) next.text = { ...mark.text };
  return next;
}

function isReplaceStroke(entry: HistoryEntry): entry is ReplaceStroke {
  return 'type' in entry && entry.type === 'replace';
}

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
  if (tool.texture === 'shape') {
    mark.shape = { kind: tool.shapeKind ?? 'rect', x2: point.x, y2: point.y, fill: tool.shapeFill !== false };
  }
  if (tool.texture === 'text') {
    const value = clampEditorText(tool.text ?? 'YARD');
    if (value) mark.text = { value, font: tool.font ?? 'impact' };
  }
  if (tool.texture === 'spray') mark.cap = tool.cap ?? 'standard';
  if (!tool.erase && tool.finish && isMetalTexture(tool.finish)) mark.finish = tool.finish;
  return mark;
}

function isPlacementTexture(texture: TextureId): boolean {
  return texture === 'shape' || texture === 'text';
}

export class TrainPainter {
  private readonly context: CanvasRenderingContext2D;
  private document: ArtworkDocument;
  private currentStroke: LayerPaintStroke = { layerId: '', marks: [] };
  private historyBase: LayerPaintStroke[] = [];
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private activePointer: number | null = null;
  private previous: Point | null = null;
  private tool: ToolState;
  private selection: ShapeSelection | null = null;
  private editBefore: PaintMark | null = null;
  private adjustDrag: AdjustDrag | null = null;
  private strokeBases: number[] = [];
  private strokeBackdrop: HTMLCanvasElement | null = null;
  private readonly emitLegacyMarks: boolean;
  private resizeObserver?: ResizeObserver;
  private resolutionQuery?: MediaQueryList;
  private readonly sprayAudio = new SprayCanAudio();
  private sprayPump?: number;

  constructor(private readonly canvas: HTMLCanvasElement, tool: ToolState,
    private readonly onChange: (document: ArtworkDocument | PaintMark[]) => void = () => {}, initialDocument: ArtworkDocument | PaintMark[] = createDefaultArtworkDocument(),
    private scenario: PaintScenario = getScenario('train'),
    private readonly onCursorChange: (state: CursorPreviewState) => void = () => {},
    private readonly onHistoryChange: (state: HistoryState) => void = () => {},
    private readonly onShapeEdit: (frame: ShapeEditFrame | null) => void = () => {}) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas painting is unavailable in this browser.');
    this.context = context;
    this.tool = { ...tool };
    this.emitLegacyMarks = Array.isArray(initialDocument);
    this.document = Array.isArray(initialDocument)
      ? createDefaultArtworkDocument()
      : cloneArtworkDocument(initialDocument);
    if (Array.isArray(initialDocument)) this.document.layers[0].marks = initialDocument.map(mark => ({ ...mark }));
    this.resetHistoryBase();
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
    const editing = this.tool.texture === 'shape' || Boolean(this.tool.adjust);
    this.tool = { ...tool };
    if (editing && this.tool.texture !== 'shape' && !this.tool.adjust) this.clearSelection();
    if (this.tool.erase) this.stopSprayFx();
  }

  setSprayAudioEnabled(enabled: boolean): void {
    this.sprayAudio.setEnabled(enabled);
  }

  setScenario(scenario: PaintScenario, document: ArtworkDocument | PaintMark[] = createDefaultArtworkDocument()): void {
    this.cancel();
    this.scenario = scenario;
    this.document = Array.isArray(document) ? createDefaultArtworkDocument() : cloneArtworkDocument(document);
    if (Array.isArray(document)) this.document.layers[0].marks = document.map(mark => ({ ...mark }));
    this.currentStroke = { layerId: '', marks: [] };
    this.clearSelection();
    this.resetHistoryBase();
    this.context.clearRect(0, 0, this.scenario.width, this.scenario.height);
    this.resize(true);
    this.notifyHistoryChange();
  }

  getMarks(): PaintMark[] { return flattenVisibleMarks(this.document); }

  getDocument(): ArtworkDocument { return cloneArtworkDocument(this.document); }

  setActiveLayer(layerId: string): void {
    this.cancel();
    if (!selectLayer(this.document, layerId)) return;
    this.clearSelection();
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
    const layer = duplicateDocumentLayer(this.document, layerId);
    if (!layer) return;
    if (layer.marks.length) this.historyBase.push({ layerId: layer.id, marks: layer.marks.map(mark => ({ ...mark })) });
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
    this.historyBase = this.historyBase.filter(stroke => stroke.layerId !== layerId);
    this.undoStack = this.undoStack.filter(stroke => stroke.layerId !== layerId);
    this.redoStack = this.redoStack.filter(stroke => stroke.layerId !== layerId);
    this.clearSelection();
    this.resize(true);
    this.emitChange(false);
  }

  canUndo(): boolean { return this.undoStack.length > 0; }

  canRedo(): boolean { return this.redoStack.length > 0; }

  undo(): void {
    this.cancel();
    const stroke = this.undoStack.pop();
    if (!stroke) return;
    this.redoStack.push(this.cloneHistoryEntry(stroke));
    this.replayFromHistory();
    this.emitChange();
  }

  redo(): void {
    this.cancel();
    const stroke = this.redoStack.pop();
    if (!stroke) return;
    this.undoStack.push(this.cloneHistoryEntry(stroke));
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
    this.historyBase = [];
    this.undoStack = [];
    this.redoStack = [];
    this.clearSelection();
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
    if (this.tool.adjust) {
      this.startAdjust(event, point);
      return;
    }
    if (!isInsidePaintableArea(this.scenario, point)) return;
    if (this.tool.texture === 'shape') this.clearSelection();
    try { this.canvas.setPointerCapture(event.pointerId); } catch { /* synthetic events may not capture */ }
    this.activePointer = event.pointerId;
    this.previous = point;
    this.currentStroke = { layerId: '', marks: [] };
    this.strokeBases = [];
    this.captureStrokeBackdrop();
    this.paint(point, event.pressure);
    if (isPlacementTexture(this.tool.texture)) return;
    if (!this.tool.erase) {
      for (let i = 1; i < SPRAY_CLICK_BURST; i++) this.paint(point, event.pressure);
    }
    this.flushSprayTaper();
    this.startSprayFx();
  };

  private move = (event: PointerEvent): void => {
    this.preview(event);
    if (event.pointerId !== this.activePointer) return;
    if (event.buttons === 0) { this.cancel(); return; }
    const point = this.point(event);
    if (this.adjustDrag?.kind === 'resize') {
      this.resizeSelectedHandle(this.adjustDrag.handle, point);
      return;
    }
    if (this.adjustDrag?.kind === 'move') {
      this.moveSelectedShape(point.x - this.adjustDrag.last.x, point.y - this.adjustDrag.last.y);
      this.adjustDrag = { kind: 'move', last: point };
      return;
    }
    if (this.tool.texture === 'text') return;
    if (this.tool.texture === 'shape') {
      if (isInsidePaintableArea(this.scenario, point)) this.reviseShape(point);
      return;
    }
    if (!isInsidePaintableArea(this.scenario, point)) { this.previous = null; return; }
    const previous = this.previous ?? point;
    const distance = Math.hypot((point.x - previous.x) * this.scenario.width, (point.y - previous.y) * this.scenario.height);
    const steps = Math.max(1, Math.ceil(distance / (this.tool.brushSize * this.scenario.width / 4)));
    for (let step = 1; step <= steps; step++) {
      this.paint({ x: previous.x + (point.x - previous.x) * step / steps,
        y: previous.y + (point.y - previous.y) * step / steps }, event.pressure);
    }
    this.flushSprayTaper();
    this.previous = point;
  };

  private paint(point: Point, pressure = 0): void {
    if (!isInsidePaintableArea(this.scenario, point)) return;
    const activeLayer = getActiveLayer(this.document);
    if (!activeLayer || activeLayer.locked) return;
    const mark = createPaintMark(point, this.tool, pressure);
    if (this.tool.texture === 'text' && !mark.text) return;
    if (!mark.erase && !isPlacementTexture(mark.texture)) {
      const drip = sprayDripLength(point, this.currentStroke.marks, {
        ...mark, dripAmount: this.tool.drip ?? 1, floor: paintableDripFloor(this.scenario, point),
      });
      if (drip > 0) mark.drip = drip;
    }
    activeLayer.marks.push(mark);
    if (!this.currentStroke.layerId) this.currentStroke.layerId = activeLayer.id;
    const stamped = { ...mark };
    if (mark.shape) stamped.shape = { ...mark.shape };
    if (mark.text) stamped.text = { ...mark.text };
    this.currentStroke.marks.push(stamped);
    if (this.tool.texture === 'spray' && (this.tool.taper ?? 0) > 0) {
      this.strokeBases.push(mark.size);
      return;
    }
    this.render(mark);
  }

  private captureStrokeBackdrop(): void {
    this.strokeBackdrop = null;
    if (this.tool.texture !== 'spray' || (this.tool.taper ?? 0) <= 0) return;
    if (typeof document === 'undefined') return;
    const width = this.canvas.width;
    const height = this.canvas.height;
    if (!width || !height) return;
    const backdrop = document.createElement('canvas');
    backdrop.width = width;
    backdrop.height = height;
    const copy = backdrop.getContext('2d');
    if (!copy) return;
    copy.drawImage(this.canvas, 0, 0);
    this.strokeBackdrop = backdrop;
  }

  private flushSprayTaper(): void {
    if (this.tool.texture !== 'spray' || (this.tool.taper ?? 0) <= 0 || this.strokeBases.length === 0) return;
    this.applySprayTaper();
    this.redrawTaperedStroke();
  }

  private redrawTaperedStroke(): void {
    const pixelWidth = this.canvas.width || this.scenario.width;
    const pixelHeight = this.canvas.height || this.scenario.height;
    if (typeof this.context.setTransform === 'function') {
      this.context.setTransform(1, 0, 0, 1, 0, 0);
      this.context.clearRect(0, 0, pixelWidth, pixelHeight);
      if (this.strokeBackdrop) this.context.drawImage(this.strokeBackdrop, 0, 0);
      this.context.setTransform(pixelWidth / this.scenario.width, 0, 0, pixelHeight / this.scenario.height, 0, 0);
      for (const mark of this.currentStroke.marks) this.renderTo(this.context, mark);
      return;
    }
    this.context.clearRect(0, 0, this.scenario.width, this.scenario.height);
    this.replayMarks(this.context);
  }

  private applySprayTaper(): void {
    const count = this.strokeBases.length;
    const taper = this.tool.taper ?? 0;
    const marks = this.currentStroke.marks;
    const distances = [0];
    for (let index = 1; index < count; index += 1) {
      const previous = marks[index - 1];
      const current = marks[index];
      const dx = ((current?.x ?? 0) - (previous?.x ?? 0)) * this.scenario.width;
      const dy = ((current?.y ?? 0) - (previous?.y ?? 0)) * this.scenario.height;
      distances.push(distances[index - 1] + Math.hypot(dx, dy));
    }
    const length = distances[count - 1] ?? 0;
    if (length <= 0) return;
    const layer = this.document.layers.find(item => item.id === this.currentStroke.layerId);
    const start = layer ? layer.marks.length - count : 0;
    for (let index = 0; index < count; index += 1) {
      const along = distances[index] / length;
      const size = clamp(this.strokeBases[index] * sprayTaperAt(along, taper), 0.003, 0.12);
      if (marks[index]) marks[index].size = size;
      if (layer && layer.marks[start + index]) layer.marks[start + index].size = size;
    }
  }

  private reviseShape(point: Point): void {
    const current = this.currentStroke.marks[0];
    if (!current?.shape) return;
    const next: PaintMark = { ...current, shape: { ...current.shape, x2: point.x, y2: point.y } };
    this.currentStroke.marks[0] = next;
    const layer = this.document.layers.find(item => item.id === this.currentStroke.layerId);
    if (layer?.marks.length) layer.marks[layer.marks.length - 1] = { ...next, shape: { ...next.shape! } };
    this.resize(true);
  }

  private resetHistoryBase(): void {
    this.historyBase = this.document.layers
      .filter(layer => layer.marks.length)
      .map(layer => ({ layerId: layer.id, marks: layer.marks.map(mark => ({ ...mark })) }));
    this.undoStack = [];
    this.redoStack = [];
  }

  private replayFromHistory(): void {
    for (const layer of this.document.layers) layer.marks = [];
    for (const stroke of this.historyBase) this.applyHistoryEntry(stroke);
    for (const stroke of this.undoStack) this.applyHistoryEntry(stroke);
    this.resize(true);
    this.keepSelection();
  }

  private applyHistoryEntry(entry: HistoryEntry): void {
    const layer = this.document.layers.find(item => item.id === entry.layerId);
    if (!layer) return;
    if (isReplaceStroke(entry)) {
      if (layer.marks[entry.index]) layer.marks[entry.index] = copyPaintMark(entry.after);
      return;
    }
    layer.marks.push(...entry.marks.map(copyPaintMark));
  }

  private cloneHistoryEntry(entry: HistoryEntry): HistoryEntry {
    if (isReplaceStroke(entry)) {
      return { type: 'replace', layerId: entry.layerId, index: entry.index, before: copyPaintMark(entry.before), after: copyPaintMark(entry.after) };
    }
    return { layerId: entry.layerId, marks: entry.marks.map(copyPaintMark) };
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
    const finish = mark.finish && isMetalTexture(mark.finish) ? mark.finish : isMetalTexture(mark.texture) ? mark.texture : undefined;
    const brushed = isMetalTexture(mark.texture) ? 'solid' : mark.texture;
    const paint = finish ? metalPaintStyle(ctx, finish, this.scenario.width, this.scenario.height) : mark.color;
    ctx.fillStyle = paint;
    ctx.strokeStyle = paint;
    ctx.globalAlpha = mark.opacity ?? 1;
    ctx.save();
    this.clipPaintable(ctx);
    if (brushed === 'shape' && mark.shape) {
      drawShapeStamp(ctx, {
        ...mark.shape,
        x2: mark.shape.x2 * this.scenario.width,
        y2: mark.shape.y2 * this.scenario.height,
      }, x, y, mark.size * this.scenario.width, paint);
    } else if (brushed === 'text' && mark.text) {
      drawTextStamp(ctx, mark.text, x, y, mark.size * this.scenario.width, paint);
    } else if (brushed === 'spray') {
      stampSpray(ctx, x, y, radius, mark.opacity ?? 1, mark, 0, this.scenario.height, mark.cap);
    } else if (brushed === 'custom') {
      stampCustomBrush(ctx, x, y, radius, mark.opacity ?? 1, clampCustomBrush(mark.brush));
    } else if (brushed === 'marker') {
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
    if (!mark.erase && !isPlacementTexture(brushed)) {
      stampDrip(ctx, x, y, radius, mark.opacity ?? 1, mark.drip ?? 0, this.scenario.height, mark);
    }
    ctx.restore();
    ctx.restore();
  }

  private finish = (event: PointerEvent): void => {
    this.hidePreview();
    if (event.pointerId === this.activePointer) this.completeStroke();
  };

  private preview = (event: PointerEvent): void => {
    if (this.tool.adjust) {
      this.hidePreview();
      return;
    }
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
      this.strokeBackdrop = null;
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
    this.strokeBackdrop = null;
    const pointer = this.activePointer;
    this.activePointer = null;
    this.previous = null;
    if (pointer !== null && this.canvas.hasPointerCapture(pointer)) this.canvas.releasePointerCapture(pointer);
    if (this.adjustDrag) {
      this.commitShapeEdit();
      return;
    }
    if (this.currentStroke.marks.length && this.isNoopEraseStroke()) {
      this.discardCurrentStrokeMarks();
      this.currentStroke = { layerId: '', marks: [] };
      this.notifyHistoryChange();
      return;
    }
    if (this.currentStroke.marks.length) {
      this.undoStack.push({ layerId: this.currentStroke.layerId, marks: this.currentStroke.marks.map(copyPaintMark) });
      this.redoStack = [];
      const placed = this.currentStroke.marks.length === 1 ? this.currentStroke.marks[0] : null;
      const layerId = this.currentStroke.layerId;
      this.currentStroke = { layerId: '', marks: [] };
      if (placed?.shape) {
        const layer = this.document.layers.find(item => item.id === layerId);
        if (layer) this.selection = { layerId, index: layer.marks.length - 1 };
      }
      this.emitShapeEdit();
      this.emitChange();
    } else {
      this.notifyHistoryChange();
    }
  }

  beginShapeEdit(): void {
    const mark = this.selectedMark();
    if (!mark || this.editBefore) return;
    this.editBefore = copyPaintMark(mark);
  }

  resizeSelectedHandle(handle: ShapeHandleId, point: Point): void {
    const mark = this.selectedMark();
    if (!mark || !this.selection) return;
    const next = resizeShapeMark(mark, handle, point);
    if (!this.cornersInside(next)) return;
    this.writeSelected(next);
  }

  moveSelectedShape(dx: number, dy: number): void {
    const mark = this.selectedMark();
    if (!mark || !this.selection) return;
    const next = moveShapeMark(mark, dx, dy);
    if (!this.cornersInside(next)) return;
    this.writeSelected(next);
  }

  setSelectedPaint(patch: { size?: number; opacity?: number }): void {
    const mark = this.selectedMark();
    if (!mark) return;
    const size = patch.size === undefined ? mark.size : clamp(patch.size, 0.003, 0.12);
    const opacity = patch.opacity === undefined ? mark.opacity : clamp(patch.opacity, 0.05, 1);
    if (size === mark.size && opacity === mark.opacity) return;
    this.writeSelected({ ...copyPaintMark(mark), size, opacity });
  }

  commitShapeEdit(): void {
    const current = this.selectedMark();
    const before = this.editBefore;
    this.editBefore = null;
    this.adjustDrag = null;
    if (!this.selection || !before?.shape || !current?.shape) return;
    const changed = before.x !== current.x || before.y !== current.y ||
      before.shape.x2 !== current.shape.x2 || before.shape.y2 !== current.shape.y2 ||
      before.size !== current.size || before.opacity !== current.opacity;
    if (!changed) return;
    this.undoStack.push({
      type: 'replace', layerId: this.selection.layerId, index: this.selection.index,
      before: copyPaintMark(before), after: copyPaintMark(current),
    });
    this.redoStack = [];
    this.emitChange();
  }

  private startAdjust(event: PointerEvent, point: Point): void {
    const handle = this.selectedMark() ? hitShapeHandle(this.selectedMark()!, point) : null;
    if (handle && this.selection) {
      try { this.canvas.setPointerCapture(event.pointerId); } catch { /* synthetic events may not capture */ }
      this.activePointer = event.pointerId;
      this.beginShapeEdit();
      this.adjustDrag = { kind: 'resize', handle };
      return;
    }
    if (this.selectShapeAt(point)) {
      try { this.canvas.setPointerCapture(event.pointerId); } catch { /* synthetic events may not capture */ }
      this.activePointer = event.pointerId;
      this.beginShapeEdit();
      this.adjustDrag = { kind: 'move', last: point };
      return;
    }
    this.clearSelection();
  }

  private selectShapeAt(point: Point): boolean {
    const layer = getActiveLayer(this.document);
    if (!layer || layer.locked || !layer.visible) return false;
    for (let index = layer.marks.length - 1; index >= 0; index -= 1) {
      if (!hitShapeBody(layer.marks[index], point)) continue;
      this.selection = { layerId: layer.id, index };
      this.editBefore = null;
      this.emitShapeEdit();
      return true;
    }
    return false;
  }

  private selectedMark(): PaintMark | null {
    const selection = this.selection;
    if (!selection) return null;
    const layer = this.document.layers.find(item => item.id === selection.layerId);
    const mark = layer?.marks[selection.index];
    const active = getActiveLayer(this.document);
    if (!layer || !mark?.shape || mark.erase || !active || active.locked || !active.visible || active.id !== layer.id) return null;
    return mark;
  }

  private cornersInside(mark: PaintMark): boolean {
    return Boolean(mark.shape) && isInsidePaintableArea(this.scenario, mark) &&
      isInsidePaintableArea(this.scenario, { x: mark.shape!.x2, y: mark.shape!.y2 });
  }

  private writeSelected(next: PaintMark): void {
    const selection = this.selection;
    if (!selection) return;
    const layer = this.document.layers.find(item => item.id === selection.layerId);
    const current = layer?.marks[selection.index];
    if (!layer || !current) return;
    if (!this.editBefore) this.editBefore = copyPaintMark(current);
    layer.marks[selection.index] = copyPaintMark(next);
    this.resize(true);
    this.emitShapeEdit();
  }

  private clearSelection(): void {
    this.selection = null;
    this.editBefore = null;
    this.adjustDrag = null;
    this.emitShapeEdit();
  }

  private keepSelection(): void {
    if (!this.selectedMark()) this.selection = null;
    this.emitShapeEdit();
  }

  private emitShapeEdit(): void {
    const mark = this.selectedMark();
    const box = mark ? shapeBox(mark) : null;
    if (!mark || !box) {
      this.onShapeEdit(null);
      return;
    }
    this.onShapeEdit({
      box: { x: box.left, y: box.top, width: box.right - box.left, height: box.bottom - box.top },
      handles: shapeHandlePoints(mark),
      size: mark.size,
      opacity: mark.opacity ?? 1,
    });
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
