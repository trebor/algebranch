import * as math from 'mathjs';
import { HIGH_SCHOOL_IDENTITIES } from '../src/rules';
import { matchPattern, instantiatePattern } from '../src/matcher';

const cleanString = (node: math.MathNode) => node.toString().replace(/\s+/g, '');

describe('High School Rewrite Identities Tests', () => {
  test('should factor difference of squares (x^2 - 3^2)', () => {
    const rule = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'diff_squares_factor')!;
    expect(rule).toBeDefined();

    const target = math.parse('x^2 - 3^2');
    const bindings = matchPattern(rule.sourcePattern, target);
    expect(bindings).not.toBeNull();
    expect(bindings?.['_A']?.toString()).toBe('x');
    expect(bindings?.['_B']?.toString()).toBe('3');

    const rewritten = instantiatePattern(rule.targetPattern, bindings!);
    expect(cleanString(rewritten)).toBe('(x-3)*(x+3)');
  });

  test('should expand difference of squares back to standard polynomial form', () => {
    const rule = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'diff_squares_expand')!;
    expect(rule).toBeDefined();

    const target = math.parse('(y - 5) * (y + 5)');
    const bindings = matchPattern(rule.sourcePattern, target);
    expect(bindings).not.toBeNull();
    expect(bindings?.['_A']?.toString()).toBe('y');
    expect(bindings?.['_B']?.toString()).toBe('5');

    const rewritten = instantiatePattern(rule.targetPattern, bindings!);
    expect(cleanString(rewritten)).toBe('y^2-5^2');
  });

  test('should simplify Pythagorean trigonometric identity sin(theta)^2 + cos(theta)^2 -> 1', () => {
    const rule = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'trig_pythagorean')!;
    expect(rule).toBeDefined();

    const target = math.parse('sin(x)^2 + cos(x)^2');
    const bindings = matchPattern(rule.sourcePattern, target);
    expect(bindings).not.toBeNull();
    expect(bindings?.['_theta']?.toString()).toBe('x');

    const rewritten = instantiatePattern(rule.targetPattern, bindings!);
    expect(rewritten.toString()).toBe('1');
  });

  test('should factor perfect square sums (x^2 + 2*x*y + y^2)', () => {
    const rule = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'perfect_square_factor_plus')!;
    expect(rule).toBeDefined();

    const target = math.parse('a^2 + 2 * a * b + b^2');
    const bindings = matchPattern(rule.sourcePattern, target);
    expect(bindings).not.toBeNull();
    expect(bindings?.['_A']?.toString()).toBe('a');
    expect(bindings?.['_B']?.toString()).toBe('b');

    const rewritten = instantiatePattern(rule.targetPattern, bindings!);
    expect(cleanString(rewritten)).toBe('(a+b)^2');
  });

  test('should apply product of powers rule', () => {
    const rule = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'exponent_product')!;
    expect(rule).toBeDefined();

    const target = math.parse('x^2 * x^3');
    const bindings = matchPattern(rule.sourcePattern, target);
    expect(bindings).not.toBeNull();
    expect(bindings?.['_x']?.toString()).toBe('x');
    expect(bindings?.['_A']?.toString()).toBe('2');
    expect(bindings?.['_B']?.toString()).toBe('3');

    const rewritten = instantiatePattern(rule.targetPattern, bindings!);
    expect(cleanString(rewritten)).toBe('x^(2+3)');
  });

  test('should factor perfect square sum with constant (a^2 + 2*a*3 + 3^2)', () => {
    const rule = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'perfect_square_factor_plus')!;
    expect(rule).toBeDefined();

    const target = math.parse('a^2 + 2 * a * 3 + 3^2');
    const bindings = matchPattern(rule.sourcePattern, target);
    expect(bindings).not.toBeNull();
    expect(bindings?.['_A']?.toString()).toBe('a');
    expect(bindings?.['_B']?.toString()).toBe('3');

    const rewritten = instantiatePattern(rule.targetPattern, bindings!);
    expect(cleanString(rewritten)).toBe('(a+3)^2');
  });

  test('should match and verify perfect square identity on LHS of equation (a^2 + 2*a*3 + 3^2 = 25)', () => {
    const { parseEquation, replaceNodeAtPath, areEquationsEquivalent } = require('../src');
    const eq = parseEquation('a^2 + 2 * a * 3 + 3^2 = 25');
    const rule = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'perfect_square_factor_plus')!;
    const node = eq.lhs;

    const bindings = matchPattern(rule.sourcePattern, node);
    expect(bindings).not.toBeNull();

    const instantiated = instantiatePattern(rule.targetPattern, bindings!);
    const newEq = replaceNodeAtPath(eq, 'lhs', instantiated);
    
    expect(areEquationsEquivalent(eq, newEq)).toBe(true);
  });
});
