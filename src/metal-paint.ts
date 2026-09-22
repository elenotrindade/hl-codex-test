export const METAL_TEXTURES = ['chrome', 'gold', 'copper', 'iridescent'] as const;
export type MetalTexture = typeof METAL_TEXTURES[number];

const STOPS: Record<MetalTexture, readonly string[]> = {
  chrome: ['#f7f9fb', '#d5dbe3', '#8d98a6', '#f4f7fa', '#6d7784', '#eef2f6'],
  gold: ['#fff6c2', '#f0c94a', '#a8740d', '#fff1a6', '#8a5a09', '#e7b423'],
  copper: ['#f8d7c0', '#e08a52', '#8d4324', '#f3c2a2', '#6b2e18', '#c4622f'],
  iridescent: ['#ff5d8f', '#ffd166', '#7ae582', '#4cc9f0', '#c77dff', '#ff5d8f'],
};

const FALLBACK: Record<MetalTexture, string> = {
  chrome: '#b7c0cb',
  gold: '#d4a017',
  copper: '#c46b3a',
  iridescent: '#7eb6ff',
};

type MetalContext = Pick<CanvasRenderingContext2D, 'beginPath' | 'arc' | 'fill'> & {
  fillStyle: CanvasRenderingContext2D['fillStyle'];
  createLinearGradient?: CanvasRenderingContext2D['createLinearGradient'];
};

const sheenCache = new WeakMap<object, { key: string; gradient: CanvasGradient }>();

export function isMetalTexture(texture: string): texture is MetalTexture {
  return (METAL_TEXTURES as readonly string[]).includes(texture);
}

export function metalFallback(texture: MetalTexture): string {
  return FALLBACK[texture];
}

export function metalStops(texture: MetalTexture): readonly string[] {
  return STOPS[texture];
}

export function metalPaintStyle(ctx: MetalContext, texture: MetalTexture, width: number, height: number): CanvasGradient | string {
  const stops = STOPS[texture];
  if (typeof ctx.createLinearGradient !== 'function' || width <= 0 || height <= 0) return FALLBACK[texture];
  const key = `${texture}:${width}:${height}`;
  const cached = sheenCache.get(ctx);
  if (cached?.key === key) return cached.gradient;
  const span = texture === 'iridescent' ? width * 0.28 : width;
  const sheen = ctx.createLinearGradient(0, height * 0.12, span, height * 0.88);
  stops.forEach((color, index) => sheen.addColorStop(index / (stops.length - 1), color));
  sheenCache.set(ctx, { key, gradient: sheen });
  return sheen;
}

export function paintMetal(ctx: MetalContext, texture: MetalTexture, x: number, y: number, radius: number, width: number, height: number): void {
  ctx.fillStyle = metalPaintStyle(ctx, texture, width, height);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}
