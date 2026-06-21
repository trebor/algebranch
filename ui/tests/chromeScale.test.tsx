import { describe, it, expect } from 'vitest';
import {
  clampChromeScale,
  CHROME_SCALE_DEFAULT,
  TEXT_SIZE_OPTIONS,
  DEFAULT_SETTINGS,
} from '@/store/equation';

describe('clampChromeScale', () => {
  it('returns the default for non-finite or junk input', () => {
    expect(clampChromeScale(Number.NaN)).toBe(CHROME_SCALE_DEFAULT);
    expect(clampChromeScale(Infinity)).toBe(CHROME_SCALE_DEFAULT);
    // @ts-expect-error — guarding against persisted junk from older builds
    expect(clampChromeScale('1.3')).toBe(CHROME_SCALE_DEFAULT);
    // @ts-expect-error — undefined can arrive from a settings object missing the key
    expect(clampChromeScale(undefined)).toBe(CHROME_SCALE_DEFAULT);
  });

  it('clamps to the supported range', () => {
    const min = TEXT_SIZE_OPTIONS[0].scale;
    const max = TEXT_SIZE_OPTIONS[TEXT_SIZE_OPTIONS.length - 1].scale;
    expect(clampChromeScale(0.1)).toBe(min);
    expect(clampChromeScale(99)).toBe(max);
  });

  it('passes valid in-range values through untouched', () => {
    for (const opt of TEXT_SIZE_OPTIONS) {
      expect(clampChromeScale(opt.scale)).toBe(opt.scale);
    }
  });
});

describe('text-size settings defaults', () => {
  it('defaults chromeScale to the no-op scale', () => {
    expect(DEFAULT_SETTINGS.chromeScale).toBe(CHROME_SCALE_DEFAULT);
    expect(CHROME_SCALE_DEFAULT).toBe(1);
  });

  it('includes a Default option pinned to the no-op scale', () => {
    const def = TEXT_SIZE_OPTIONS.find((o) => o.scale === CHROME_SCALE_DEFAULT);
    expect(def).toBeDefined();
    expect(def?.label).toBe('Default');
  });

  it('lists options in ascending scale order', () => {
    const scales = TEXT_SIZE_OPTIONS.map((o) => o.scale);
    expect([...scales].sort((a, b) => a - b)).toEqual(scales);
  });
});
