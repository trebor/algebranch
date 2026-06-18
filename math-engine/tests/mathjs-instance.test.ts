// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { mjs, fractionMath } from '../src/mathjs';

// The custom mathjs instance exists to tree-shake the full library out of the
// client bundle (#174). These tests pin the runtime API surface the engine
// actually relies on, so a future trim of the dependency list can't silently
// drop a function the code calls.
describe('custom mathjs instance', () => {
  it('parses, simplifies, and rationalizes expressions', () => {
    expect(mjs.parse('2*x+3').toString()).toBe('2 * x + 3');
    expect(mjs.simplify('x+x').toString()).toBe('2 * x');
    expect(mjs.rationalize('2/(x+1) + 3').toString()).toBe('(3 * x + 5) / (x + 1)');
  });

  it('exposes the node constructors the engine builds trees with', () => {
    expect(new mjs.ConstantNode(5).toString()).toBe('5');
    expect(new mjs.SymbolNode('x').toString()).toBe('x');
    const op = new mjs.OperatorNode('+', 'add', [new mjs.ConstantNode(1), new mjs.SymbolNode('x')]);
    expect(op.toString()).toBe('1 + x');
    expect(new mjs.ParenthesisNode(op).toString()).toBe('(1 + x)');
    expect(new mjs.FunctionNode('sqrt', [new mjs.ConstantNode(4)]).toString()).toBe('sqrt(4)');
  });

  it('exposes the arithmetic/trig helpers the validator uses', () => {
    expect(mjs.abs(-5)).toBe(5);
    expect(mjs.divide(6, 3)).toBe(2);
    expect(mjs.multiply(2, 4)).toBe(8);
    expect(mjs.subtract(5, 2)).toBe(3);
    expect(mjs.add(2, 3)).toBe(5);
    expect(mjs.pow(2, 3)).toBe(8);
    expect(typeof mjs.sqrt).toBe('function');
    expect(typeof mjs.sin).toBe('function');
    expect(typeof mjs.fraction).toBe('function');
  });

  it('fractionMath evaluates constant expressions as exact fractions', () => {
    const v = fractionMath.evaluate('2/12') as { s: bigint; n: bigint; d: bigint; constructor: { name: string } };
    expect(v.constructor.name).toBe('Fraction');
    expect(Number(v.n)).toBe(1);
    expect(Number(v.d)).toBe(6);
  });

  it('mjs keeps the default (non-Fraction) number type', () => {
    expect(mjs.parse('2/12').toString()).toBe('2 / 12');
  });

  it('registers the pi/e constants so evaluating them does not throw', () => {
    expect(mjs.parse('pi').evaluate()).toBeCloseTo(Math.PI);
    expect(mjs.parse('e').evaluate()).toBeCloseTo(Math.E);
  });
});
