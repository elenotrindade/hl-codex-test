import { type Point } from './train-template';

export type PaintRegion = { x: number; y: number; width: number; height: number };
export type ScenarioId = 'train' | 'wall' | 'vehicle';

export type PaintScenario = {
  id: ScenarioId;
  label: string;
  ariaLabel: string;
  width: number;
  height: number;
  imageSrc: string;
  snapshotBackground: string;
  paintableRegions: readonly PaintRegion[];
  template(): string;
};

export const SCENE_WIDTH = 1000;
export const SCENE_HEIGHT = 400;

const TRAIN_REGIONS = [
  { x: 0.055, y: 0.24, width: 0.89, height: 0.43 },
] as const;

const WALL_REGIONS = [
  { x: 0, y: 0.2, width: 1, height: 0.62 },
] as const;

const VEHICLE_REGIONS = [
  { x: 0.15, y: 0.13, width: 0.64, height: 0.36 },
  { x: 0.15, y: 0.49, width: 0.66, height: 0.22 },
  { x: 0.79, y: 0.2, width: 0.17, height: 0.46 },
] as const;

function photoTemplate(scenario: Pick<PaintScenario, 'ariaLabel' | 'imageSrc' | 'width' | 'height'>): string {
  return `<img class="scene-photo" src="${scenario.imageSrc}" alt="${scenario.ariaLabel}" width="${scenario.width}" height="${scenario.height}" draggable="false"/><div class="scene-lighting" aria-hidden="true"></div>`;
}

export const scenarios: readonly PaintScenario[] = [
  { id: 'train', label: 'Train', ariaLabel: 'Realistic train cart painting scene', width: SCENE_WIDTH, height: SCENE_HEIGHT,
    imageSrc: '/references/train-cart.png', snapshotBackground: '#d7d0be', paintableRegions: TRAIN_REGIONS,
    template() { return photoTemplate(this); } },
  { id: 'wall', label: 'Wall', ariaLabel: 'Realistic urban wall painting scene', width: SCENE_WIDTH, height: SCENE_HEIGHT,
    imageSrc: '/references/wall.png', snapshotBackground: '#d8c7aa', paintableRegions: WALL_REGIONS,
    template() { return photoTemplate(this); } },
  { id: 'vehicle', label: 'Vehicle', ariaLabel: 'Realistic car painting scene', width: SCENE_WIDTH, height: SCENE_HEIGHT,
    imageSrc: '/references/car.png', snapshotBackground: '#d7d0be', paintableRegions: VEHICLE_REGIONS,
    template() { return photoTemplate(this); } },
];

function regionContains(region: PaintRegion, point: Point): boolean {
  return point.x >= region.x && point.x <= region.x + region.width &&
    point.y >= region.y && point.y <= region.y + region.height;
}

export function isInsidePaintableArea(scenario: PaintScenario, point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && scenario.paintableRegions.some(region =>
    regionContains(region, point),
  );
}

export function paintableDripFloor(scenario: PaintScenario, point: Point): number {
  const region = scenario.paintableRegions.find(item => regionContains(item, point));
  return region ? Math.max(0, region.y + region.height - point.y) : 0;
}

export function getScenario(id: ScenarioId): PaintScenario {
  return scenarios.find(scenario => scenario.id === id) ?? scenarios[0];
}
