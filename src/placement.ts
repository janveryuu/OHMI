export type Point = { x: number; y: number };
export type Viewport = { width: number; height: number };
export type SavedState = { position: Point; open: boolean };

export const MASCOT_SIZE = 88;
const EDGE = 12;

const between = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

export function clampMascot(position: Point, viewport: Viewport): Point {
  return {
    x: between(position.x, EDGE, viewport.width - MASCOT_SIZE - EDGE),
    y: between(position.y, EDGE, viewport.height - MASCOT_SIZE - EDGE),
  };
}

export function initialMascot(viewport: Viewport): Point {
  return clampMascot({ x: 24, y: viewport.height - MASCOT_SIZE - 24 }, viewport);
}

export function panelRect(position: Point, viewport: Viewport) {
  const width = Math.min(360, Math.max(0, viewport.width - EDGE * 2));
  let height = Math.min(520, Math.max(0, viewport.height - EDGE * 2));
  const above = Math.max(0, position.y - EDGE - 12);
  const below = Math.max(0, viewport.height - EDGE - position.y - MASCOT_SIZE - 12);
  let x = between(position.x, EDGE, viewport.width - width - EDGE);
  let y;
  if (above >= height) y = position.y - height - 12;
  else if (below >= height) y = position.y + MASCOT_SIZE + 12;
  else if (position.x + MASCOT_SIZE + 12 + width <= viewport.width - EDGE) {
    x = position.x + MASCOT_SIZE + 12;
    y = between(position.y + MASCOT_SIZE / 2 - height / 2, EDGE, viewport.height - height - EDGE);
  } else if (position.x - 12 - width >= EDGE) {
    x = position.x - 12 - width;
    y = between(position.y + MASCOT_SIZE / 2 - height / 2, EDGE, viewport.height - height - EDGE);
  } else {
    height = Math.min(height, Math.max(above, below));
    y = above >= below ? position.y - height - 12 : position.y + MASCOT_SIZE + 12;
  }
  return { x, y, width, height };
}

export function expandedChatRect(viewport: Viewport): { x: number; y: number; width: number; height: number } {
  const width = Math.max(0, Math.min(960, viewport.width - EDGE * 2));
  const height = Math.max(0, Math.min(800, viewport.height - EDGE * 2));
  const x = Math.max(EDGE, Math.round((viewport.width - width) / 2));
  const y = Math.max(EDGE, Math.round((viewport.height - height) / 2));
  return { x, y, width, height };
}

export function fitMascotForPanel(position: Point, viewport: Viewport): Point {
  const next = clampMascot(position, viewport);
  const usableHeight = Math.min(260, Math.max(0, viewport.height - MASCOT_SIZE - EDGE * 2 - 12));
  if (panelRect(next, viewport).height >= usableHeight) return next;
  // Narrow screens need the mascot near an edge to leave room for panel controls.
  return clampMascot({ ...next, y: next.y + MASCOT_SIZE / 2 < viewport.height / 2 ? EDGE : viewport.height - MASCOT_SIZE - EDGE }, viewport);
}

export function readSavedState(value: unknown, viewport: Viewport): SavedState {
  if (!value || typeof value !== 'object') return { position: initialMascot(viewport), open: false };
  const saved = value as Partial<SavedState>;
  const position = saved.position;
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y) || typeof saved.open !== 'boolean') {
    return { position: initialMascot(viewport), open: false };
  }
  return { position: saved.open ? fitMascotForPanel(position, viewport) : clampMascot(position, viewport), open: saved.open };
}
