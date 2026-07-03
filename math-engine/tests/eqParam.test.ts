// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { encodeEqParam, decodeEqParam } from '../../ui/src/utils/eqParam';

// Stand-in for the real arbiter (parseEquation doesn't throw). A decoded string
// that carries a relation is treated as a genuine equation.
const looksLikeEquation = (s: string): boolean => /[=<>]/.test(s);

describe('encodeEqParam', () => {
  test('emits only Base64URL characters — nothing a social linkifier can mangle', () => {
    const encoded = encodeEqParam('sqrt(4*9)+x=12');
    expect(encoded).toMatch(/^[A-Za-z0-9\-_]+$/);
    // No percent-escapes, parens, stars, plusses, or equals to break the link.
    expect(encoded).not.toMatch(/[%()*+=/ ]/);
  });

  test('round-trips through decodeEqParam', () => {
    for (const eq of ['sqrt(4*9)+x=12', 'x^2-9=0', 'nthRoot(x, 64) = nthRoot(3*y, 2/4)', '2*x < 10']) {
      expect(decodeEqParam(encodeEqParam(eq), looksLikeEquation)).toBe(eq);
    }
  });

  test('handles Unicode (Greek, superscripts) without corruption', () => {
    const eq = 'θ² = π';
    expect(decodeEqParam(encodeEqParam(eq), looksLikeEquation)).toBe(eq);
  });
});

describe('decodeEqParam', () => {
  test('decodes a Base64URL share token confirmed as an equation', () => {
    const token = encodeEqParam('x^2-9=0');
    expect(decodeEqParam(token, looksLikeEquation)).toBe('x^2-9=0');
  });

  test('reads a hand-authored link with raw operators verbatim', () => {
    expect(decodeEqParam('x^2-9=0', looksLikeEquation)).toBe('x^2-9=0');
  });

  test('percent-decodes a legacy hand-authored link', () => {
    // ?eq=x%5E2-9%3D0
    expect(decodeEqParam('x%5E2-9%3D0', looksLikeEquation)).toBe('x^2-9=0');
  });

  test('falls back to plain for a bare token that is not valid Base64URL', () => {
    // `?eq=x` — a bare variable, not a decodable token. Even if everything
    // "looked like" an equation, `x` is not valid Base64URL and stays `x`.
    expect(decodeEqParam('x', () => true)).toBe('x');
  });

  test('falls back to plain when a Base64URL token decodes to a non-equation', () => {
    // A token that is valid Base64URL but whose payload is not an equation must
    // not be silently accepted — it drops to the percent-decode path.
    const token = encodeEqParam('hello'); // decodes cleanly, but no relation
    expect(decodeEqParam(token, looksLikeEquation)).toBe(token);
  });
});
