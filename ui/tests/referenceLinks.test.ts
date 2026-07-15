// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { getReferenceUrl } from '../src/constants/referenceLinks';
import type { StepChange } from 'math-engine';

describe('getReferenceUrl', () => {
  it('maps family-op rewrites correctly', () => {
    const quadraticChange: StepChange = {
      kind: 'rewrite',
      family: 'simplify',
      op: 'quadratic',
      text: 'apply quadratic formula',
    };
    expect(getReferenceUrl(quadraticChange)).toBe('https://en.wikipedia.org/wiki/Quadratic_formula');

    const expandChange: StepChange = {
      kind: 'rewrite',
      family: 'expand',
      op: 'expand',
      text: 'expand expression',
    };
    expect(getReferenceUrl(expandChange)).toBe('https://en.wikipedia.org/wiki/Distributive_property');
  });

  it('maps bothSides ops to equality properties', () => {
    const addChange: StepChange = {
      kind: 'bothSides',
      op: 'add',
      operand: '3',
      text: 'add 3 to both sides',
    };
    expect(getReferenceUrl(addChange)).toBe('https://en.wikipedia.org/wiki/Equality_(mathematics)');
  });

  it('allows a label override to beat a family default', () => {
    // 'simplify' op would normally map to null, but with label 'Complete the Square' it overrides
    const ctsChange: StepChange = {
      kind: 'rewrite',
      family: 'simplify',
      op: 'identity',
      label: 'Complete the Square',
      text: 'complete the square',
    };
    expect(getReferenceUrl(ctsChange)).toBe('https://en.wikipedia.org/wiki/Completing_the_square');

    // 'factor' op would normally map to Factorization, but with 'Factor Difference of Squares' it overrides
    const diffSquaresChange: StepChange = {
      kind: 'rewrite',
      family: 'factor',
      op: 'factor',
      label: 'Factor Difference of Squares',
      text: 'factor difference of squares',
    };
    expect(getReferenceUrl(diffSquaresChange)).toBe('https://en.wikipedia.org/wiki/Difference_of_two_squares');

    const combineFractionsChange: StepChange = {
      kind: 'rewrite',
      family: 'simplify',
      op: 'simplify',
      label: 'Combine Fractions',
      text: 'combine fractions',
    };
    expect(getReferenceUrl(combineFractionsChange)).toBe('https://en.wikipedia.org/wiki/Lowest_common_denominator');

    const takeRootChange: StepChange = {
      kind: 'rewrite',
      family: 'simplify',
      op: 'simplify',
      label: 'Take Root (+)',
      text: 'take root (+)',
    };
    expect(getReferenceUrl(takeRootChange)).toBe('https://en.wikipedia.org/wiki/Square_root');
  });

  it('returns null for unmapped step changes', () => {
    const evaluateChange: StepChange = {
      kind: 'rewrite',
      family: 'simplify',
      op: 'evaluate',
      text: 'evaluate numerical term',
    };
    expect(getReferenceUrl(evaluateChange)).toBeNull();
  });
});
