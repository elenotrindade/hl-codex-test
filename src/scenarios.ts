import { PAINTABLE_REGIONS, TRAIN_HEIGHT, TRAIN_WIDTH, trainTemplate, type Point } from './train-template';

export type PaintRegion = { x: number; y: number; width: number; height: number };
export type ScenarioId = 'train' | 'wall' | 'vehicle';

export type PaintScenario = {
  id: ScenarioId;
  label: string;
  ariaLabel: string;
  width: number;
  height: number;
  snapshotBackground: string;
  paintableRegions: readonly PaintRegion[];
  template(): string;
};

const WALL_REGIONS = [
  { x: 0.08, y: 0.22, width: 0.84, height: 0.5 },
] as const;

const VEHICLE_REGIONS = [
  { x: 0.12, y: 0.38, width: 0.6, height: 0.25 },
  { x: 0.72, y: 0.43, width: 0.12, height: 0.2 },
] as const;

function regionsToRects(regions: readonly PaintRegion[], fill: string): string {
  return regions.map(region =>
    `<rect x="${region.x * TRAIN_WIDTH}" y="${region.y * TRAIN_HEIGHT}" width="${region.width * TRAIN_WIDTH}" height="${region.height * TRAIN_HEIGHT}" fill="${fill}"/>`,
  ).join('');
}

function wallTemplate(): string {
  return `<svg viewBox="0 0 ${TRAIN_WIDTH} ${TRAIN_HEIGHT}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Brick city wall with a wide paintable mural panel">
    <rect width="1000" height="400" fill="#cdb994"/>
    <path d="M0 302H1000" stroke="#6c6254" stroke-width="9"/>
    ${Array.from({ length: 10 }, (_, row) => `<path d="M0 ${44 + row * 28}H1000" stroke="#8e6d57" stroke-width="3" opacity=".55"/>`).join('')}
    ${Array.from({ length: 13 }, (_, col) => `<path d="M${col * 82 + (col % 2 ? 20 : 0)} 44V302" stroke="#8e6d57" stroke-width="3" opacity=".35"/>`).join('')}
    <rect x="60" y="70" width="880" height="230" rx="14" fill="#e4d6ba" stroke="#4d453d" stroke-width="5"/>
    ${regionsToRects(WALL_REGIONS, '#b85d45')}
    <text x="92" y="275" fill="#2f2a25" font-family="monospace" font-size="15">WALL / OPEN SPOT</text>
  </svg>`;
}

function vehicleTemplate(): string {
  return `<svg viewBox="0 0 ${TRAIN_WIDTH} ${TRAIN_HEIGHT}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Boxy street van with paintable side panels">
    <path d="M0 338H1000 M0 354H1000" stroke="#54504a" stroke-width="6"/>
    <path d="M126 270H830L894 220V145Q894 112 858 112H210Q145 112 126 174Z" fill="#2d596b" stroke="#172f3a" stroke-width="6"/>
    ${regionsToRects(VEHICLE_REGIONS, '#638da0')}
    <rect x="655" y="140" width="110" height="72" rx="8" fill="#152d38" stroke="#9eb8bc" stroke-width="5"/>
    <path d="M790 140H854Q874 142 874 172V210H790Z" fill="#152d38" stroke="#9eb8bc" stroke-width="5"/>
    <g fill="#252d30" stroke="#8b9695" stroke-width="7"><circle cx="265" cy="292" r="34"/><circle cx="740" cy="292" r="34"/></g>
    <path d="M168 232H846" stroke="#e5b85f" stroke-width="4"/>
    <text x="150" y="250" fill="#d8c7aa" font-family="monospace" font-size="15">VAN / 024</text>
  </svg>`;
}

export const scenarios: readonly PaintScenario[] = [
  { id: 'train', label: 'Train', ariaLabel: 'Train painting scene', width: TRAIN_WIDTH, height: TRAIN_HEIGHT,
    snapshotBackground: '#ebe1c9', paintableRegions: PAINTABLE_REGIONS, template: trainTemplate },
  { id: 'wall', label: 'Wall', ariaLabel: 'Wall painting scene', width: TRAIN_WIDTH, height: TRAIN_HEIGHT,
    snapshotBackground: '#d8c7aa', paintableRegions: WALL_REGIONS, template: wallTemplate },
  { id: 'vehicle', label: 'Vehicle', ariaLabel: 'Vehicle painting scene', width: TRAIN_WIDTH, height: TRAIN_HEIGHT,
    snapshotBackground: '#d7d0be', paintableRegions: VEHICLE_REGIONS, template: vehicleTemplate },
];

export function isInsidePaintableArea(scenario: PaintScenario, point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && scenario.paintableRegions.some(region =>
    point.x >= region.x && point.x <= region.x + region.width &&
    point.y >= region.y && point.y <= region.y + region.height,
  );
}

export function getScenario(id: ScenarioId): PaintScenario {
  return scenarios.find(scenario => scenario.id === id) ?? scenarios[0];
}
