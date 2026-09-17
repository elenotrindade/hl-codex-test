import './styles.css';
import { trainTemplate } from './train-template';
import { TrainPainter, TEXTURES, type TextureId, type ToolState } from './train-painter';
import { loadArtwork, saveArtwork } from './storage';

const colors = [
  ['Signal red', '#e2483d'], ['Amber', '#f1aa2d'], ['Chalk', '#fff4db'],
  ['Ink', '#171513'], ['Electric blue', '#2588ed'], ['Mint', '#72d6ae'],
] as const;
const tool: ToolState = { color: colors[0][1], texture: 'solid', brushSize: 0.025 };
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main>
    <header><p class="eyebrow">YARD / OPEN CANVAS / NO. 001</p>
      <h1>Leave your <em>mark.</em></h1>
      <p>One train. Your colors. Pick a shade and drag across the blue body panels.</p>
    </header>
    <section class="workshop" aria-label="Train painting workshop">
      <aside class="tools" aria-label="Painting tools">
        <h2>01 / Pick your paint</h2>
        <div class="swatches" role="group" aria-label="Paint color">
          ${colors.map(([name, color], i) => `<button type="button" class="swatch" style="--swatch:${color}" data-color="${color}" aria-label="${name}" aria-pressed="${i === 0}" title="${name}"></button>`).join('')}
        </div>
        <label for="brush-size">Brush size <output id="size-value" for="brush-size">25</output></label>
        <input id="brush-size" type="range" min="6" max="60" value="25" />
        <div class="textures" role="group" aria-label="Paint texture">
          ${TEXTURES.map(texture => `<button type="button" data-texture="${texture}" aria-pressed="${texture === 'solid'}">${texture}</button>`).join('')}
        </div>
        <button type="button" id="clear-artwork">Clear artwork</button>
        <p class="tool-note">Clear removes all paint. There is no undo.</p>
        <p id="save-status" role="status" aria-live="polite"></p>
      </aside>
      <div class="stage-panel">
        <div class="stage-heading"><h2>02 / Make it yours</h2><span>CAR 001</span></div>
        <div class="train-stage">${trainTemplate()}<canvas aria-label="Graffiti painting surface" aria-describedby="paint-help">Canvas support is required to paint.</canvas></div>
        <p id="paint-help">Drag with a mouse, pen, or finger. Windows and wheels stay clean.</p>
      </div>
    </section>
    <footer>Saved automatically after each stroke, in this browser only.</footer>
  </main>`;

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
const saved = loadArtwork();
const status = document.querySelector<HTMLParagraphElement>('#save-status')!;
status.textContent = {
  loaded: 'Latest artwork restored.', missing: 'Ready for your first mark.',
  invalid: 'Saved artwork could not be read. Starting with an empty train.',
  unavailable: 'Local storage unavailable. Paint may be lost on reload.',
}[saved.status];
const painter = new TrainPainter(canvas, tool, marks => {
  const success = saveArtwork({ marks, updatedAt: new Date().toISOString() });
  status.textContent = success
    ? (marks.length ? 'Artwork saved in this browser.' : 'Empty train saved in this browser.')
    : 'Could not save. Changes may be lost on reload.';
  status.dataset.error = String(!success);
}, saved.snapshot?.marks ?? []);
document.querySelector<HTMLButtonElement>('#clear-artwork')!.addEventListener('click', () => painter.clear());
document.querySelectorAll<HTMLButtonElement>('[data-texture]').forEach(button => {
  button.addEventListener('click', () => {
    tool.texture = button.dataset.texture as TextureId;
    painter.setTool(tool);
    document.querySelectorAll('[data-texture]').forEach(chip => chip.setAttribute('aria-pressed', String(chip === button)));
  });
});
document.querySelectorAll<HTMLButtonElement>('[data-color]').forEach(button => {
  button.addEventListener('click', () => {
    tool.color = button.dataset.color!;
    painter.setTool(tool);
    document.querySelectorAll('[data-color]').forEach(swatch => swatch.setAttribute('aria-pressed', String(swatch === button)));
  });
});
document.querySelector<HTMLInputElement>('#brush-size')!.addEventListener('input', event => {
  const value = (event.target as HTMLInputElement).valueAsNumber;
  tool.brushSize = value / 1000;
  painter.setTool(tool);
  document.querySelector<HTMLOutputElement>('#size-value')!.value = String(value);
});
if (import.meta.hot) import.meta.hot.dispose(() => painter.destroy());
