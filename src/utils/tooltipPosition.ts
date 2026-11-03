interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface Viewport {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function getTooltipPosition(pointer: Point, tooltip: Size, viewport: Viewport): Point {
  const padding = 8;
  const gap = 14;
  const right = viewport.left + viewport.width;
  const bottom = viewport.top + viewport.height;

  let x = pointer.x + gap;
  if (x + tooltip.width > right - padding) x = pointer.x - tooltip.width - gap;
  x = Math.max(viewport.left + padding, Math.min(x, right - tooltip.width - padding));

  let y = pointer.y + gap;
  if (y + tooltip.height > bottom - padding) y = pointer.y - tooltip.height - gap;
  y = Math.max(viewport.top + padding, Math.min(y, bottom - tooltip.height - padding));

  return { x, y };
}
