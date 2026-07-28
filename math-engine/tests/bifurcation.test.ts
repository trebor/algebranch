// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { parseEquation, equationToString } from '../src';
import {
  getBifurcationCases,
  getBifurcatingGlobalOpCases,
  getAbsoluteValueBifurcationCases,
  getZeroProductBifurcationCases,
} from '../src/bifurcation';

describe('Bifurcating Operations', () => {
  describe('Even Roots vs. Odd Roots', () => {
    it('returns two cases (+ and -) for even root (sqrt / power 2)', () => {
      const eq = parseEquation('x^2 = 9');
      const cases = getBifurcatingGlobalOpCases(eq, { type: 'sqrt' });
      expect(cases).not.toBeNull();
      expect(cases).toHaveLength(2);
      expect(equationToString(cases![0].equation)).toBe('sqrt(x ^ 2) = sqrt(9)');
      expect(equationToString(cases![1].equation)).toBe('sqrt(x ^ 2) = -sqrt(9)');
    });

    it('returns two cases for higher even power (power 4)', () => {
      const eq = parseEquation('x^4 = 16');
      const cases = getBifurcatingGlobalOpCases(eq, { type: 'root', power: 4 });
      expect(cases).not.toBeNull();
      expect(cases).toHaveLength(2);
      expect(equationToString(cases![0].equation)).toBe('nthRoot(x ^ 4, 4) = nthRoot(16, 4)');
      expect(equationToString(cases![1].equation)).toBe('nthRoot(x ^ 4, 4) = -nthRoot(16, 4)');
    });

    it('returns null for odd roots (unique real solution)', () => {
      const eq = parseEquation('x^3 = 27');
      const cases = getBifurcatingGlobalOpCases(eq, { type: 'root', power: 3 });
      expect(cases).toBeNull();
    });
  });

  describe('Absolute Value Equations', () => {
    it('splits abs(A) = B into A = B and A = -B', () => {
      const eq = parseEquation('abs(x + 2) = 5');
      const cases = getAbsoluteValueBifurcationCases(eq);
      expect(cases).not.toBeNull();
      expect(cases).toHaveLength(2);
      expect(equationToString(cases![0].equation)).toBe('x + 2 = 5');
      expect(equationToString(cases![1].equation)).toBe('x + 2 = -5');
    });

    it('splits B = abs(A) into B = A and -B = A', () => {
      const eq = parseEquation('5 = abs(x + 2)');
      const cases = getAbsoluteValueBifurcationCases(eq);
      expect(cases).not.toBeNull();
      expect(cases).toHaveLength(2);
      expect(equationToString(cases![0].equation)).toBe('5 = x + 2');
      expect(equationToString(cases![1].equation)).toBe('-5 = x + 2');
    });
  });

  describe('Zero-Product Property', () => {
    it('splits (x - 2) * (x + 3) = 0 into x - 2 = 0 and x + 3 = 0', () => {
      const eq = parseEquation('(x - 2) * (x + 3) = 0');
      const cases = getZeroProductBifurcationCases(eq);
      expect(cases).not.toBeNull();
      expect(cases).toHaveLength(2);
      expect(equationToString(cases![0].equation)).toBe('x - 2 = 0');
      expect(equationToString(cases![1].equation)).toBe('x + 3 = 0');
    });
  });

  describe('Master getBifurcationCases', () => {
    it('dispatches global even root op correctly', () => {
      const eq = parseEquation('x^2 = 9');
      const cases = getBifurcationCases(eq, { type: 'sqrt' });
      expect(cases).toHaveLength(2);
    });

    it('dispatches absolute value equation correctly', () => {
      const eq = parseEquation('abs(x - 1) = 4');
      const cases = getBifurcationCases(eq);
      expect(cases).toHaveLength(2);
    });
  });
});
