export function findPaintCanvas(root: ParentNode): HTMLCanvasElement | null {
  return root.querySelector<HTMLCanvasElement>('.paint-stage canvas');
}
