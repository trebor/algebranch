// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import * as math from 'mathjs';
import {
  parseEquation,
  ensureNodeIds,
  getQuadraticFormulaSolutions,
  getReducibleOptions,
  evaluatePoint,
} from '../src';
import type { Equation } from '../src';

const eq = (s: string) => ensureNodeIds(parseEquation(s));

// Value of the non-variable side of a solution equation (the formula branch).
const formulaValue = (solEq: Equation, solveVar: string): any => {
  const isVar = (n: math.MathNode) => n.type === 'SymbolNode' && (n as math.SymbolNode).name === solveVar;
  return evaluatePoint(isVar(solEq.lhs) ? solEq.rhs : solEq.lhs, {});
};

// True if substituting `value` for solveVar makes lhs == rhs (handles complex).
const satisfies = (original: Equation, solveVar: string, value: any): boolean => {
  const scope = { [solveVar]: value } as Record<string, number>;
  const diff = math.subtract(evaluatePoint(original.lhs, scope), evaluatePoint(original.rhs, scope));
  return Number(math.abs(diff)) < 1e-6;
};

const complexVal = (expr: string) => evaluatePoint(parseEquation(`z = ${expr}`).rhs, {}) as any;

const findLabel = (eqStr: string, label: string) => {
  const reductions = getReducibleOptions(parseEquation(eqStr));
  return Object.values(reductions).flat().find((r) => r.label === label);
};

// The seam where complex numbers meet #62: a negative-discriminant quadratic
// produces a complex-conjugate root pair, surfaced through the quadratic formula
// and completing the square. The transform pieces (Extend to ℂ, Simplify) then
// carry the √−discriminant to a + b·ⅈ standard form. (#105)
describe('complex roots via the quadratic formula (#105, #62)', () => {
  it('a negative discriminant yields complex-conjugate roots that satisfy the equation', () => {
    const original = eq('x^2 - 2*x + 5 = 0');
    const sols = getQuadraticFormulaSolutions(original).filter((q) => q.solveVar === 'x');
    expect(sols).toHaveLength(1);
    const rootPos = formulaValue(sols[0].pos, 'x');
    const rootNeg = formulaValue(sols[0].neg, 'x');

    // Both are genuinely complex (nonzero imaginary part)...
    expect(Math.abs(rootPos.im)).toBeGreaterThan(1e-9);
    expect(Math.abs(rootNeg.im)).toBeGreaterThan(1e-9);
    // ...a conjugate pair...
    expect(rootPos.re).toBeCloseTo(rootNeg.re, 9);
    expect(rootPos.im).toBeCloseTo(-rootNeg.im, 9);
    // ...equal to 1 ± 2ⅈ, and each satisfies the original equation.
    expect(rootPos.re).toBeCloseTo(1, 9);
    expect(Math.abs(rootPos.im)).toBeCloseTo(2, 9);
    expect(satisfies(original, 'x', rootPos)).toBe(true);
    expect(satisfies(original, 'x', rootNeg)).toBe(true);
  });

  it('the formula result offers Extend to ℂ to pull ⅈ out of the negative radical', () => {
    // After the discriminant is simplified the branch reads (2 + √−16)/2.
    const opt = findLabel('x = (2 + sqrt(-16)) / 2', 'Extend to ℂ');
    expect(opt).toBeDefined();
    expect(opt!.simplified.rhs.toString()).toBe('(2 + sqrt(16) * ⅈ) / 2');
  });

  it('the resulting a + b·ⅈ root simplifies cleanly and satisfies the equation', () => {
    // (2 + 4ⅈ)/2 → 1 + 2ⅈ, offered as a Simplify.
    const opt = findLabel('x = (2 + 4*ⅈ) / 2', 'Simplify');
    expect(opt).toBeDefined();
    expect(opt!.simplified.rhs.toString()).toBe('1 + 2 * ⅈ');
    // The standard-form root satisfies the original quadratic.
    expect(satisfies(eq('x^2 - 2*x + 5 = 0'), 'x', complexVal('1 + 2*ⅈ'))).toBe(true);
    expect(satisfies(eq('x^2 - 2*x + 5 = 0'), 'x', complexVal('1 - 2*ⅈ'))).toBe(true);
  });
});

describe('complex roots via completing the square (#105, #62)', () => {
  it('offers completing the square on a negative-discriminant quadratic', () => {
    const opt = findLabel('x^2 - 2*x + 5 = 0', 'Complete the Square');
    expect(opt).toBeDefined();
    // (x − 1)² + 4 = 0 — the constant is positive, so isolating gives (x−1)² = −4.
    expect(opt!.simplified.lhs.toString()).toBe('(x - 1) ^ 2 + 4');
  });

  it('the completed-square roots 1 ± 2ⅈ satisfy the original equation', () => {
    const original = eq('x^2 - 2*x + 5 = 0');
    expect(satisfies(original, 'x', complexVal('1 + 2*ⅈ'))).toBe(true);
    expect(satisfies(original, 'x', complexVal('1 - 2*ⅈ'))).toBe(true);
  });
});
