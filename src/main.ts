import './styles.css';
import { TrainPainter, TEXTURES, type TextureId, type ToolState } from './train-painter';
import { loadArtwork, saveArtwork, loadGallery, saveGallery } from './storage';
import { seededGallery, publishArtwork, upvote, rankGallery, getRecentGallery, type GalleryEntry } from './gallery';
import { getScenario, scenarios, type PaintScenario } from './scenarios';
import { formatHexColor, hsvToRgb, parseHexColor, rgbToHsv, type HsvColor, type RgbColor } from './color-tools';
import { openDialog } from './dialogs';
import { exportTrainImage, type ExportAction, type ExportOutcome } from './artwork-export';
import { mountSponsor, sponsorConfig } from './sponsorship';

const colors = [
  ['Signal red', '#e2483d'], ['Amber', '#f1aa2d'], ['Chalk', '#fff4db'],
  ['Ink', '#171513'], ['Electric blue', '#2588ed'], ['Mint', '#72d6ae'],
] as const;
const tool: ToolState = { color: colors[0][1], texture: 'solid', brushSize: 0.025, opacity: 0.9, weight: 1 };
let hsv: HsvColor = rgbToHsv(parseHexColor(tool.color)!);
let activeScenario: PaintScenario = getScenario('train');
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <a class="skip-link" href="#workshop">Skip to the workshop</a>
  <main>
    <div class="yard-strip">YARD / OPEN CANVAS / NO. 001</div>
    <header>
      <h1>Leave your <em>mark.</em></h1>
    </header>
    <section id="workshop" class="workshop" aria-label="Street painting workshop" tabindex="-1">
      <div class="stage-panel">
        <div class="stage-heading"><h2>01 / Make it yours</h2><span id="scenario-stamp">TRAIN</span></div>
        <div class="scenario-tabs" role="group" aria-label="Street scenario">
          ${scenarios.map(scenario => `<button type="button" data-scenario="${scenario.id}" aria-pressed="${scenario.id === activeScenario.id}">${scenario.label}</button>`).join('')}
        </div>
        <div class="paint-stage" aria-live="polite">${activeScenario.template()}<canvas aria-label="${activeScenario.ariaLabel}" aria-describedby="paint-help">Canvas support is required to paint.</canvas><div class="brush-cursor" aria-hidden="true"></div></div>
        <p id="paint-help">Drag with a mouse, pen, or finger. Paint stays inside the active street surface.</p>
        <p class="stage-stamp" aria-hidden="true">YOUR CITY. YOUR COLORS.</p>
      </div>
      <aside class="tools" aria-label="Painting tools">
        <h2>02 / Pick your paint</h2>
        <div class="color-picker" aria-label="Custom paint color">
          <div class="selected-color" style="--selected:${tool.color}; --selected-alpha:${tool.opacity}"><span>Selected paint</span><strong id="color-readout">${tool.color}</strong></div>
          <label for="hue-control">Hue <output id="hue-value" for="hue-control">${hsv.h}</output></label>
          <input id="hue-control" type="range" min="0" max="360" value="${hsv.h}" aria-valuetext="${hsv.h} degrees" />
          <label for="saturation-control">Saturation <output id="saturation-value" for="saturation-control">${hsv.s}</output></label>
          <input id="saturation-control" type="range" min="0" max="100" value="${hsv.s}" aria-valuetext="${hsv.s} percent" />
          <label for="value-control">Value <output id="value-value" for="value-control">${hsv.v}</output></label>
          <input id="value-control" type="range" min="0" max="100" value="${hsv.v}" aria-valuetext="${hsv.v} percent" />
          <label for="hex-color">HEX</label><input id="hex-color" type="text" value="${tool.color}" maxlength="7" spellcheck="false" />
          <div class="rgb-fields"><label for="red-value">R <input id="red-value" type="number" min="0" max="255" value="${parseHexColor(tool.color)!.r}" /></label><label for="green-value">G <input id="green-value" type="number" min="0" max="255" value="${parseHexColor(tool.color)!.g}" /></label><label for="blue-value">B <input id="blue-value" type="number" min="0" max="255" value="${parseHexColor(tool.color)!.b}" /></label></div>
        </div>
        <div class="swatches" role="group" aria-label="Paint color">
          ${colors.map(([name, color], i) => `<button type="button" class="swatch" style="--swatch:${color}" data-color="${color}" aria-label="${name}" aria-pressed="${i === 0}" title="${name}"></button>`).join('')}
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
        <h3 id="export-heading">Save or share your current train</h3>
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
document.querySelectorAll<HTMLButtonElement>('[data-scenario]').forEach(button => {
  button.addEventListener('click', () => {
    activeScenario = getScenario(button.dataset.scenario as typeof activeScenario.id);
    document.querySelectorAll<HTMLButtonElement>('[data-scenario]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
    document.querySelector<HTMLSpanElement>('#scenario-stamp')!.textContent = activeScenario.label.toUpperCase();
    const stage = document.querySelector<HTMLDivElement>('.paint-stage')!;
    const currentCanvas = stage.querySelector('canvas')!;
    stage.innerHTML = `${activeScenario.template()}`;
    stage.append(currentCanvas);
    stage.append(cursor);
    currentCanvas.setAttribute('aria-label', activeScenario.ariaLabel);
    const scenarioSaved = loadArtwork(undefined, activeScenario);
    painter.setScenario(activeScenario, scenarioSaved.snapshot?.marks ?? []);
    status.textContent = scenarioSaved.status === 'loaded'
      ? `${activeScenario.label} artwork restored.`
      : `Ready to paint the ${activeScenario.label.toLowerCase()}.`;
    status.dataset.error = 'false';
  });
});
document.querySelectorAll<HTMLButtonElement>('[data-texture]').forEach(button => {
  button.addEventListener('click', () => {
    tool.texture = button.dataset.texture as TextureId;
    painter.setTool(tool);
    document.querySelectorAll('[data-texture]').forEach(chip => chip.setAttribute('aria-pressed', String(chip === button)));
  });
});
function applyColor(rgb: RgbColor, updateHsv = true): void {
  const color = formatHexColor(rgb);
  tool.color = color;
  if (updateHsv) hsv = rgbToHsv(rgb);
  painter.setTool(tool);
  document.querySelector<HTMLDivElement>('.selected-color')!.style.setProperty('--selected', color);
  document.querySelector<HTMLElement>('#color-readout')!.textContent = color;
  document.querySelector<HTMLInputElement>('#hex-color')!.value = color;
  const parsed = parseHexColor(color)!;
  document.querySelector<HTMLInputElement>('#red-value')!.value = String(parsed.r);
  document.querySelector<HTMLInputElement>('#green-value')!.value = String(parsed.g);
  document.querySelector<HTMLInputElement>('#blue-value')!.value = String(parsed.b);
  document.querySelector<HTMLInputElement>('#hue-control')!.value = String(hsv.h);
  document.querySelector<HTMLInputElement>('#saturation-control')!.value = String(hsv.s);
  document.querySelector<HTMLInputElement>('#value-control')!.value = String(hsv.v);
  document.querySelector<HTMLOutputElement>('#hue-value')!.value = String(hsv.h);
  document.querySelector<HTMLOutputElement>('#saturation-value')!.value = String(hsv.s);
  document.querySelector<HTMLOutputElement>('#value-value')!.value = String(hsv.v);
  document.querySelectorAll('[data-color]').forEach(swatch => swatch.setAttribute('aria-pressed', String((swatch as HTMLButtonElement).dataset.color === color)));
}
(['h', 's', 'v'] as const).forEach((channel, index) => {
  const ids = ['#hue-control', '#saturation-control', '#value-control'] as const;
  document.querySelector<HTMLInputElement>(ids[index])!.addEventListener('input', event => {
    hsv = { ...hsv, [channel]: (event.target as HTMLInputElement).valueAsNumber };
    applyColor(hsvToRgb(hsv), false);
  });
});
document.querySelector<HTMLInputElement>('#hex-color')!.addEventListener('change', event => {
  const rgb = parseHexColor((event.target as HTMLInputElement).value);
  if (rgb) applyColor(rgb);
});
document.querySelectorAll<HTMLInputElement>('#red-value, #green-value, #blue-value').forEach(input => input.addEventListener('change', () => {
  applyColor({ r: document.querySelector<HTMLInputElement>('#red-value')!.valueAsNumber, g: document.querySelector<HTMLInputElement>('#green-value')!.valueAsNumber, b: document.querySelector<HTMLInputElement>('#blue-value')!.valueAsNumber });
}));
document.querySelectorAll<HTMLButtonElement>('[data-color]').forEach(button => {
  button.addEventListener('click', () => {
    applyColor(parseHexColor(button.dataset.color!)!);
  });
});
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
  document.querySelector<HTMLDivElement>('.selected-color')!.style.setProperty('--selected-alpha', String(tool.opacity));
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
  return `Could not export the train snapshot: ${outcome.message}`;
}

async function exportCurrentTrain(action: ExportAction): Promise<void> {
  download.disabled = true;
  share.disabled = true;
  download.setAttribute('aria-busy', 'true');
  share.setAttribute('aria-busy', 'true');
  exportStatus.dataset.error = 'false';
  exportStatus.textContent = 'Preparing your train snapshot...';
  try {
    const image = await painter.createSnapshot();
    const outcome = await exportTrainImage(image, action);
    exportStatus.textContent = exportMessage(outcome);
    exportStatus.dataset.error = String(outcome.status === 'failed');
  } catch {
    exportStatus.textContent = 'Could not create the train snapshot. Nothing was downloaded or shared; please try again.';
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
mountSponsor(document.querySelector<HTMLElement>('footer'), sponsorConfig, document);
if (import.meta.hot) import.meta.hot.dispose(() => painter.destroy());
