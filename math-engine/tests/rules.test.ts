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

  test('should factor exponent out of product (a^3 * b^3)', () => {
    const rule = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'exponent_power_of_product_reverse')!;
    expect(rule).toBeDefined();

    const target = math.parse('a^3 * b^3');
    const bindings = matchPattern(rule.sourcePattern, target);
    expect(bindings).not.toBeNull();
    expect(bindings?.['_x']?.toString()).toBe('a');
    expect(bindings?.['_y']?.toString()).toBe('b');
    expect(bindings?.['_A']?.toString()).toBe('3');

    const rewritten = instantiatePattern(rule.targetPattern, bindings!);
    expect(cleanString(rewritten)).toBe('(a*b)^3');
  });

  test('should distribute exponent to quotient ((a / b)^3)', () => {
    const rule = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'exponent_power_of_quotient')!;
    expect(rule).toBeDefined();

    const target = math.parse('(a / b)^3');
    const bindings = matchPattern(rule.sourcePattern, target);
    expect(bindings).not.toBeNull();
    expect(bindings?.['_x']?.toString()).toBe('a');
    expect(bindings?.['_y']?.toString()).toBe('b');
    expect(bindings?.['_A']?.toString()).toBe('3');

    const rewritten = instantiatePattern(rule.targetPattern, bindings!);
    expect(cleanString(rewritten)).toBe('a^3/b^3');
  });

  test('should factor exponent out of quotient (a^3 / b^3)', () => {
    const rule = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'exponent_power_of_quotient_reverse')!;
    expect(rule).toBeDefined();

    const target = math.parse('a^3 / b^3');
    const bindings = matchPattern(rule.sourcePattern, target);
    expect(bindings).not.toBeNull();
    expect(bindings?.['_x']?.toString()).toBe('a');
    expect(bindings?.['_y']?.toString()).toBe('b');
    expect(bindings?.['_A']?.toString()).toBe('3');

    const rewritten = instantiatePattern(rule.targetPattern, bindings!);
    expect(cleanString(rewritten)).toBe('(a/b)^3');
  });

  test('should expand log of product and condense it back', () => {
    const forwardRule = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'log_product')!;
    const reverseRule = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'log_product_reverse')!;
    expect(forwardRule).toBeDefined();
    expect(reverseRule).toBeDefined();

    // Forward: log(x * y) -> log(x) + log(y)
    const targetForward = math.parse('log(x * y)');
    const bindingsF = matchPattern(forwardRule.sourcePattern, targetForward);
    expect(bindingsF).not.toBeNull();
    const expanded = instantiatePattern(forwardRule.targetPattern, bindingsF!);
    expect(cleanString(expanded)).toBe('log(x)+log(y)');

    // Reverse: log(x) + log(y) -> log(x * y)
    const bindingsR = matchPattern(reverseRule.sourcePattern, expanded);
    expect(bindingsR).not.toBeNull();
    const condensed = instantiatePattern(reverseRule.targetPattern, bindingsR!);
    expect(cleanString(condensed)).toBe('log(x*y)');
  });

  test('should condense log difference using reverse quotient rule', () => {
    const rule = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'log_quotient_reverse')!;
    expect(rule).toBeDefined();

    const target = math.parse('log(a) - log(b)');
    const bindings = matchPattern(rule.sourcePattern, target);
    expect(bindings).not.toBeNull();
    const rewritten = instantiatePattern(rule.targetPattern, bindings!);
    expect(cleanString(rewritten)).toBe('log(a/b)');
  });

  test('should condense log power using reverse power rule', () => {
    const rule = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'log_power_reverse')!;
    expect(rule).toBeDefined();

    const target = math.parse('3 * log(z)');
    const bindings = matchPattern(rule.sourcePattern, target);
    expect(bindings).not.toBeNull();
    const rewritten = instantiatePattern(rule.targetPattern, bindings!);
    expect(cleanString(rewritten)).toBe('log(z^3)');
  });

  test('should match and verify tangent quotient identity (tan(x) -> sin(x)/cos(x))', () => {
    const { parseEquation, replaceNodeAtPath, areEquationsEquivalent } = require('../src');
    const eq = parseEquation('tan(x) = y');
    const rule = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'trig_tan_def')!;
    expect(rule).toBeDefined();

    const bindings = matchPattern(rule.sourcePattern, eq.lhs);
    expect(bindings).not.toBeNull();
    expect(bindings?.['_theta']?.toString()).toBe('x');

    const rewritten = instantiatePattern(rule.targetPattern, bindings!);
    const newEq = replaceNodeAtPath(eq, 'lhs', rewritten);
    expect(areEquationsEquivalent(eq, newEq)).toBe(true);
  });

  test('should match and verify reverse tangent quotient identity (sin(x)/cos(x) -> tan(x))', () => {
    const { parseEquation, replaceNodeAtPath, areEquationsEquivalent } = require('../src');
    const eq = parseEquation('sin(x)/cos(x) = y');
    const rule = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'trig_tan_def_reverse')!;
    expect(rule).toBeDefined();

    const bindings = matchPattern(rule.sourcePattern, eq.lhs);
    expect(bindings).not.toBeNull();
    expect(bindings?.['_theta']?.toString()).toBe('x');

    const rewritten = instantiatePattern(rule.targetPattern, bindings!);
    const newEq = replaceNodeAtPath(eq, 'lhs', rewritten);
    expect(areEquationsEquivalent(eq, newEq)).toBe(true);
  });

  test('should match and verify reverse secant identity (1/cos(x) -> sec(x))', () => {
    const { parseEquation, replaceNodeAtPath, areEquationsEquivalent } = require('../src');
    const eq = parseEquation('1/cos(x) = y');
    const rule = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'trig_sec_def_reverse')!;
    expect(rule).toBeDefined();

    const bindings = matchPattern(rule.sourcePattern, eq.lhs);
    expect(bindings).not.toBeNull();
    expect(bindings?.['_theta']?.toString()).toBe('x');

    const rewritten = instantiatePattern(rule.targetPattern, bindings!);
    const newEq = replaceNodeAtPath(eq, 'lhs', rewritten);
    expect(areEquationsEquivalent(eq, newEq)).toBe(true);
  });

  test('should match and verify reverse sum/difference of cubes expansion', () => {
    const { parseEquation, replaceNodeAtPath, areEquationsEquivalent } = require('../src');
    const eq1 = parseEquation('(x + 2) * (x^2 - 2 * x + 2^2) = y');
    const rule1 = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'sum_cubes_expand')!;
    expect(rule1).toBeDefined();

    const bindings1 = matchPattern(rule1.sourcePattern, eq1.lhs);
    expect(bindings1).not.toBeNull();
    const rewritten1 = instantiatePattern(rule1.targetPattern, bindings1!);
    const newEq1 = replaceNodeAtPath(eq1, 'lhs', rewritten1);
    expect(areEquationsEquivalent(eq1, newEq1)).toBe(true);

    const eq2 = parseEquation('(x - 3) * (x^2 + 3 * x + 3^2) = y');
    const rule2 = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'diff_cubes_expand')!;
    expect(rule2).toBeDefined();

    const bindings2 = matchPattern(rule2.sourcePattern, eq2.lhs);
    expect(bindings2).not.toBeNull();
    const rewritten2 = instantiatePattern(rule2.targetPattern, bindings2!);
    const newEq2 = replaceNodeAtPath(eq2, 'lhs', rewritten2);
    expect(areEquationsEquivalent(eq2, newEq2)).toBe(true);
  });

  test('should match and verify reverse exponent rules (splitting exponents)', () => {
    const { parseEquation, replaceNodeAtPath, areEquationsEquivalent } = require('../src');
    
    // Product of Powers Reverse
    const eq1 = parseEquation('x^(a + b) = y');
    const rule1 = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'exponent_product_reverse')!;
    expect(rule1).toBeDefined();
    const bindings1 = matchPattern(rule1.sourcePattern, eq1.lhs);
    expect(bindings1).not.toBeNull();
    const rewritten1 = instantiatePattern(rule1.targetPattern, bindings1!);
    const newEq1 = replaceNodeAtPath(eq1, 'lhs', rewritten1);
    expect(areEquationsEquivalent(eq1, newEq1)).toBe(true);

    // Quotient of Powers Reverse
    const eq2 = parseEquation('x^(a - b) = y');
    const rule2 = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'exponent_quotient_reverse')!;
    expect(rule2).toBeDefined();
    const bindings2 = matchPattern(rule2.sourcePattern, eq2.lhs);
    expect(bindings2).not.toBeNull();
    const rewritten2 = instantiatePattern(rule2.targetPattern, bindings2!);
    const newEq2 = replaceNodeAtPath(eq2, 'lhs', rewritten2);
    expect(areEquationsEquivalent(eq2, newEq2)).toBe(true);

    // Power of a Power Reverse
    const eq3 = parseEquation('x^(a * b) = y');
    const rule3 = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'exponent_power_of_power_reverse')!;
    expect(rule3).toBeDefined();
    const bindings3 = matchPattern(rule3.sourcePattern, eq3.lhs);
    expect(bindings3).not.toBeNull();
    const rewritten3 = instantiatePattern(rule3.targetPattern, bindings3!);
    const newEq3 = replaceNodeAtPath(eq3, 'lhs', rewritten3);
    expect(areEquationsEquivalent(eq3, newEq3)).toBe(true);

    // Negative Exponent Reverse
    const eq4 = parseEquation('1 / x^3 = y');
    const rule4 = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'exponent_negative_reverse')!;
    expect(rule4).toBeDefined();
    const bindings4 = matchPattern(rule4.sourcePattern, eq4.lhs);
    expect(bindings4).not.toBeNull();
    const rewritten4 = instantiatePattern(rule4.targetPattern, bindings4!);
    const newEq4 = replaceNodeAtPath(eq4, 'lhs', rewritten4);
    expect(areEquationsEquivalent(eq4, newEq4)).toBe(true);
  });

  test('should match and verify reverse double angle sine identity', () => {
    const { parseEquation, replaceNodeAtPath, areEquationsEquivalent } = require('../src');
    const eq = parseEquation('2 * sin(x) * cos(x) = y');
    const rule = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === 'trig_double_sin_reverse')!;
    expect(rule).toBeDefined();

    const bindings = matchPattern(rule.sourcePattern, eq.lhs);
    expect(bindings).not.toBeNull();
    expect(bindings?.['_theta']?.toString()).toBe('x');

    const rewritten = instantiatePattern(rule.targetPattern, bindings!);
    const newEq = replaceNodeAtPath(eq, 'lhs', rewritten);
    expect(areEquationsEquivalent(eq, newEq)).toBe(true);
  });
});
