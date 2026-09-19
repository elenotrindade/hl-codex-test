export const DEFAULT_COLOR = '#e2483d';

export type WheelSelection = {
  x: number;
  y: number;
  color: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function projectToWheel(x: number, y: number): { x: number; y: number } {
  const clampedX = clamp(x, -1, 1);
  const clampedY = clamp(y, -1, 1);
  const radius = Math.hypot(clampedX, clampedY);

  if (radius <= 1) return { x: clampedX, y: clampedY };

  return { x: clampedX / radius, y: clampedY / radius };
}

export function colorFromWheelPoint(x: number, y: number): WheelSelection {
  const point = projectToWheel(x, y);
  const radius = Math.hypot(point.x, point.y);
  const angle = Math.atan2(point.y, point.x) * 180 / Math.PI;
  const hue = Math.round((angle + 360) % 360);
  const saturation = Math.round(radius * 100);

  return {
    x: point.x,
    y: point.y,
    color: `hsl(${hue} ${saturation}% 52%)`,
  };
}
