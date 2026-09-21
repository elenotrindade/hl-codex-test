import { clamp } from './color-tools';
import { type Point } from './train-template';

type WetMark = Point & { color: string; texture: string; size: number; opacity?: number; erase?: boolean };

// Inspired by dripping-spray (Narigo): accumulate paint, then drip.
// Kept in-repo so undo/replay stay deterministic and we do not take over the canvas.

export const SPRAY_CLICK_BURST = 12;
const WET_RADIUS = 1.7;
const DRIP_START = 10.5;

export function sprayDripLength(point: Point, wetMarks: readonly WetMark[], mark: Pick<WetMark, 'color' | 'size' | 'opacity'> & { dripAmount?: number; floor?: number }): number {
  const amount = clamp(mark.dripAmount ?? 1, 0, 1);
  if (amount <= 0) return 0;
  let load = 0;
  const reach = mark.size * WET_RADIUS;
  for (const wet of wetMarks) {
    if (wet.erase || wet.color !== mark.color) continue;
    const distance = Math.hypot(wet.x - point.x, wet.y - point.y);
    if (distance > reach) continue;
    load += 1 - distance / reach;
  }
  if (load < DRIP_START) return 0;
  const floor = Math.max(0, mark.floor ?? 1 - point.y);
  const excess = load - DRIP_START;
  const rate = 0.028 + mark.size * 0.22;
  const grow = Math.pow(excess, 0.75) * rate * (mark.opacity ?? 1) * amount;
  return clamp(grow, 0, floor);
}

export function dripSteps(drip: number, radius: number, canvasHeight: number): number {
  if (drip <= 0) return 0;
  const length = drip * canvasHeight;
  return Math.max(8, Math.ceil(length / Math.max(2.4, radius * 0.26)));
}

export function stampSpray(
  ctx: Pick<CanvasRenderingContext2D, 'arc' | 'beginPath' | 'fill' | 'fillRect'> & { globalAlpha: number },
  x: number,
  y: number,
  radius: number,
  opacity: number,
  seedPoint: Point,
  drip = 0,
  height = 400,
): void {
  let seed = (Math.round(seedPoint.x * 1e6) ^ Math.round(seedPoint.y * 1e6) ^ Math.round(drip * 1e4)) >>> 0;
  const random = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  ctx.globalAlpha = opacity * 0.42;
  for (let i = 0; i < 36; i++) {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * radius;
    const speckle = radius * (0.04 + random() * 0.05);
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, speckle, 0, Math.PI * 2);
    ctx.fill();
  }
  stampDrip(ctx, x, y, radius, opacity, drip, height, seedPoint);
}

export function stampDrip(
  ctx: Pick<CanvasRenderingContext2D, 'arc' | 'beginPath' | 'fill'> & { globalAlpha: number },
  x: number,
  y: number,
  radius: number,
  opacity: number,
  drip: number,
  height = 400,
  seedPoint: Point = { x: 0, y: 0 },
): void {
  const length = Math.min(drip * height, Math.max(0, height - y));
  if (length <= 0) return;
  const steps = dripSteps(drip, radius, height);
  const topW = Math.max(2.4, radius * 0.72);
  const midW = Math.max(1.4, radius * 0.28);
  const tipW = Math.max(1.1, radius * 0.2);
  let seed = (Math.round(seedPoint.x * 1e6) ^ Math.round(y * 1e3) ^ Math.round(drip * 1e5)) >>> 0;
  const random = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const sway = (random() - 0.5) * topW * 0.18 * t;
    const width = t < 0.12
      ? topW
      : t > 0.92
        ? midW + (tipW - midW) * ((t - 0.92) / 0.08) + tipW * 0.35 * (t - 0.92) / 0.08
        : topW + (midW - topW) * ((t - 0.12) / 0.8);
    ctx.globalAlpha = opacity * (0.52 + (1 - t) * 0.28);
    ctx.beginPath();
    ctx.arc(x + sway, y + t * length, width / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
