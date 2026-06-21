import { describe, it, expect } from 'vitest';
import {
  cycleChromeScale,
  TEXT_SIZE_OPTIONS,
  CHROME_SCALE_DEFAULT,
} from '@/store/equation';

const FIRST = TEXT_SIZE_OPTIONS[0].scale;
const LAST = TEXT_SIZE_OPTIONS[TEXT_SIZE_OPTIONS.length - 1].scale;

describe('cycleChromeScale', () => {
  it('advances to the next larger option', () => {
    expect(cycleChromeScale(CHROME_SCALE_DEFAULT, 1)).toBe(TEXT_SIZE_OPTIONS[1].scale);
  });

  it('wraps from the largest back to the smallest going forward', () => {
    expect(cycleChromeScale(LAST, 1)).toBe(FIRST);
  });

  it('wraps from the smallest to the largest going backward', () => {
    expect(cycleChromeScale(FIRST, -1)).toBe(LAST);
  });

  it('defaults to forward when no direction is given', () => {
    expect(cycleChromeScale(CHROME_SCALE_DEFAULT)).toBe(TEXT_SIZE_OPTIONS[1].scale);
  });

  it('snaps an off-grid current value to the nearest option before stepping', () => {
    // 1.2 is closest to the second option (1.15); one step forward lands on the third.
    expect(cycleChromeScale(1.2, 1)).toBe(TEXT_SIZE_OPTIONS[2].scale);
  });

  it('treats out-of-range junk as clamped before cycling', () => {
    // 99 clamps to the largest option, so forward wraps to the smallest.
    expect(cycleChromeScale(99, 1)).toBe(FIRST);
  });
});
