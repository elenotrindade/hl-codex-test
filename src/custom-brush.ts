import { clamp } from './color-tools';

export const BRUSH_TIPS = ['chisel', 'round', 'square', 'wedge', 'rake', 'splatter'] as const;
export type BrushTip = typeof BRUSH_TIPS[number];

export const BRUSH_TIP_LABELS: Record<BrushTip, string> = {
  chisel: 'Chisel',
  round: 'Round',
  square: 'Square',
  wedge: 'Wedge',
  rake: 'Rake',
  splatter: 'Splatter',
};

export type CustomBrush = {
  angle: number;
  aspect: number;
  tip: BrushTip;
  softness: number;
};

export const DEFAULT_CUSTOM_BRUSH: CustomBrush = {
  angle: -30,
  aspect: 0.35,
  tip: 'chisel',
  softness: 0.15,
};

export function clampCustomBrush(value?: Partial<CustomBrush> | null): CustomBrush {
  const tip = value?.tip && BRUSH_TIPS.includes(value.tip) ? value.tip : DEFAULT_CUSTOM_BRUSH.tip;
  return {
    angle: clamp(value?.angle ?? DEFAULT_CUSTOM_BRUSH.angle, -90, 90),
    aspect: clamp(value?.aspect ?? DEFAULT_CUSTOM_BRUSH.aspect, 0.15, 1),
    tip,
    softness: clamp(value?.softness ?? DEFAULT_CUSTOM_BRUSH.softness, 0, 0.8),
  };
}

export const CUSTOM_BRUSH_KEY = 'train-graffiti.custom-brush.v1';

export function loadCustomBrush(access: () => Pick<Storage, 'getItem'> = () => window.localStorage): CustomBrush {
  try {
    const raw = access().getItem(CUSTOM_BRUSH_KEY);
    if (!raw) return { ...DEFAULT_CUSTOM_BRUSH };
    const value: unknown = JSON.parse(raw);
    return isCustomBrush(value) ? clampCustomBrush(value) : { ...DEFAULT_CUSTOM_BRUSH };
  } catch {
    return { ...DEFAULT_CUSTOM_BRUSH };
  }
}

export function saveCustomBrush(brush: CustomBrush, access: () => Pick<Storage, 'setItem'> = () => window.localStorage): boolean {
  try {
    access().setItem(CUSTOM_BRUSH_KEY, JSON.stringify(clampCustomBrush(brush)));
    return true;
  } catch {
    return false;
  }
}

export function isCustomBrush(value: unknown): value is CustomBrush {
  if (!value || typeof value !== 'object') return false;
  const brush = value as CustomBrush;
  return BRUSH_TIPS.includes(brush.tip) &&
    Number.isFinite(brush.angle) && brush.angle >= -90 && brush.angle <= 90 &&
    Number.isFinite(brush.aspect) && brush.aspect >= 0.15 && brush.aspect <= 1 &&
    Number.isFinite(brush.softness) && brush.softness >= 0 && brush.softness <= 0.8;
}

export function fittedStampRadius(width: number, height: number, brush: CustomBrush, inset = 8): number {
  const crafted = clampCustomBrush(brush);
  const boxW = Math.max(1, width - inset * 2);
  const boxH = Math.max(1, height - inset * 2);
  const shear = crafted.tip === 'chisel' ? 0.65 : 0;
  const stampH = 2 * crafted.aspect;
  const stampW = 2 + Math.abs(shear) * stampH;
  const angle = crafted.angle * Math.PI / 180;
  const boundW = Math.abs(stampW * Math.cos(angle)) + Math.abs(stampH * Math.sin(angle));
  const boundH = Math.abs(stampW * Math.sin(angle)) + Math.abs(stampH * Math.cos(angle));
  return Math.min(boxW / boundW, boxH / boundH);
}

type StampContext = Pick<CanvasRenderingContext2D, 'arc' | 'beginPath' | 'closePath' | 'fill' | 'fillRect' | 'lineTo' | 'moveTo' | 'restore' | 'rotate' | 'save' | 'scale' | 'transform' | 'translate'> & { globalAlpha: number };

function unitRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function stampCustomBrush(
  ctx: StampContext,
  x: number,
  y: number,
  radius: number,
  opacity: number,
  brush: CustomBrush,
): void {
  const crafted = clampCustomBrush(brush);
  const width = radius * 2;
  const height = Math.max(radius * 0.12, width * crafted.aspect);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(crafted.angle * Math.PI / 180);
  ctx.globalAlpha = opacity * (0.42 + (1 - crafted.softness) * 0.48);
  if (crafted.tip === 'round') {
    ctx.save();
    ctx.scale(1, height / width);
    ctx.beginPath();
    ctx.arc(0, 0, width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (crafted.tip === 'chisel') {
    ctx.transform(1, 0, 0.65, 1, 0, 0);
    ctx.fillRect(-width / 2, -height / 2, width, height);
  } else if (crafted.tip === 'wedge') {
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(-width / 2, -height / 2);
    ctx.lineTo(-width / 2, height / 2);
    ctx.closePath();
    ctx.fill();
  } else if (crafted.tip === 'rake') {
    const teeth = 4;
    const tooth = height / (teeth * 2 - 1);
    for (let index = 0; index < teeth; index += 1) {
      ctx.fillRect(-width / 2, -height / 2 + index * tooth * 2, width, Math.max(radius * 0.04, tooth));
    }
  } else if (crafted.tip === 'splatter') {
    const random = unitRandom((Math.round(x * 1e4) ^ Math.round(y * 1e4) ^ Math.round(radius * 100)) >>> 0);
    for (let index = 0; index < 12; index += 1) {
      ctx.beginPath();
      ctx.arc((random() - 0.5) * width, (random() - 0.5) * height, radius * (0.05 + random() * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillRect(-width / 2, -height / 2, width, height);
  }
  ctx.restore();
}
