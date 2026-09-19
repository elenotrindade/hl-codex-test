export type RgbColor = { r: number; g: number; b: number };
export type HsvColor = { h: number; s: number; v: number };

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function parseHexColor(value: string): RgbColor | null {
  const match = value.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].split('').map(char => char + char).join('') : match[1];
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
}

export function formatHexColor(rgb: RgbColor): string {
  return `#${[rgb.r, rgb.g, rgb.b].map(value => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0')).join('')}`;
}

export function clampRgb(rgb: RgbColor): RgbColor {
  return { r: Math.round(clamp(rgb.r, 0, 255)), g: Math.round(clamp(rgb.g, 0, 255)), b: Math.round(clamp(rgb.b, 0, 255)) };
}

export function clampHsv(hsv: HsvColor): HsvColor {
  return { h: clamp(hsv.h, 0, 360), s: clamp(hsv.s, 0, 100), v: clamp(hsv.v, 0, 100) };
}

export function rgbToHsv(rgb: RgbColor): HsvColor {
  const { r, g, b } = clampRgb(rgb);
  const nr = r / 255, ng = g / 255, nb = b / 255;
  const max = Math.max(nr, ng, nb), min = Math.min(nr, ng, nb), delta = max - min;
  const h = delta === 0 ? 0 : max === nr ? 60 * (((ng - nb) / delta) % 6) : max === ng ? 60 * ((nb - nr) / delta + 2) : 60 * ((nr - ng) / delta + 4);
  return { h: Math.round(h < 0 ? h + 360 : h), s: Math.round(max === 0 ? 0 : (delta / max) * 100), v: Math.round(max * 100) };
}

export function hsvToRgb(hsv: HsvColor): RgbColor {
  const { h, s, v } = clampHsv(hsv);
  const c = (v / 100) * (s / 100);
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v / 100 - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return clampRgb({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}
