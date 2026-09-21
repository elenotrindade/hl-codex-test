import './styles.css';
import { TrainPainter, TEXTURES, type TextureId, type ToolState } from './train-painter';
import { loadArtwork, saveArtwork, loadGallery, saveGallery } from './storage';
import { DEFAULT_COLOR, colorFromWheelPoint, moveWheelSelection, type WheelMoveDirection, type WheelSelection } from './paint-tools';
import { seededGallery, publishArtwork, upvote, rankGallery, getRecentGallery, type GalleryEntry } from './gallery';
import { getScenario, scenarios, type PaintScenario } from './scenarios';
import { openDialog } from './dialogs';
import { exportTrainImage, type ExportAction, type ExportOutcome } from './artwork-export';

const tool: ToolState = { color: DEFAULT_COLOR, texture: 'solid', brushSize: 0.025, opacity: 0.9, weight: 1 };
let activeScenario: PaintScenario = getScenario('train');
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <a class="skip-link" href="#workshop">Skip to the workshop</a>
  <main>
    <div class="yard-strip">
      <span>YARD / OPEN CANVAS / NO. 001</span>
      <label for="scenario-select">Canvas
        <select id="scenario-select" aria-describedby="scenario-select-help">
          ${scenarios.map(scenario => `<option value="${scenario.id}"${scenario.id === activeScenario.id ? ' selected' : ''}>${scenario.label}</option>`).join('')}
        </select>
      </label>
      <span id="scenario-select-help">Changing canvas clears the current artwork after confirmation.</span>
    </div>
    <header>
      <h1>Leave your <em>mark.</em></h1>
      <p>Pick a real street surface. Dial in a fresh paint mix, then drag directly over the photo-lit panel.</p>
    </header>
    <section id="workshop" class="workshop" aria-label="Street painting workshop" tabindex="-1">
      <div class="stage-panel">
        <div class="stage-heading"><h2>01 / Make it yours</h2><span id="scenario-stamp">TRAIN</span></div>
        <div class="paint-stage" aria-live="polite">${activeScenario.template()}<canvas aria-label="${activeScenario.ariaLabel}" aria-describedby="paint-help">Canvas support is required to paint.</canvas><div class="brush-cursor" aria-hidden="true"></div></div>
        <p id="paint-help">Drag with a mouse, pen, or finger. Paint stays inside the active street surface.</p>
        <p class="stage-stamp" aria-hidden="true">YOUR CITY. YOUR COLORS.</p>
      </div>
      <aside class="tools" aria-label="Painting tools">
        <h2>02 / Pick your paint</h2>
        <div class="color-wheel" role="group" aria-labelledby="color-wheel-label" aria-describedby="color-wheel-help">
          <p id="color-wheel-label" class="tool-label">Color mixer</p>
          <button type="button" class="color-wheel__surface" aria-label="Choose paint color from wheel" aria-describedby="color-wheel-help">
            <span class="color-wheel__handle" aria-hidden="true"></span>
          </button>
          <div class="selected-color">
            <span class="selected-color__chip" aria-hidden="true"></span>
            <span id="selected-color-text">Selected color ${DEFAULT_COLOR}</span>
          </div>
          <p id="color-wheel-help" class="tool-note">Drag the wheel or use arrow keys to tune the paint.</p>
        </div>
        <label for="brush-size">Brush size <output id="size-value" for="brush-size">25</output></label>
        <input id="brush-size" type="range" min="6" max="60" value="25" aria-valuetext="25 train units" />
        <label for="brush-opacity">Opacity <output id="opacity-value" for="brush-opacity">90%</output></label>
        <input id="brush-opacity" type="range" min="5" max="100" value="90" aria-valuetext="90 percent" />
        <label for="brush-weight">Brush weight <output id="weight-value" for="brush-weight">1.0x</output></label>
        <input id="brush-weight" type="range" min="50" max="200" value="100" aria-valuetext="1.0 times pressure" />
        <div class="textures" role="group" aria-label="Paint texture">
          ${TEXTURES.map(texture => `<button type="button" data-texture="${texture}" aria-pressed="${texture === 'solid'}">${texture}</button>`).join('')}
        </div>
        <div class="history-actions" role="group" aria-label="Stroke history">
          <button type="button" id="undo-stroke" disabled aria-disabled="true">Undo stroke</button>
          <button type="button" id="redo-stroke" disabled aria-disabled="true">Redo stroke</button>
        </div>
        <button type="button" id="clear-artwork" aria-describedby="clear-help">Clear artwork</button>
        <p id="clear-help" class="tool-note">Undo and redo work by complete stroke. Clear removes all paint.</p>
        <p id="save-status" role="status" aria-live="polite"></p>
      </aside>
    <section class="display-panel" aria-labelledby="display-heading">
      <h2 id="display-heading">03 / On display</h2>
      <p>A local display rack. Submissions and votes stay in this browser only. Nothing is uploaded.</p>
      <label for="artwork-title">Artwork name <span>optional</span></label>
      <input id="artwork-title" type="text" maxlength="80" placeholder="Midnight layup" autocomplete="off" />
      <button type="button" id="publish-artwork">Put on display</button>
      <p id="gallery-status" role="status" aria-live="polite"></p>
      <div class="export-actions" aria-labelledby="export-heading">
        <h3 id="export-heading">Save or share your current scene</h3>
        <p>Download a PNG, or use your browser's share sheet where file sharing is supported.</p>
        <button type="button" id="download-artwork">Download PNG</button>
        <button type="button" id="share-artwork">Share image</button>
        <p id="export-status" role="status" aria-live="polite"></p>
      </div>
      <div id="gallery-feed" class="gallery-feed"></div>
    </section>
    </section>
    <section class="ranking-panel" aria-labelledby="ranking-heading">
      <h2 id="ranking-heading" class="ranking-heading">Yard ranking / Most upvoted</h2>
      <p>Demo voting: vote as often as you like. Ties use entry ID order.</p>
      <ol id="gallery-ranking"></ol>
    </section>
    <dialog id="share-dialog" aria-labelledby="share-dialog-title"></dialog>
    <dialog id="artwork-dialog" aria-labelledby="artwork-dialog-title"></dialog>
    <footer>Saved automatically after each stroke, in this browser only.</footer>
  </main>`;

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
const cursor = document.querySelector<HTMLDivElement>('.brush-cursor')!;
const undoButton = document.querySelector<HTMLButtonElement>('#undo-stroke')!;
const redoButton = document.querySelector<HTMLButtonElement>('#redo-stroke')!;
const saved = loadArtwork(undefined, activeScenario);
const status = document.querySelector<HTMLParagraphElement>('#save-status')!;
status.textContent = {
  loaded: 'Latest artwork restored.', missing: 'Ready for your first mark.',
  invalid: 'Saved artwork could not be read. Starting with an empty scene.',
  unavailable: 'Local storage unavailable. Paint may be lost on reload.',
}[saved.status];
status.dataset.error = String(saved.status === 'invalid' || saved.status === 'unavailable');
function updateHistoryControls(state: { canUndo: boolean; canRedo: boolean }): void {
  undoButton.disabled = !state.canUndo;
  redoButton.disabled = !state.canRedo;
  undoButton.setAttribute('aria-disabled', String(!state.canUndo));
  redoButton.setAttribute('aria-disabled', String(!state.canRedo));
}
const painter = new TrainPainter(canvas, tool, marks => {
  const success = saveArtwork({ marks, updatedAt: new Date().toISOString() }, undefined, activeScenario);
  status.textContent = success
    ? (marks.length ? `${activeScenario.label} artwork saved in this browser.` : `Empty ${activeScenario.label.toLowerCase()} scene saved in this browser.`)
    : 'Could not save. Changes may be lost on reload.';
  status.dataset.error = String(!success);
}, saved.snapshot?.marks ?? [], activeScenario, state => {
  const stage = cursor.parentElement!;
  stage.dataset.cursor = String(state.visible ? 'active' : 'idle');
  cursor.style.setProperty('--cursor-x', `${state.x * 100}%`);
  cursor.style.setProperty('--cursor-y', `${state.y * 100}%`);
  cursor.style.setProperty('--cursor-size', `${state.size * activeScenario.width}px`);
  cursor.style.setProperty('--cursor-color', state.color);
  cursor.style.setProperty('--cursor-opacity', String(state.opacity));
}, updateHistoryControls);
undoButton.addEventListener('click', () => painter.undo());
redoButton.addEventListener('click', () => painter.redo());
document.querySelector<HTMLButtonElement>('#clear-artwork')!.addEventListener('click', () => painter.clear());
const scenarioSelect = document.querySelector<HTMLSelectElement>('#scenario-select')!;
scenarioSelect.addEventListener('change', () => {
  const nextScenario = getScenario(scenarioSelect.value as typeof activeScenario.id);
  if (nextScenario.id === activeScenario.id) return;

  if (painter.getMarks().length && !window.confirm(`Change to the ${nextScenario.label.toLowerCase()} canvas? Your current artwork will be cleared.`)) {
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
  painter.setScenario(activeScenario, []);
  const success = saveArtwork({ marks: [], updatedAt: new Date().toISOString() }, undefined, activeScenario);
  status.textContent = success
    ? `${activeScenario.label} canvas ready. Previous artwork cleared.`
    : `Ready to paint the ${activeScenario.label.toLowerCase()}, but the blank scene could not be saved.`;
  status.dataset.error = String(!success);
});
document.querySelectorAll<HTMLButtonElement>('[data-texture]').forEach(button => {
  button.addEventListener('click', () => {
    tool.texture = button.dataset.texture as TextureId;
    painter.setTool(tool);
    document.querySelectorAll('[data-texture]').forEach(chip => chip.setAttribute('aria-pressed', String(chip === button)));
  });
});
const colorWheel = document.querySelector<HTMLButtonElement>('.color-wheel__surface')!;
const colorHandle = document.querySelector<HTMLSpanElement>('.color-wheel__handle')!;
const colorChip = document.querySelector<HTMLSpanElement>('.selected-color__chip')!;
const selectedColorText = document.querySelector<HTMLSpanElement>('#selected-color-text')!;
let currentSelection = colorFromWheelPoint(1, 0);

function updateSelectedColor(selection: WheelSelection): void {
  currentSelection = selection;
  tool.color = selection.color;
  painter.setTool(tool);
  colorWheel.style.setProperty('--selected-color', selection.color);
  colorWheel.style.setProperty('--handle-x', `${(selection.x + 1) * 50}%`);
  colorWheel.style.setProperty('--handle-y', `${(selection.y + 1) * 50}%`);
  colorChip.style.background = selection.color;
  selectedColorText.textContent = `Selected color ${selection.color}`;
  colorWheel.setAttribute('aria-label', `Choose paint color from wheel. ${selection.color} selected.`);
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
const storedGallery = loadGallery();
let entries = storedGallery.entries ?? seededGallery();
const galleryStatus = document.querySelector<HTMLParagraphElement>('#gallery-status')!;
const exportStatus = document.querySelector<HTMLParagraphElement>('#export-status')!;
const feed = document.querySelector<HTMLDivElement>('#gallery-feed')!;
const ranking = document.querySelector<HTMLOListElement>('#gallery-ranking')!;
galleryStatus.textContent = {
  loaded: 'Local display and votes restored.', missing: 'Built-in examples are ready. Add your train.',
  invalid: 'Saved display could not be read. Showing built-in examples.',
  unavailable: 'Local storage unavailable. Display changes will last only for this session.',
}[storedGallery.status];
galleryStatus.dataset.error = String(storedGallery.status === 'invalid' || storedGallery.status === 'unavailable');

function persistGallery(message: string): void {
  const success = saveGallery(entries);
  galleryStatus.textContent = `${message} ${success ? 'Saved in this browser only.' : 'Could not save; changes may be lost on reload.'}`;
  galleryStatus.dataset.error = String(!success);
}

function renderGallery(): void {
  feed.replaceChildren(...getRecentGallery(entries, 3).map(entry => {
    const card = document.createElement('article');
    card.className = 'gallery-card';
    const image = document.createElement('img');
    image.src = entry.imageDataUrl;
    image.alt = `${entry.title} - painted train`;
    image.width = 1000;
    image.height = 400;
    const title = document.createElement('h3');
    title.textContent = entry.title;
    const source = document.createElement('p');
    source.textContent = entry.source === 'seed' ? 'Built-in example / mock public' : 'Your submission / this browser only';
    const vote = document.createElement('button');
    vote.type = 'button';
    vote.textContent = `Upvote (${entry.votes})`;
    vote.setAttribute('aria-label', `Upvote ${entry.title}, ${entry.votes} votes`);
    vote.addEventListener('click', () => {
      entries = upvote(entries, entry.id);
      persistGallery(`Upvoted ${entry.title}.`);
      renderGallery();
      document.querySelector<HTMLButtonElement>(`[data-vote="${entry.id}"]`)?.focus();
    });
    card.append(image, title, source, vote);
    return card;
  }));
  ranking.replaceChildren(...rankGallery(entries).map(entry => {
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
      document.querySelector<HTMLButtonElement>(`[data-vote="${entry.id}"]`)?.focus();
    });
    item.append(image, title, votes, zoom, vote);
    return item;
  }));
}

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
