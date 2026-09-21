import { trainTemplate } from './train-template';

export type GalleryEntry = {
  id: string;
  title: string;
  imageDataUrl: string;
  createdAt: string;
  votes: number;
  source: 'seed' | 'local';
};

export function seededGallery(): GalleryEntry[] {
  return [['Signal waves', '#e2483d', 8], ['Mint express', '#72d6ae', 5]].map(([title, color, votes], index) => ({
    id: `seed-${index + 1}`, title: String(title), votes: Number(votes), source: 'seed',
    createdAt: '2026-09-17T00:00:00.000Z',
    imageDataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trainTemplate().replace('</svg>',
      `<path d="M130 235 Q230 185 330 235 T530 235 T730 235 L860 210" fill="none" stroke="${color}" stroke-width="28"/><path d="M180 250L280 205M550 250L650 205" stroke="#fff4db" stroke-width="12"/></svg>`))}`,
  }));
}

export function publishArtwork(entries: readonly GalleryEntry[], imageDataUrl: string,
  id: string = crypto.randomUUID(), createdAt = new Date().toISOString(), title?: string): GalleryEntry[] {
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(imageDataUrl)) throw new Error('Invalid snapshot');
  if (entries.some(entry => entry.id === id)) throw new Error('Duplicate entry');
  const number = entries.filter(entry => entry.source === 'local').length + 1;
  const localTitle = title?.trim().replace(/\s+/g, ' ').slice(0, 80) || `Your train / ${String(number).padStart(3, '0')}`;
  return [{ id, title: localTitle, imageDataUrl,
    createdAt, votes: 0, source: 'local' }, ...entries];
}

export function getRecentGallery(entries: readonly GalleryEntry[], count = 3): GalleryEntry[] {
  return [...entries].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id)).slice(0, count);
}

export function upvote(entries: readonly GalleryEntry[], id: string): GalleryEntry[] {
  return entries.map(entry => entry.id === id && entry.votes < Number.MAX_SAFE_INTEGER
    ? { ...entry, votes: entry.votes + 1 } : entry);
}

export function rankGallery(entries: readonly GalleryEntry[]): GalleryEntry[] {
  return [...entries].sort((a, b) => b.votes - a.votes || a.id.localeCompare(b.id));
}

export type GalleryPage<T> = {
  items: T[];
  page: number;
  totalPages: number;
};

export function paginateGallery<T>(entries: readonly T[], page: number, pageSize: number): GalleryPage<T> {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.max(1, Math.ceil(entries.length / safePageSize));
  const safePage = Math.min(Math.max(0, Math.floor(page)), totalPages - 1);
  const start = safePage * safePageSize;
  return { items: entries.slice(start, start + safePageSize), page: safePage, totalPages };
}

export function isGallery(value: unknown): value is GalleryEntry[] {
  if (!Array.isArray(value)) return false;
  const seeds = seededGallery();
  const ids = new Set<string>();
  return value.every(entry => {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) ||
      typeof entry.title !== 'string' || !entry.title.trim() || entry.title.length > 120 ||
      typeof entry.createdAt !== 'string' || !Number.isFinite(Date.parse(entry.createdAt)) ||
      !Number.isSafeInteger(entry.votes) || entry.votes < 0 || typeof entry.imageDataUrl !== 'string') return false;
    ids.add(entry.id);
    if (entry.source === 'seed') return seeds.some(seed => seed.id === entry.id && seed.imageDataUrl === entry.imageDataUrl);
    return entry.source === 'local' && !seeds.some(seed => seed.id === entry.id) &&
      /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(entry.imageDataUrl);
  }) && seeds.every(seed => ids.has(seed.id));
}
