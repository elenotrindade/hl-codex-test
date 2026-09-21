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
  { x: 0.055, y: 0.215, width: 0.89, height: 0.43 },
] as const;

const WALL_REGIONS = [
  { x: 0.035, y: 0.18, width: 0.93, height: 0.56 },
] as const;

const VEHICLE_REGIONS = [
  { x: 0.075, y: 0.22, width: 0.75, height: 0.43 },
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

export function isInsidePaintableArea(scenario: PaintScenario, point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && scenario.paintableRegions.some(region =>
    point.x >= region.x && point.x <= region.x + region.width &&
    point.y >= region.y && point.y <= region.y + region.height,
  );
}

export function getScenario(id: ScenarioId): PaintScenario {
  return scenarios.find(scenario => scenario.id === id) ?? scenarios[0];
}
