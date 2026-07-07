import { describe, it, expect } from 'vitest';
import { TEXT_SIZE_OPTIONS } from '@/store/equation';
import {
  radialRadiusPx,
  radialIconPx,
  radialPetalDiameterPx,
  radialPetalCenterDistancePx,
  radialMenuPosition,
  RADIAL_BASE_RADIUS_PX,
  RADIAL_ICON_BASE_PX,
  RADIAL_NARROW_VIEWPORT_PX,
} from '@/utils/radialLayout';

describe('radial menu geometry scales with chrome scale', () => {
  it('matches the legacy fixed geometry at the default scale', () => {
    expect(radialRadiusPx(1)).toBe(RADIAL_BASE_RADIUS_PX);
    expect(radialIconPx(1)).toBe(RADIAL_ICON_BASE_PX);
  });

  it('grows the ring radius and icons in lockstep with the text-size knob', () => {
    expect(radialRadiusPx(1.5)).toBeCloseTo(RADIAL_BASE_RADIUS_PX * 1.5);
    expect(radialIconPx(1.5)).toBe(Math.round(RADIAL_ICON_BASE_PX * 1.5));
  });

  // The bug (#278): at larger text sizes the rem-sized petal circles grow but
  // the fixed-px ring radius did not, so adjacent circles overlapped into a
  // "flower". The ring must stay wider than the petals at every supported size.
  it('keeps petals from overlapping at every supported text size', () => {
    for (const { scale } of TEXT_SIZE_OPTIONS) {
      const gap = radialPetalCenterDistancePx(scale) - radialPetalDiameterPx(scale);
      expect(gap).toBeGreaterThan(0);
    }
  });

  it('preserves a constant proportional gap across all text sizes', () => {
    const ratioAt = (scale: number) =>
      radialPetalCenterDistancePx(scale) / radialPetalDiameterPx(scale);
    const base = ratioAt(1);
    for (const { scale } of TEXT_SIZE_OPTIONS) {
      expect(ratioAt(scale)).toBeCloseTo(base);
    }
  });
});

// #392: near a screen edge on a narrow (mobile) viewport, anchoring the menu to
// the `=` sign let the petals/input panel run off-screen. Below the `sm`
// breakpoint we drop the menu into the dead center of the screen — both axes —
// so it always lands fully on-screen; wider viewports keep the anchored bloom.
describe('radialMenuPosition narrow-viewport centering', () => {
  it('centers on the screen in both axes when the viewport is narrower than sm', () => {
    // An anchor hugging a corner would overflow; centering rescues it.
    expect(
      radialMenuPosition({ anchorX: 380, anchorY: 20, viewportWidth: 400, viewportHeight: 700 }),
    ).toEqual({ x: 200, y: 350 });
  });

  it('stays anchored to the = sign when there is room', () => {
    expect(
      radialMenuPosition({ anchorX: 300, anchorY: 120, viewportWidth: 1280, viewportHeight: 800 }),
    ).toEqual({ x: 300, y: 120 });
  });

  it('treats the threshold as the first anchored width (centers strictly below it)', () => {
    expect(
      radialMenuPosition({
        anchorX: 500,
        anchorY: 40,
        viewportWidth: RADIAL_NARROW_VIEWPORT_PX,
        viewportHeight: 900,
      }),
    ).toEqual({ x: 500, y: 40 });
    expect(
      radialMenuPosition({
        anchorX: 500,
        anchorY: 40,
        viewportWidth: RADIAL_NARROW_VIEWPORT_PX - 1,
        viewportHeight: 900,
      }),
    ).toEqual({ x: (RADIAL_NARROW_VIEWPORT_PX - 1) / 2, y: 450 });
  });
});
