export type Point = { x: number; y: number };

export const TRAIN_WIDTH = 1000;
export const TRAIN_HEIGHT = 400;

// Normalized panels are shared by SVG, hit testing, and canvas clipping.
export const PAINTABLE_REGIONS = [
  { x: 0.09, y: 0.45, width: 0.82, height: 0.25 },
  { x: 0.09, y: 0.24, width: 0.045, height: 0.21 },
  { x: 0.865, y: 0.24, width: 0.045, height: 0.21 },
] as const;

export function isInsidePaintableTrainArea(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && PAINTABLE_REGIONS.some(region =>
    point.x >= region.x && point.x <= region.x + region.width &&
    point.y >= region.y && point.y <= region.y + region.height,
  );
}

export function trainTemplate(): string {
  const panels = PAINTABLE_REGIONS.map(region =>
    `<rect x="${region.x * TRAIN_WIDTH}" y="${region.y * TRAIN_HEIGHT}" width="${region.width * TRAIN_WIDTH}" height="${region.height * TRAIN_HEIGHT}" fill="#527e91"/>`,
  ).join('');
  const windows = Array.from({ length: 8 }, (_, i) =>
    `<rect x="${150 + i * 89}" y="105" width="68" height="58" rx="5" fill="#162e3b" stroke="#99aeb2" stroke-width="4"/>`,
  ).join('');
  return `<svg viewBox="0 0 ${TRAIN_WIDTH} ${TRAIN_HEIGHT}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Side-view steel-blue train with paintable lower body panels">
    <path d="M0 340H1000 M0 354H1000" stroke="#54504a" stroke-width="6"/>
    <g fill="#252d30" stroke="#8b9695" stroke-width="7">
      <circle cx="235" cy="309" r="27"/><circle cx="310" cy="309" r="27"/>
      <circle cx="690" cy="309" r="27"/><circle cx="765" cy="309" r="27"/>
    </g>
    <path d="M150 285H850" stroke="#252d30" stroke-width="24"/>
    <rect x="65" y="85" width="870" height="205" rx="26" fill="#24485c" stroke="#172f3a" stroke-width="5"/>
    <path d="M95 85Q100 65 145 65H855Q900 65 905 85" fill="#839798"/>
    ${panels}${windows}
    <path d="M90 178H910 M90 283H910" stroke="#e5b85f" stroke-width="4"/>
    <rect x="68" y="194" width="12" height="26" rx="4" fill="#f1aa2d"/>
    <rect x="920" y="194" width="12" height="26" rx="4" fill="#e2483d"/>
    <text x="105" y="267" fill="#d8c7aa" font-family="monospace" font-size="15">YARD / 001</text>
  </svg>`;
}
