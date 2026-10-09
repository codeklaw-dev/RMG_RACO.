// Annotation coordinates are stored normalised (0–1) relative to the garment
// artboard, so pins stay on the same spot at any size, zoom or pan.
export const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

export function toNormalized(px: { x: number; y: number }, box: { left: number; top: number; width: number; height: number }) {
  return { x: clamp01((px.x - box.left) / box.width), y: clamp01((px.y - box.top) / box.height) };
}

export function toPixels(pt: { x: number; y: number }, size: { width: number; height: number }) {
  return { left: pt.x * size.width, top: pt.y * size.height };
}

/** Keyboard placement: arrow keys nudge by 2% (10% with Shift). */
export function nudge(pt: { x: number; y: number }, key: string, big = false) {
  const d = big ? 0.1 : 0.02;
  const map: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
  const [dx, dy] = map[key] ?? [0, 0];
  return { x: clamp01(pt.x + dx), y: clamp01(pt.y + dy) };
}
