// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { parseEquation, isEquationSolved, getReducibleOptions } from '../src';

describe('isEquationSolved', () => {
  test('returns true for isolated variable on LHS with fully reduced RHS', () => {
    expect(isEquationSolved(parseEquation('x = 5'))).toBe(true);
    expect(isEquationSolved(parseEquation('x = 3 / 7'))).toBe(true);
  });

  test('returns true for isolated variable on RHS with fully reduced LHS', () => {
    expect(isEquationSolved(parseEquation('5 = x'))).toBe(true);
    expect(isEquationSolved(parseEquation('3 / 7 = x'))).toBe(true);
  });

  test('returns false when non-variable side has unreduced arithmetic or operations', () => {
    expect(isEquationSolved(parseEquation('x = 2 + 1'))).toBe(false);
    expect(isEquationSolved(parseEquation('2 + 1 = x'))).toBe(false);
    expect(isEquationSolved(parseEquation('x = 15 / 3'))).toBe(false);
    expect(isEquationSolved(parseEquation('15 / 3 = x'))).toBe(false);
    expect(isEquationSolved(parseEquation('x = 6 / 14'))).toBe(false);
  });

  test('returns false when variable is not isolated or exists on both sides', () => {
    expect(isEquationSolved(parseEquation('x + 2 = 5'))).toBe(false);
    expect(isEquationSolved(parseEquation('x = x + 1'))).toBe(false);
    expect(isEquationSolved(parseEquation('2 * x = 6'))).toBe(false);
  });
});
