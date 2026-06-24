import { describe, it, expect } from 'vitest';
import { TEXT_SIZE_OPTIONS } from '@/store/equation';
import {
  radialRadiusPx,
  radialIconPx,
  radialPetalDiameterPx,
  radialPetalCenterDistancePx,
  RADIAL_BASE_RADIUS_PX,
  RADIAL_ICON_BASE_PX,
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
