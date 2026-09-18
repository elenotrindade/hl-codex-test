import './styles.css';
import { trainTemplate } from './train-template';
import { TrainPainter, TEXTURES, type TextureId, type ToolState } from './train-painter';
import { loadArtwork, saveArtwork, loadGallery, saveGallery } from './storage';
import { seededGallery, publishArtwork, upvote, rankGallery } from './gallery';

const colors = [
  ['Signal red', '#e2483d'], ['Amber', '#f1aa2d'], ['Chalk', '#fff4db'],
  ['Ink', '#171513'], ['Electric blue', '#2588ed'], ['Mint', '#72d6ae'],
] as const;
const tool: ToolState = { color: colors[0][1], texture: 'solid', brushSize: 0.025 };
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <a class="skip-link" href="#workshop">Skip to the workshop</a>
  <main>
    <header><p class="eyebrow">YARD / OPEN CANVAS / NO. 001</p>
      <h1>Leave your <em>mark.</em></h1>
      <p>One train. Your colors. Pick a shade and drag across the blue body panels.</p>
    </header>
    <section id="workshop" class="workshop" aria-label="Train painting workshop" tabindex="-1">
      <div class="stage-panel">
        <div class="stage-heading"><h2>01 / Make it yours</h2><span>CAR 001</span></div>
        <div class="train-stage">${trainTemplate()}<canvas aria-label="Graffiti painting surface" aria-describedby="paint-help">Canvas support is required to paint.</canvas></div>
        <p id="paint-help">Drag with a mouse, pen, or finger. Windows and wheels stay clean. Painting requires pointer input; use Tab to reach tools and display controls.</p>
        <p class="stage-stamp" aria-hidden="true">YOUR CITY. YOUR COLORS.</p>
      </div>
      <aside class="tools" aria-label="Painting tools">
        <h2>02 / Pick your paint</h2>
        <div class="swatches" role="group" aria-label="Paint color">
          ${colors.map(([name, color], i) => `<button type="button" class="swatch" style="--swatch:${color}" data-color="${color}" aria-label="${name}" aria-pressed="${i === 0}" title="${name}"></button>`).join('')}
        </div>
        <label for="brush-size">Brush size <output id="size-value" for="brush-size">25</output></label>
        <input id="brush-size" type="range" min="6" max="60" value="25" aria-valuetext="25 train units" />
        <div class="textures" role="group" aria-label="Paint texture">
          ${TEXTURES.map(texture => `<button type="button" data-texture="${texture}" aria-pressed="${texture === 'solid'}">${texture}</button>`).join('')}
        </div>
        <button type="button" id="clear-artwork" aria-describedby="clear-help">Clear artwork</button>
        <p id="clear-help" class="tool-note">Clear removes all paint. There is no undo.</p>
        <p id="save-status" role="status" aria-live="polite"></p>
      </aside>
    <section class="display-panel" aria-labelledby="display-heading">
      <h2 id="display-heading">03 / On display</h2>
      <p>A mock public feed. Submissions and votes stay in this browser only. Nothing is uploaded.</p>
      <button type="button" id="publish-artwork">Put on display</button>
      <p id="gallery-status" role="status" aria-live="polite"></p>
      <div id="gallery-feed" class="gallery-feed"></div>
      <p id="share-status" role="status" aria-live="polite"></p>
    </section>
    </section>
    <section class="ranking-panel" aria-labelledby="ranking-heading">
      <h2 id="ranking-heading" class="ranking-heading">Yard ranking / Most upvoted</h2>
      <p>Demo voting: vote as often as you like. Ties use entry ID order.</p>
      <ol id="gallery-ranking"></ol>
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
status.dataset.error = String(saved.status === 'invalid' || saved.status === 'unavailable');
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
  (event.target as HTMLInputElement).setAttribute('aria-valuetext', `${value} train units`);
});
const storedGallery = loadGallery();
let entries = storedGallery.entries ?? seededGallery();
const galleryStatus = document.querySelector<HTMLParagraphElement>('#gallery-status')!;
const shareStatus = document.querySelector<HTMLParagraphElement>('#share-status')!;
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
  feed.replaceChildren(...entries.map(entry => {
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
      const index = entries.findIndex(item => item.id === entry.id);
      feed.children[index]?.querySelector('button')?.focus();
    });
    const share = document.createElement('button');
    share.type = 'button';
    share.textContent = 'Mock social share';
    share.setAttribute('aria-label', `Mock social share for ${entry.title}`);
    share.addEventListener('click', () => {
      shareStatus.textContent = `Demo only: ${entry.title} was not shared. No social platform was contacted.`;
    });
    card.append(image, title, source, vote, share);
    return card;
  }));
  ranking.replaceChildren(...rankGallery(entries).map(entry => {
    const item = document.createElement('li');
    item.textContent = `${entry.title} / ${entry.votes} votes / ${entry.source === 'seed' ? 'example' : 'local'}`;
    return item;
  }));
}

renderGallery();
const publish = document.querySelector<HTMLButtonElement>('#publish-artwork')!;
publish.addEventListener('click', async () => {
  publish.disabled = true;
  publish.setAttribute('aria-busy', 'true');
  galleryStatus.dataset.error = 'false';
  galleryStatus.textContent = 'Preparing your train snapshot...';
  try {
    const image = await painter.createSnapshot();
    entries = publishArtwork(entries, image);
    renderGallery();
    persistGallery('Train added to the mock display.');
  } catch {
    galleryStatus.textContent = 'Could not create the train snapshot. Nothing was published; please try again.';
    galleryStatus.dataset.error = 'true';
  } finally {
    publish.disabled = false;
    publish.removeAttribute('aria-busy');
  }
});
if (import.meta.hot) import.meta.hot.dispose(() => painter.destroy());
