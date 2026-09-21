import '@fortawesome/fontawesome-free/css/fontawesome.css';
import '@fortawesome/fontawesome-free/css/solid.css';
import './styles.css';
import { TrainPainter, TEXTURES, type TextureId, type ToolState } from './train-painter';
import { BRUSH_TIP_LABELS, BRUSH_TIPS, clampCustomBrush, fittedStampRadius, loadCustomBrush, saveCustomBrush, stampCustomBrush, type BrushTip } from './custom-brush';
import { loadArtworkDocument, saveArtwork, loadGallery, saveGallery } from './storage';
import { createDefaultArtworkDocument, getActiveLayer, type ArtworkDocument } from './artwork-document';
import { DEFAULT_COLOR, colorFromWheelPoint, moveWheelSelection, type WheelMoveDirection, type WheelSelection } from './paint-tools';
import { describePaintColor, formatHexColor, paintColorHex } from './color-tools';
import { publishArtwork, upvote, rankGallery, paginateGallery, type GalleryEntry } from './gallery';
import { getScenario, scenarios, type PaintScenario } from './scenarios';
import { openDialog } from './dialogs';
import { exportTrainImage, type ExportAction, type ExportOutcome } from './artwork-export';
import { renderLayerPanel, syncLayerStatus } from './layer-panel';
import { findPaintCanvas } from './paint-canvas';

const tool: ToolState = { color: DEFAULT_COLOR, texture: 'solid', brushSize: 0.025, opacity: 0.9, weight: 1, drip: 1, brush: loadCustomBrush() };
const rankingPageSize = 3;
let rankingPage = 0;
let activeScenario: PaintScenario = getScenario('train');
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <a class="skip-link" href="#workshop">Skip to the workshop</a>
  <main>
    <div class="yard-strip">
      <p class="yard-strip__brand">
        <span>YARD</span>
        <span>OPEN CANVAS</span>
        <span>NO. 001</span>
      </p>
      <div class="yard-strip__canvas">
        <span id="scenario-select-help">Changing canvas clears the current artwork after confirmation.</span>
        <label for="scenario-select">Canvas</label>
        <select id="scenario-select" aria-describedby="scenario-select-help">
          ${scenarios.map(scenario => `<option value="${scenario.id}"${scenario.id === activeScenario.id ? ' selected' : ''}>${scenario.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <header>
      <h1>Leave your <em>mark.</em></h1>
    </header>
    <section id="workshop" class="workshop" aria-label="Street painting workshop" tabindex="-1">
      <div class="stage-panel">
        <div class="stage-heading">
          <span id="scenario-stamp">TRAIN</span>
        </div>
        <div class="stage-canvas">
          <div class="paint-stage" aria-live="polite">${activeScenario.template()}<canvas aria-label="${activeScenario.ariaLabel}">Canvas support is required to paint.</canvas><div class="brush-cursor" aria-hidden="true"></div></div>
          <div class="stage-overlay stage-overlay--brushes">
            <div class="textures" role="group" aria-label="Paint texture">
              ${TEXTURES.map(texture => texture === 'custom' ? `<div class="texture-custom">
                <button type="button" data-texture="custom" aria-pressed="false" aria-expanded="false" aria-controls="custom-brush-panel" aria-label="custom">
                  <canvas id="custom-brush-preview" class="texture-sample" width="80" height="48" aria-hidden="true"></canvas>
                  <span>custom</span>
                </button>
                <div id="custom-brush-panel" class="custom-brush" hidden>
                  <p class="tool-label" id="custom-brush-title">Craft marker</p>
                  <canvas id="custom-brush-popup-preview" class="custom-brush__preview" width="200" height="88" aria-hidden="true"></canvas>
                  <label for="custom-brush-tip">Tip</label>
                  <select id="custom-brush-tip">
                    ${BRUSH_TIPS.map(tip => `<option value="${tip}">${BRUSH_TIP_LABELS[tip]}</option>`).join('')}
                  </select>
                  <label for="custom-brush-angle">Angle <output id="custom-angle-value" for="custom-brush-angle">-30°</output></label>
                  <input id="custom-brush-angle" type="range" min="-90" max="90" value="-30" aria-valuetext="-30 degrees" />
                  <label for="custom-brush-aspect">Nib ratio <output id="custom-aspect-value" for="custom-brush-aspect">0.35</output></label>
                  <input id="custom-brush-aspect" type="range" min="15" max="100" value="35" aria-valuetext="0.35" />
                  <label for="custom-brush-softness">Softness <output id="custom-softness-value" for="custom-brush-softness">15%</output></label>
                  <input id="custom-brush-softness" type="range" min="0" max="80" value="15" aria-valuetext="15 percent" />
                  <p class="tool-note">Stamps replay with the settings used on each stroke.</p>
                </div>
              </div>` : `<button type="button" data-texture="${texture}" aria-pressed="${texture === 'solid'}" aria-label="${texture}">
                <img class="texture-sample" src="/references/texture-${texture}.svg" alt="" width="80" height="48" />
                <span>${texture}</span>
              </button>`).join('')}
            </div>
          </div>
          <div class="stage-overlay stage-overlay--controls">
            <div class="history-actions" role="group" aria-label="Stroke history">
              <button type="button" id="undo-stroke" class="icon-button" disabled aria-disabled="true" aria-label="Undo stroke" title="Undo stroke">
                <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
              </button>
              <button type="button" id="redo-stroke" class="icon-button" disabled aria-disabled="true" aria-label="Redo stroke" title="Redo stroke">
                <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
              </button>
              <button type="button" id="clear-artwork" class="icon-button" aria-label="Clear artwork" title="Clear artwork">
                <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
              </button>
            </div>
            <div class="stage-size">
              <label for="brush-size">Brush size <output id="size-value" for="brush-size">25</output></label>
              <input id="brush-size" type="range" min="6" max="60" value="25" aria-valuetext="25 train units" />
            </div>
          </div>
        </div>
      </div>
      <aside class="tools" aria-label="Painting status and secondary controls">
        <div class="color-wheel" role="group" aria-labelledby="color-wheel-label">
          <p id="color-wheel-label" class="tool-label">Color mixer</p>
          <div class="color-wheel__ring">
            <p id="selected-color-hex" class="color-wheel__meta color-wheel__meta--hex">#e2483d</p>
            <button type="button" class="color-wheel__surface" aria-label="Choose paint color from wheel">
              <span class="color-wheel__handle" aria-hidden="true"></span>
            </button>
            <p id="selected-color-rgba" class="color-wheel__meta color-wheel__meta--rgba">rgba(226, 72, 61, 0.9)</p>
          </div>
          <div class="color-presets" role="group" aria-label="Preset colors">
            <button type="button" class="color-swatch" data-color-preset="#000000" aria-pressed="false" aria-label="Black" title="Black"><span class="color-swatch__fill" aria-hidden="true"></span></button>
            <button type="button" class="color-swatch" data-color-preset="#ffffff" aria-pressed="false" aria-label="White" title="White"><span class="color-swatch__fill" aria-hidden="true"></span></button>
            <button type="button" id="eraser-tool" aria-pressed="false" aria-label="Eraser" title="Eraser">
              <i class="fa-solid fa-eraser" aria-hidden="true"></i>
            </button>
            <button type="button" id="color-picker" aria-pressed="false" aria-label="Pick a color from the canvas" title="Pick a color from the canvas">
              <i class="fa-solid fa-eye-dropper" aria-hidden="true"></i>
            </button>
          </div>
        </div>
        <label for="brush-opacity">Opacity <output id="opacity-value" for="brush-opacity">90%</output></label>
        <input id="brush-opacity" type="range" min="5" max="100" value="90" aria-valuetext="90 percent" />
        <label for="brush-weight">Brush weight <output id="weight-value" for="brush-weight">1.0x</output></label>
        <input id="brush-weight" type="range" min="50" max="200" value="100" aria-valuetext="1.0 times pressure" />
        <label for="brush-drip">Drip <output id="drip-value" for="brush-drip">100%</output></label>
        <input id="brush-drip" type="range" min="0" max="100" value="100" aria-valuetext="100 percent" />
        <p id="save-status" role="status" aria-live="polite"></p>
      </aside>
      <aside class="layer-panel" aria-labelledby="layers-heading">
        <div class="layer-panel__heading"><h2 id="layers-heading">Layers</h2><button type="button" id="add-layer">Add layer</button></div>
        <ol id="layer-list" class="layer-list"></ol>
        <p id="layer-status" role="status" aria-live="polite"></p>
      </aside>
    </section>
    <section class="display-panel" aria-label="On display">
      <div class="display-actions">
        <div class="display-publish">
          <label for="artwork-title">Artwork name <span>optional</span></label>
          <input id="artwork-title" type="text" maxlength="80" placeholder="Midnight layup" autocomplete="off" />
          <button type="button" id="publish-artwork">Put on display</button>
          <p id="gallery-status" role="status" aria-live="polite"></p>
        </div>
        <div class="export-actions" aria-labelledby="export-heading">
          <h3 id="export-heading">Save or share your current scene</h3>
          <div class="export-actions__buttons">
            <button type="button" id="download-artwork">Download PNG</button>
            <button type="button" id="share-artwork">Share image</button>
          </div>
          <p id="export-status" role="status" aria-live="polite"></p>
        </div>
      </div>
    </section>
    <section class="ranking-panel" aria-labelledby="ranking-heading">
      <h2 id="ranking-heading" class="ranking-heading">Yard ranking / Most upvoted</h2>
      <ol id="gallery-ranking"></ol>
      <nav class="ranking-pagination" aria-label="Yard ranking pages">
        <button type="button" id="ranking-prev">Previous</button>
        <span id="ranking-page-status" role="status" aria-live="polite">Page 1 of 1</span>
        <button type="button" id="ranking-next">Next</button>
      </nav>
    </section>
    <dialog id="share-dialog" aria-labelledby="share-dialog-title"></dialog>
    <dialog id="artwork-dialog" aria-labelledby="artwork-dialog-title"></dialog>
    <footer>Saved automatically after each stroke, in this browser only.</footer>
  </main>`;

const canvas = findPaintCanvas(document)!;
const cursor = document.querySelector<HTMLDivElement>('.brush-cursor')!;
const undoButton = document.querySelector<HTMLButtonElement>('#undo-stroke')!;
const redoButton = document.querySelector<HTMLButtonElement>('#redo-stroke')!;
const saved = loadArtworkDocument(undefined, activeScenario);
const status = document.querySelector<HTMLParagraphElement>('#save-status')!;
const layerList = document.querySelector<HTMLDivElement>('#layer-list')!;
const layerStatus = document.querySelector<HTMLParagraphElement>('#layer-status')!;
status.textContent = {
  loaded: 'Latest artwork restored.', missing: 'Ready for your first mark.',
  invalid: 'Saved artwork could not be read. Starting with an empty scene.',
  unavailable: 'Local storage unavailable. Paint may be lost on reload.',
}[saved.status];
status.dataset.error = String(saved.status === 'invalid' || saved.status === 'unavailable');
function renderLayers(artwork: ArtworkDocument): void {
  renderLayerPanel(artwork, layerList, layerStatus, {
    select: layerId => { painter.setActiveLayer(layerId); syncLayerStatus(layerStatus, `${painter.getDocument().layers.find(layer => layer.id === layerId)?.name ?? 'Layer'} is active.`); },
    rename: (layerId, name) => { painter.renameLayer(layerId, name); syncLayerStatus(layerStatus, `${painter.getDocument().layers.find(layer => layer.id === layerId)?.name ?? 'Layer'} renamed.`); },
    lock: (layerId, locked) => { painter.setLayerLocked(layerId, locked); syncLayerStatus(layerStatus, `${painter.getDocument().layers.find(layer => layer.id === layerId)?.name ?? 'Layer'} ${locked ? 'locked' : 'unlocked'}.`); },
    visible: (layerId, visible) => { painter.setLayerVisible(layerId, visible); syncLayerStatus(layerStatus, `${painter.getDocument().layers.find(layer => layer.id === layerId)?.name ?? 'Layer'} ${visible ? 'visible' : 'hidden'}.`); },
    move: (layerId, direction) => { painter.moveLayer(layerId, direction); syncLayerStatus(layerStatus, `${painter.getDocument().layers.find(layer => layer.id === layerId)?.name ?? 'Layer'} moved ${direction}.`); },
    duplicate: layerId => { const name = painter.getDocument().layers.find(layer => layer.id === layerId)?.name ?? 'Layer'; painter.duplicateLayer(layerId); syncLayerStatus(layerStatus, `${name} duplicated.`); },
    delete: layerId => { const name = painter.getDocument().layers.find(layer => layer.id === layerId)?.name ?? 'Layer'; painter.deleteLayer(layerId); syncLayerStatus(layerStatus, `${name} deleted.`); },
  });
}
function updateHistoryControls(state: { canUndo: boolean; canRedo: boolean }): void {
  undoButton.disabled = !state.canUndo;
  redoButton.disabled = !state.canRedo;
  undoButton.setAttribute('aria-disabled', String(!state.canUndo));
  redoButton.setAttribute('aria-disabled', String(!state.canRedo));
}
const painter = new TrainPainter(canvas, tool, document => {
  const artwork = document as ArtworkDocument;
  const markCount = artwork.layers.reduce((total, layer) => total + layer.marks.length, 0);
  const success = saveArtwork(artwork, undefined, activeScenario);
  renderLayers(artwork);
  status.textContent = success ? '' : 'Could not save.';
  status.dataset.error = String(!success);
}, saved.document ?? createDefaultArtworkDocument(), activeScenario, state => {
  const stage = cursor.parentElement!;
  stage.dataset.cursor = String(state.visible ? 'active' : 'idle');
  cursor.style.setProperty('--cursor-x', `${state.x * 100}%`);
  cursor.style.setProperty('--cursor-y', `${state.y * 100}%`);
  cursor.style.setProperty('--cursor-size', `${state.size * activeScenario.width}px`);
  cursor.style.setProperty('--cursor-color', tool.erase ? '#fff4db' : state.color);
  cursor.style.setProperty('--cursor-opacity', String(state.opacity));
  stage.dataset.eraser = String(Boolean(tool.erase));
}, updateHistoryControls);
renderLayers(painter.getDocument());
document.querySelector<HTMLButtonElement>('#add-layer')!.addEventListener('click', () => {
  painter.createLayer();
  const activeLayer = getActiveLayer(painter.getDocument());
  syncLayerStatus(layerStatus, `${activeLayer?.name ?? 'New layer'} created and selected.`);
});
undoButton.addEventListener('click', () => painter.undo());
redoButton.addEventListener('click', () => painter.redo());
document.querySelector<HTMLButtonElement>('#clear-artwork')!.addEventListener('click', () => painter.clear());
const scenarioSelect = document.querySelector<HTMLSelectElement>('#scenario-select')!;
scenarioSelect.addEventListener('change', () => {
  const nextScenario = getScenario(scenarioSelect.value as typeof activeScenario.id);
  if (nextScenario.id === activeScenario.id) return;
  const hasArtwork = painter.getDocument().layers.some(layer => layer.marks.length > 0);
  if (hasArtwork && !window.confirm(`Change to the ${nextScenario.label.toLowerCase()} canvas? Your current artwork will be cleared.`)) {
    scenarioSelect.value = activeScenario.id;
    return;
  }

  activeScenario = nextScenario;
  document.querySelector<HTMLSpanElement>('#scenario-stamp')!.textContent = activeScenario.label.toUpperCase();
  const stage = document.querySelector<HTMLDivElement>('.paint-stage')!;
  const currentCanvas = stage.querySelector('canvas')!;
  stage.innerHTML = `${activeScenario.template()}`;
  stage.append(currentCanvas);
  stage.append(cursor);
  currentCanvas.setAttribute('aria-label', activeScenario.ariaLabel);
  const blank = createDefaultArtworkDocument();
  painter.setScenario(activeScenario, blank);
  renderLayers(painter.getDocument());
  const success = saveArtwork(blank, undefined, activeScenario);
  status.textContent = success
    ? `${activeScenario.label} canvas ready. Previous artwork cleared.`
    : `Ready to paint the ${activeScenario.label.toLowerCase()}, but the blank scene could not be saved.`;
  status.dataset.error = String(!success);
});
const customBrushPanel = document.querySelector<HTMLDivElement>('#custom-brush-panel')!;
const customBrushPreview = document.querySelector<HTMLCanvasElement>('#custom-brush-preview')!;
const customBrushPopupPreview = document.querySelector<HTMLCanvasElement>('#custom-brush-popup-preview')!;
const customTextureButton = document.querySelector<HTMLButtonElement>('[data-texture="custom"]')!;
const customTip = document.querySelector<HTMLSelectElement>('#custom-brush-tip')!;
const customAngle = document.querySelector<HTMLInputElement>('#custom-brush-angle')!;
const customAspect = document.querySelector<HTMLInputElement>('#custom-brush-aspect')!;
const customSoftness = document.querySelector<HTMLInputElement>('#custom-brush-softness')!;

function paintStampPreview(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  const brush = clampCustomBrush(tool.brush);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#fff4db';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = tool.erase ? '#171513' : tool.color;
  stampCustomBrush(context, canvas.width / 2, canvas.height / 2, fittedStampRadius(canvas.width, canvas.height, brush), 0.9, brush);
}

function paintCustomPreview(): void {
  paintStampPreview(customBrushPreview);
  paintStampPreview(customBrushPopupPreview);
}

function setCustomBrushOpen(open: boolean): void {
  customBrushPanel.hidden = !open;
  customTextureButton.setAttribute('aria-expanded', String(open));
}

function syncCustomBrushPanel(open?: boolean): void {
  const brush = clampCustomBrush(tool.brush);
  tool.brush = brush;
  customTip.value = brush.tip;
  customAngle.value = String(Math.round(brush.angle));
  customAspect.value = String(Math.round(brush.aspect * 100));
  customSoftness.value = String(Math.round(brush.softness * 100));
  document.querySelector<HTMLOutputElement>('#custom-angle-value')!.value = `${Math.round(brush.angle)}°`;
  document.querySelector<HTMLOutputElement>('#custom-aspect-value')!.value = brush.aspect.toFixed(2);
  document.querySelector<HTMLOutputElement>('#custom-softness-value')!.value = `${Math.round(brush.softness * 100)}%`;
  customAngle.setAttribute('aria-valuetext', `${Math.round(brush.angle)} degrees`);
  customAspect.setAttribute('aria-valuetext', brush.aspect.toFixed(2));
  customSoftness.setAttribute('aria-valuetext', `${Math.round(brush.softness * 100)} percent`);
  if (open !== undefined) setCustomBrushOpen(open);
  else if (tool.texture !== 'custom') setCustomBrushOpen(false);
  paintCustomPreview();
}

function commitCustomBrush(): void {
  tool.brush = clampCustomBrush({
    tip: customTip.value as BrushTip,
    angle: customAngle.valueAsNumber,
    aspect: customAspect.valueAsNumber / 100,
    softness: customSoftness.valueAsNumber / 100,
  });
  painter.setTool(tool);
  saveCustomBrush(tool.brush);
  syncCustomBrushPanel();
}

document.querySelectorAll<HTMLButtonElement>('[data-texture]').forEach(button => {
  button.addEventListener('click', () => {
    const texture = button.dataset.texture as TextureId;
    const alreadyCustom = tool.texture === 'custom' && texture === 'custom';
    tool.texture = texture;
    painter.setTool(tool);
    document.querySelectorAll('[data-texture]').forEach(chip => chip.setAttribute('aria-pressed', String(chip === button)));
    syncCustomBrushPanel(texture === 'custom' ? !alreadyCustom || customBrushPanel.hidden : false);
  });
});
customTip.addEventListener('change', () => commitCustomBrush());
customAngle.addEventListener('input', () => commitCustomBrush());
customAspect.addEventListener('input', () => commitCustomBrush());
customSoftness.addEventListener('input', () => commitCustomBrush());
document.addEventListener('pointerdown', event => {
  if (customBrushPanel.hidden) return;
  const target = event.target as Node | null;
  if (target && customTextureButton.parentElement?.contains(target)) return;
  setCustomBrushOpen(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !customBrushPanel.hidden) setCustomBrushOpen(false);
});
syncCustomBrushPanel(false);
const colorWheel = document.querySelector<HTMLButtonElement>('.color-wheel__surface')!;
const colorHandle = document.querySelector<HTMLSpanElement>('.color-wheel__handle')!;
const selectedColorHex = document.querySelector<HTMLParagraphElement>('#selected-color-hex')!;
const selectedColorRgba = document.querySelector<HTMLParagraphElement>('#selected-color-rgba')!;
const colorPresets = document.querySelectorAll<HTMLButtonElement>('[data-color-preset]');
const eraserButton = document.querySelector<HTMLButtonElement>('#eraser-tool')!;
const colorPicker = document.querySelector<HTMLButtonElement>('#color-picker')!;
let currentSelection = colorFromWheelPoint(1, 0);
let activePreset: string | null = null;
let pickingColor = false;

function setPickingColor(active: boolean): void {
  pickingColor = active;
  const stage = canvas.parentElement;
  if (stage) stage.dataset.picker = String(active);
  colorPicker.setAttribute('aria-pressed', String(active));
}

function syncColorReadout(): void {
  if (tool.erase) {
    selectedColorHex.textContent = 'eraser';
    selectedColorRgba.textContent = 'removes paint';
    return;
  }
  const readout = describePaintColor(tool.color, tool.opacity);
  selectedColorHex.textContent = readout.hex;
  selectedColorRgba.textContent = readout.rgba;
}

function syncColorPresets(): void {
  colorPresets.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.colorPreset === activePreset && !tool.erase)));
  eraserButton.setAttribute('aria-pressed', String(Boolean(tool.erase)));
}

function applyPaintColor(color: string): void {
  setPickingColor(false);
  tool.color = paintColorHex(color);
  tool.erase = false;
  painter.setTool(tool);
  colorWheel.style.setProperty('--selected-color', color);
  colorWheel.classList.toggle('color-wheel__surface--preset', Boolean(activePreset));
  colorHandle.hidden = Boolean(activePreset);
  syncColorReadout();
  syncColorPresets();
  colorWheel.setAttribute('aria-label', `Choose paint color from wheel. ${color} selected.`);
  paintCustomPreview();
}

function activateEraser(): void {
  activePreset = null;
  setPickingColor(false);
  tool.erase = true;
  painter.setTool(tool);
  colorWheel.classList.add('color-wheel__surface--preset');
  colorHandle.hidden = true;
  syncColorReadout();
  syncColorPresets();
  colorWheel.setAttribute('aria-label', 'Choose paint color from wheel. Eraser selected.');
  paintCustomPreview();
}

function updateSelectedColor(selection: WheelSelection): void {
  currentSelection = selection;
  activePreset = null;
  colorWheel.style.setProperty('--handle-x', `${(selection.x + 1) * 50}%`);
  colorWheel.style.setProperty('--handle-y', `${(selection.y + 1) * 50}%`);
  applyPaintColor(selection.color);
}

function selectionFromPointer(event: PointerEvent): WheelSelection {
  const rect = colorWheel.getBoundingClientRect();
  return colorFromWheelPoint(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    ((event.clientY - rect.top) / rect.height) * 2 - 1,
  );
}

colorWheel.addEventListener('pointerdown', event => {
  colorWheel.setPointerCapture(event.pointerId);
  colorWheel.dataset.dragging = 'true';
  updateSelectedColor(selectionFromPointer(event));
});
colorWheel.addEventListener('pointermove', event => {
  if (!colorWheel.hasPointerCapture(event.pointerId)) return;
  updateSelectedColor(selectionFromPointer(event));
});
colorWheel.addEventListener('pointerup', event => {
  if (colorWheel.hasPointerCapture(event.pointerId)) colorWheel.releasePointerCapture(event.pointerId);
  delete colorWheel.dataset.dragging;
});
colorWheel.addEventListener('pointercancel', event => {
  if (colorWheel.hasPointerCapture(event.pointerId)) colorWheel.releasePointerCapture(event.pointerId);
  delete colorWheel.dataset.dragging;
});
colorWheel.addEventListener('keydown', event => {
  const directionByKey: Partial<Record<string, WheelMoveDirection>> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
  };
  const direction = directionByKey[event.key];
  if (!direction) return;

  event.preventDefault();
  updateSelectedColor(moveWheelSelection(currentSelection, direction));
});
colorPresets.forEach(button => {
  button.addEventListener('click', () => {
    activePreset = button.dataset.colorPreset ?? null;
    if (!activePreset) return;
    applyPaintColor(activePreset);
  });
});
eraserButton.addEventListener('click', () => activateEraser());
colorPicker.addEventListener('click', () => setPickingColor(!pickingColor));
canvas.addEventListener('pointerdown', event => {
  if (!pickingColor || event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  const color = sampleCanvasColor(canvas, event.clientX, event.clientY);
  if (!color) return;
  activePreset = color === '#000000' || color === '#ffffff' ? color : null;
  applyPaintColor(color);
}, true);

function sampleCanvasColor(paintCanvas: HTMLCanvasElement, clientX: number, clientY: number): string | null {
  const bounds = paintCanvas.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  const u = (clientX - bounds.left) / bounds.width;
  const v = (clientY - bounds.top) / bounds.height;
  if (u < 0 || v < 0 || u > 1 || v > 1) return null;
  const paint = paintCanvas.getContext('2d')?.getImageData(
    Math.min(paintCanvas.width - 1, Math.max(0, Math.floor(u * paintCanvas.width))),
    Math.min(paintCanvas.height - 1, Math.max(0, Math.floor(v * paintCanvas.height))),
    1, 1,
  ).data;
  const photo = document.querySelector<HTMLImageElement>('.scene-photo');
  const background = photo ? samplePhotoPixel(photo, u, v) : null;
  if (!paint && !background) return null;
  const source = paint ?? new Uint8ClampedArray([0, 0, 0, 0]);
  const base = background ?? new Uint8ClampedArray([0, 0, 0, 0]);
  const alpha = source[3] / 255;
  if (alpha <= 0 && base[3] <= 0) return null;
  return formatHexColor({
    r: Math.round(source[0] * alpha + base[0] * (1 - alpha)),
    g: Math.round(source[1] * alpha + base[1] * (1 - alpha)),
    b: Math.round(source[2] * alpha + base[2] * (1 - alpha)),
  });
}

function samplePhotoPixel(photo: HTMLImageElement, u: number, v: number): Uint8ClampedArray | null {
  if (!photo.complete || photo.naturalWidth <= 0 || photo.naturalHeight <= 0) return null;
  const frame = photo.getBoundingClientRect();
  const scale = Math.max(frame.width / photo.naturalWidth, frame.height / photo.naturalHeight);
  const sourceX = Math.min(photo.naturalWidth - 1, Math.max(0, (u * frame.width + (photo.naturalWidth * scale - frame.width) / 2) / scale));
  const sourceY = Math.min(photo.naturalHeight - 1, Math.max(0, (v * frame.height + (photo.naturalHeight * scale - frame.height) / 2) / scale));
  const sample = document.createElement('canvas');
  sample.width = 1;
  sample.height = 1;
  const context = sample.getContext('2d');
  if (!context) return null;
  context.drawImage(photo, sourceX, sourceY, 1, 1, 0, 0, 1, 1);
  return context.getImageData(0, 0, 1, 1).data;
}
updateSelectedColor(currentSelection);
document.querySelector<HTMLInputElement>('#brush-size')!.addEventListener('input', event => {
  const value = (event.target as HTMLInputElement).valueAsNumber;
  tool.brushSize = value / 1000;
  painter.setTool(tool);
  document.querySelector<HTMLOutputElement>('#size-value')!.value = String(value);
  (event.target as HTMLInputElement).setAttribute('aria-valuetext', `${value} train units`);
});
document.querySelector<HTMLInputElement>('#brush-opacity')!.addEventListener('input', event => {
  const value = (event.target as HTMLInputElement).valueAsNumber;
  tool.opacity = value / 100;
  painter.setTool(tool);
  syncColorReadout();
  document.querySelector<HTMLOutputElement>('#opacity-value')!.value = `${value}%`;
  (event.target as HTMLInputElement).setAttribute('aria-valuetext', `${value} percent`);
});
document.querySelector<HTMLInputElement>('#brush-weight')!.addEventListener('input', event => {
  const value = (event.target as HTMLInputElement).valueAsNumber / 100;
  tool.weight = value;
  painter.setTool(tool);
  document.querySelector<HTMLOutputElement>('#weight-value')!.value = `${value.toFixed(1)}x`;
  (event.target as HTMLInputElement).setAttribute('aria-valuetext', `${value.toFixed(1)} times pressure`);
});
document.querySelector<HTMLInputElement>('#brush-drip')!.addEventListener('input', event => {
  const value = (event.target as HTMLInputElement).valueAsNumber;
  tool.drip = value / 100;
  painter.setTool(tool);
  document.querySelector<HTMLOutputElement>('#drip-value')!.value = `${value}%`;
  (event.target as HTMLInputElement).setAttribute('aria-valuetext', `${value} percent`);
});
const storedGallery = loadGallery();
let entries = (storedGallery.entries ?? []).filter(entry => entry.source !== 'seed');
const galleryStatus = document.querySelector<HTMLParagraphElement>('#gallery-status')!;
const exportStatus = document.querySelector<HTMLParagraphElement>('#export-status')!;
const ranking = document.querySelector<HTMLOListElement>('#gallery-ranking')!;
const rankingPrev = document.querySelector<HTMLButtonElement>('#ranking-prev')!;
const rankingNext = document.querySelector<HTMLButtonElement>('#ranking-next')!;
const rankingPageStatus = document.querySelector<HTMLSpanElement>('#ranking-page-status')!;
galleryStatus.textContent = '';
galleryStatus.dataset.error = String(storedGallery.status === 'invalid' || storedGallery.status === 'unavailable');

function persistGallery(message: string): void {
  const success = saveGallery(entries);
  galleryStatus.textContent = `${message} ${success ? 'Saved in this browser only.' : 'Could not save; changes may be lost on reload.'}`;
  galleryStatus.dataset.error = String(!success);
}

function renderGallery(): void {
  const rankedPage = paginateGallery(rankGallery(entries), rankingPage, rankingPageSize);
  rankingPage = rankedPage.page;
  ranking.replaceChildren(...rankedPage.items.map(entry => {
    const item = document.createElement('li');
    item.className = 'ranking-card';
    const image = document.createElement('img');
    image.src = entry.imageDataUrl;
    image.alt = `${entry.title} thumbnail`;
    image.width = 1000;
    image.height = 400;
    const title = document.createElement('h3');
    title.textContent = entry.title;
    const votes = document.createElement('p');
    votes.textContent = `${entry.votes} votes / ${entry.source === 'seed' ? 'example' : 'local'}`;
    const zoom = document.createElement('button');
    zoom.type = 'button';
    zoom.textContent = 'Zoom artwork';
    zoom.setAttribute('aria-label', `Zoom ${entry.title}`);
    zoom.addEventListener('click', () => openArtworkDialog(entry, zoom));
    const vote = document.createElement('button');
    vote.type = 'button';
    vote.dataset.vote = entry.id;
    vote.textContent = `Upvote (${entry.votes})`;
    vote.setAttribute('aria-label', `Upvote ${entry.title}, ${entry.votes} votes`);
    vote.addEventListener('click', () => {
      entries = upvote(entries, entry.id);
      persistGallery(`Upvoted ${entry.title}.`);
      renderGallery();
      document.querySelector<HTMLButtonElement>(`#gallery-ranking [data-vote="${entry.id}"]`)?.focus();
    });
    item.append(image, title, votes, zoom, vote);
    return item;
  }));
  rankingPrev.disabled = rankingPage === 0;
  rankingNext.disabled = rankingPage >= rankedPage.totalPages - 1;
  rankingPageStatus.textContent = `Page ${rankingPage + 1} of ${rankedPage.totalPages}`;
}

rankingPrev.addEventListener('click', () => {
  rankingPage = Math.max(0, rankingPage - 1);
  renderGallery();
});
rankingNext.addEventListener('click', () => {
  rankingPage += 1;
  renderGallery();
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]!);
}

function openArtworkDialog(entry: GalleryEntry, opener: HTMLElement): void {
  const dialog = document.querySelector<HTMLDialogElement>('#artwork-dialog')!;
  const title = escapeHtml(entry.title);
  dialog.innerHTML = `<form method="dialog" class="dialog-card lightbox"><h2 id="artwork-dialog-title">${title}</h2><img src="${entry.imageDataUrl}" alt="${title} enlarged artwork" width="1000" height="400" /><p>${entry.votes} votes / ${entry.source === 'seed' ? 'example' : 'local submission'}</p><button value="close">Close artwork</button></form>`;
  openDialog(dialog, opener);
}

renderGallery();
const publish = document.querySelector<HTMLButtonElement>('#publish-artwork')!;
const download = document.querySelector<HTMLButtonElement>('#download-artwork')!;
const share = document.querySelector<HTMLButtonElement>('#share-artwork')!;

function exportMessage(outcome: ExportOutcome): string {
  if (outcome.status === 'downloaded') return `${outcome.filename} downloaded. Nothing was uploaded.`;
  if (outcome.status === 'shared') return `${outcome.filename} handed to your browser's share sheet. YARD cannot confirm it was posted.`;
  if (outcome.status === 'cancelled') return `Share cancelled. ${outcome.filename} was not posted by YARD.`;
  if (outcome.status === 'unsupported') return `This browser cannot share image files from YARD. Use Download PNG instead.`;
  return `Could not export the scene snapshot: ${outcome.message}`;
}

async function exportCurrentTrain(action: ExportAction): Promise<void> {
  download.disabled = true;
  share.disabled = true;
  download.setAttribute('aria-busy', 'true');
  share.setAttribute('aria-busy', 'true');
  exportStatus.dataset.error = 'false';
  exportStatus.textContent = `Preparing your ${activeScenario.label.toLowerCase()} snapshot...`;
  try {
    const image = await painter.createSnapshot();
    const outcome = await exportTrainImage(image, action);
    exportStatus.textContent = exportMessage(outcome);
    exportStatus.dataset.error = String(outcome.status === 'failed');
  } catch {
    exportStatus.textContent = `Could not create the ${activeScenario.label.toLowerCase()} snapshot. Nothing was downloaded or shared; please try again.`;
    exportStatus.dataset.error = 'true';
  } finally {
    download.disabled = false;
    share.disabled = false;
    download.removeAttribute('aria-busy');
    share.removeAttribute('aria-busy');
  }
}

download.addEventListener('click', () => { void exportCurrentTrain('download'); });
share.addEventListener('click', () => { void exportCurrentTrain('share'); });
publish.addEventListener('click', async () => {
  publish.disabled = true;
  publish.setAttribute('aria-busy', 'true');
  galleryStatus.dataset.error = 'false';
  galleryStatus.textContent = `Preparing your ${activeScenario.label.toLowerCase()} snapshot...`;
  try {
    const image = await painter.createSnapshot();
    entries = publishArtwork(entries, image, undefined, undefined, document.querySelector<HTMLInputElement>('#artwork-title')!.value);
    document.querySelector<HTMLInputElement>('#artwork-title')!.value = '';
    renderGallery();
    persistGallery(`${activeScenario.label} added to the mock display.`);
  } catch {
    galleryStatus.textContent = `Could not create the ${activeScenario.label.toLowerCase()} snapshot. Nothing was published; please try again.`;
    galleryStatus.dataset.error = 'true';
  } finally {
    publish.disabled = false;
    publish.removeAttribute('aria-busy');
  }
});
if (import.meta.hot) import.meta.hot.dispose(() => painter.destroy());
