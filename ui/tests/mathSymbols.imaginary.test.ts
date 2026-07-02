// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { IMAGINARY_UNIT, isImaginaryUnit, symbolToGlyph, greekNameFor, symbolHintFor, IMAGINARY_UNIT_HINT } from '../src/constants/mathSymbols';

// The imaginary-unit token is the distinct Unicode codepoint U+2148 'ⅈ',
// rendered as an upright roman i — not the ASCII variable i. See #105.
describe('imaginary unit — render helpers', () => {
  it('exposes the U+2148 token, distinct from ASCII i', () => {
    expect(IMAGINARY_UNIT).toBe('ⅈ');
    expect(IMAGINARY_UNIT).not.toBe('i');
  });

  it('recognizes the token and rejects the ASCII letter', () => {
    expect(isImaginaryUnit(IMAGINARY_UNIT)).toBe(true);
    expect(isImaginaryUnit('i')).toBe(false);
    expect(isImaginaryUnit('x')).toBe(false);
  });

  it('does not treat the imaginary unit as a Greek-spelled name', () => {
    // It renders via its own upright-i path, so the Greek-name hover hint must
    // never fire for it (otherwise it would show a bogus "ⅈ" tooltip).
    expect(greekNameFor(IMAGINARY_UNIT)).toBeNull();
    // And it is not folded into the plain symbol-glyph map.
    expect(symbolToGlyph(IMAGINARY_UNIT)).toBe(IMAGINARY_UNIT);
  });

  it('identifies the imaginary unit via symbolHintFor as "i = √−1"', () => {
    expect(IMAGINARY_UNIT_HINT).toBe('i = √−1');
    expect(symbolHintFor(IMAGINARY_UNIT)).toBe(IMAGINARY_UNIT_HINT);
  });

  it('symbolHintFor still returns Greek names and nothing for plain variables', () => {
    expect(symbolHintFor('theta')).toBe('theta');
    expect(symbolHintFor('x')).toBeNull();
  });
});
