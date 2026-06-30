// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { parseEquation } from 'math-engine-client';
import {
  backgroundColorFor,
  foregroundColorFor,
  equationImageFilename,
} from '@/utils/equationImage';

describe('equationImage helpers', () => {
  describe('backgroundColorFor', () => {
    it('maps white and black to solid colors', () => {
      expect(backgroundColorFor('white')).toBe('#ffffff');
      expect(backgroundColorFor('black')).toBe('#000000');
    });

    it('maps transparent to undefined so html-to-image leaves the alpha channel', () => {
      expect(backgroundColorFor('transparent')).toBeUndefined();
    });
  });

  describe('foregroundColorFor', () => {
    it('uses light text on black and dark text otherwise', () => {
      expect(foregroundColorFor('black')).toBe('#f8fafc');
      expect(foregroundColorFor('white')).toBe('#0f172a');
      // Transparent is usually dropped on light surfaces → dark glyphs read.
      expect(foregroundColorFor('transparent')).toBe('#0f172a');
    });
  });

  describe('equationImageFilename', () => {
    it('builds a branded, .png, filesystem-safe name from the equation', () => {
      const name = equationImageFilename(parseEquation('x^2-9=0'));
      expect(name.startsWith('algebranch-')).toBe(true);
      expect(name.endsWith('.png')).toBe(true);
      // No path separators, whitespace, or glob characters survive.
      expect(name).not.toMatch(/[\s/\\*?:"<>|]/);
    });

    it('falls back to a generic name when the slug would be empty', () => {
      // An all-symbol equation slugs to nothing usable → generic fallback.
      const name = equationImageFilename(parseEquation('x=x'));
      expect(name).toBe('algebranch-x=x.png');
    });
  });
});
