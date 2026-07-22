// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { parseEquation } from '../src/index';
import { generateEquationVariation } from '../src/variation';

describe('generateEquationVariation', () => {
  test('generates valid equation string that parses without error', () => {
    const input = '2 * x + 4 = 10';
    const variation = generateEquationVariation(input, { seed: 42 });
    expect(variation).not.toBe(input);
    expect(() => parseEquation(variation)).not.toThrow();
  });

  test('substitutes target variable correctly when requested', () => {
    const input = '3 * x + 5 = 14';
    const variation = generateEquationVariation(input, { seed: 100, targetVariable: 'y' });
    expect(variation).toContain('y');
    expect(variation).not.toContain('x');
    expect(() => parseEquation(variation)).not.toThrow();
  });

  test('varies constants for basic linear equations', () => {
    const input = '2 * x + 4 = 10';
    const variation = generateEquationVariation(input, { seed: 1, targetVariable: 'x' });
    expect(() => parseEquation(variation)).not.toThrow();
  });

  test('varies quadratic difference of squares while maintaining square structure', () => {
    const input = 'x^2 - 9 = 0';
    const variation = generateEquationVariation(input, { seed: 7, targetVariable: 'z' });
    expect(variation).toContain('z');
    expect(variation).not.toContain('x');
    expect(() => parseEquation(variation)).not.toThrow();
  });

  test('varies monic quadratic equations with factorable integer roots', () => {
    const input = 'x^2 + 5 * x + 6 = 0';
    const variation = generateEquationVariation(input, { seed: 12, targetVariable: 't' });
    expect(variation).toContain('t');
    expect(() => parseEquation(variation)).not.toThrow();
  });

  test('handles radical equations correctly', () => {
    const input = 'sqrt(x) + 2 = 5';
    const variation = generateEquationVariation(input, { seed: 15, targetVariable: 'a' });
    expect(variation).toContain('a');
    expect(() => parseEquation(variation)).not.toThrow();
  });

  test('produces valid variations for standard equations in presets', () => {
    const presets = [
      '2 * x + 4 = 10',
      '3 * x + 5 = x + 13',
      '-2 * x + 7 = 15',
      '3 * (x - 2) = 18',
      'x^2 - 9 = 0',
      'x^2 + 5 * x + 6 = 0',
      'sqrt(x) + 2 = 5',
      'sqrt(2 * x + 3) = 5',
      '(1 / 2) * x + 3 = 7',
      '(x + 2) / 3 = 4',
    ];

    for (const preset of presets) {
      for (let seed = 1; seed <= 3; seed++) {
        const variation = generateEquationVariation(preset, { seed });
        expect(() => parseEquation(variation)).not.toThrow();
      }
    }
  });
});
