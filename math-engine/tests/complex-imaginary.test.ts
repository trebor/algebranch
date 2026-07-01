// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { mjs, IMAGINARY_UNIT } from '../src/mathjs';
import {
  evaluatePoint,
  getVariables,
  areEquationsEquivalent,
  areExpressionsValueEqual,
} from '../src/validator';
import { parseEquation } from '../src/index';
import { getGraphVariables } from '../src/graphing';
import { isConstantSubtree } from '../src/simplify';
import { getIsolatedDefinition } from '../src/substitute';

// The imaginary unit token is the distinct Unicode codepoint U+2148 'ⅈ',
// deliberately NOT the ASCII letter 'i' (which stays free as a variable). See #105.
describe('imaginary unit — token identity', () => {
  test('the token is U+2148, distinct from ASCII i', () => {
    expect(IMAGINARY_UNIT).toBe('ⅈ');
    expect(IMAGINARY_UNIT).not.toBe('i');
  });

  test('mathjs parses the glyph as its own SymbolNode, and i stays a variable', () => {
    const iNode = mjs.parse(IMAGINARY_UNIT) as any;
    expect(iNode.type).toBe('SymbolNode');
    expect(iNode.name).toBe(IMAGINARY_UNIT);
    const varNode = mjs.parse('i') as any;
    expect(varNode.type).toBe('SymbolNode');
    expect(varNode.name).toBe('i');
  });

  test('parseEquation accepts the glyph and preserves it (no NFKC collapse)', () => {
    const eq = parseEquation(`x = ${IMAGINARY_UNIT}`);
    expect(eq.rhs.toString()).toContain(IMAGINARY_UNIT);
    expect(eq.rhs.toString()).not.toBe('i');
  });
});

describe('imaginary unit — treated as a constant, not a solve variable', () => {
  test('getVariables excludes the imaginary unit (like pi / e)', () => {
    const node = mjs.parse(`x + ${IMAGINARY_UNIT}`);
    expect(getVariables(node)).toEqual(['x']);
    const bare = mjs.parse(IMAGINARY_UNIT);
    expect(getVariables(bare)).toEqual([]);
  });

  test('getGraphVariables excludes the imaginary unit', () => {
    const eq = parseEquation(`y = x + ${IMAGINARY_UNIT}`);
    expect(getGraphVariables(eq).sort()).toEqual(['x', 'y']);
  });

  test('isConstantSubtree treats the imaginary unit as constant', () => {
    expect(isConstantSubtree(mjs.parse(IMAGINARY_UNIT))).toBe(true);
    expect(isConstantSubtree(mjs.parse(`2 * ${IMAGINARY_UNIT}`))).toBe(true);
    expect(isConstantSubtree(mjs.parse(`x * ${IMAGINARY_UNIT}`))).toBe(false);
  });

  test('the imaginary unit is not an isolated variable definition', () => {
    // `x = ⅈ` defines x, never ⅈ — the unit is a constant on the RHS.
    const eq = parseEquation(`x = ${IMAGINARY_UNIT}`);
    const def = getIsolatedDefinition(eq);
    expect(def?.variable).toBe('x');
  });
});

describe('imaginary unit — point evaluation', () => {
  test('the token evaluates to the complex value 0 + 1i', () => {
    const val = evaluatePoint(mjs.parse(IMAGINARY_UNIT), {}) as any;
    expect(val.isComplex).toBe(true);
    expect(val.re).toBeCloseTo(0);
    expect(val.im).toBeCloseTo(1);
  });

  test('ⅈ^2 evaluates to -1', () => {
    const val = evaluatePoint(mjs.parse(`${IMAGINARY_UNIT}^2`), {}) as any;
    // -1 may surface as Complex(-1, 0) or a real -1 depending on mathjs coercion.
    const re = val?.isComplex ? val.re : val;
    const im = val?.isComplex ? val.im : 0;
    expect(re).toBeCloseTo(-1);
    expect(im).toBeCloseTo(0);
  });

  test('sqrt of a negative resolves to an imaginary value end-to-end', () => {
    const val = evaluatePoint(mjs.parse('sqrt(-4)'), {}) as any;
    expect(val.isComplex).toBe(true);
    expect(val.re).toBeCloseTo(0);
    expect(val.im).toBeCloseTo(2);
  });
});

describe('imaginary unit — equivalence & value-equality', () => {
  test('x = ⅈ is equivalent to x = sqrt(-1)', () => {
    const a = parseEquation(`x = ${IMAGINARY_UNIT}`);
    const b = parseEquation('x = sqrt(-1)');
    expect(areEquationsEquivalent(a, b)).toBe(true);
  });

  test('x = ⅈ is NOT equivalent to x = 1', () => {
    const a = parseEquation(`x = ${IMAGINARY_UNIT}`);
    const b = parseEquation('x = 1');
    expect(areEquationsEquivalent(a, b)).toBe(false);
  });

  test('2*ⅈ and sqrt(-4) are value-equal expressions', () => {
    const a = mjs.parse(`2 * ${IMAGINARY_UNIT}`);
    const b = mjs.parse('sqrt(-4)');
    expect(areExpressionsValueEqual(a, b)).toBe(true);
  });

  test('interval path falls back safely: x + ⅈ = ⅈ + x holds with the token present', () => {
    // One side identical → the interval solver is exercised; ⅈ makes it throw
    // internally and fall back to point-eval rather than crash. (#105)
    const a = parseEquation(`x + ${IMAGINARY_UNIT} = ${IMAGINARY_UNIT} + x`);
    const b = parseEquation(`x + ${IMAGINARY_UNIT} = ${IMAGINARY_UNIT} + x`);
    expect(areEquationsEquivalent(a, b)).toBe(true);
  });
});
