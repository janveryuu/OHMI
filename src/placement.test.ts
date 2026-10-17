import { describe, expect, it } from 'vitest';
import { clampMascot, expandedChatRect, fitMascotForPanel, initialMascot, panelRect, readSavedState } from './placement';

const viewport = { width: 1280, height: 800 };

describe('mascot placement', () => {
  it('starts near the lower left and clamps dragged coordinates inside the viewport', () => {
    expect(initialMascot(viewport)).toEqual({ x: 24, y: 688 });
    expect(clampMascot({ x: -50, y: 9999 }, viewport)).toEqual({ x: 12, y: 700 });
  });

  it('keeps the panel inside a small viewport', () => {
    const small = { width: 320, height: 400 };
    const rect = panelRect({ x: 230, y: 280 }, small);
    expect(rect.x).toBeGreaterThanOrEqual(12);
    expect(rect.y).toBeGreaterThanOrEqual(12);
    expect(rect.x + rect.width).toBeLessThanOrEqual(308);
    expect(rect.y + rect.height).toBeLessThanOrEqual(388);
    expect(rect.y + rect.height).toBeLessThanOrEqual(280 - 12);
  });

  it('places the panel beside a mascot in the middle when there is room', () => {
    const rect = panelRect({ x: 500, y: 300 }, viewport);
    expect(rect.x + rect.width <= 488 || rect.x >= 600).toBe(true);
    expect(rect.height).toBe(520);
  });

  it('leaves usable panel space after a centered small-screen move or restore', () => {
    const small = { width: 320, height: 400 };
    for (const position of [{ x: 116, y: 156 }, { x: 116, y: 140 }]) {
      const fitted = fitMascotForPanel(position, small);
      const rect = panelRect(fitted, small);
      expect(rect.height).toBeGreaterThanOrEqual(260);
      expect(rect.y + rect.height <= fitted.y - 12 || rect.y >= fitted.y + 100).toBe(true);
      expect(readSavedState({ position, open: true }, small).position).toEqual(fitted);
      expect(readSavedState({ position, open: false }, small).position).toEqual(position);
    }
    expect(fitMascotForPanel({ x: 500, y: 300 }, viewport)).toEqual({ x: 500, y: 300 });
  });

  it('ignores invalid stored coordinates and state', () => {
    expect(readSavedState({ position: { x: Infinity, y: 8 }, open: 'yes' }, viewport)).toEqual({
      position: initialMascot(viewport),
      open: false,
    });
    expect(readSavedState({ position: { x: 9999, y: -20 }, open: true }, viewport)).toEqual({
      position: { x: 1180, y: 12 },
      open: true,
    });
  });

  it('computes centered expandedChatRect clamped at reasonable dimensions', () => {
    const rect1366 = expandedChatRect({ width: 1366, height: 768 });
    expect(rect1366.width).toBe(960);
    expect(rect1366.height).toBe(744);
    expect(rect1366.x).toBe(203);
    expect(rect1366.y).toBe(12);

    const rect1280 = expandedChatRect({ width: 1280, height: 800 });
    expect(rect1280.width).toBe(960);
    expect(rect1280.height).toBe(776);
    expect(rect1280.x).toBe(160);
    expect(rect1280.y).toBe(12);

    const rectSmall = expandedChatRect({ width: 360, height: 600 });
    expect(rectSmall.width).toBe(336);
    expect(rectSmall.height).toBe(576);
    expect(rectSmall.x).toBe(12);
    expect(rectSmall.y).toBe(12);

    const rectTiny = expandedChatRect({ width: 10, height: 10 });
    expect(rectTiny.width).toBe(0);
    expect(rectTiny.height).toBe(0);
    expect(rectTiny.x).toBe(12);
    expect(rectTiny.y).toBe(12);
  });
});
