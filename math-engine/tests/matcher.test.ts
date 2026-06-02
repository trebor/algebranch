import * as math from 'mathjs';
import { matchPattern, instantiatePattern, tryExpressAsPower, WildcardBindings } from '../src/matcher';

const parse = (str: string) => math.parse(str);
const cleanString = (node: math.MathNode) => node.toString().replace(/\s+/g, '');

describe('Algebraic Pattern Matcher', () => {
  describe('Basic Match Cases', () => {
    test('should match exact constants', () => {
      const pattern = parse('2');
      const target = parse('2');
      const bindings = matchPattern(pattern, target);
      expect(bindings).not.toBeNull();
      expect(Object.keys(bindings || {})).toHaveLength(0);
    });

    test('should not match different constants', () => {
      const pattern = parse('2');
      const target = parse('3');
      const bindings = matchPattern(pattern, target);
      expect(bindings).toBeNull();
    });

    test('should bind simple wildcard variables', () => {
      const pattern = parse('_A + _B');
      const target = parse('x + y');
      const bindings = matchPattern(pattern, target);
      expect(bindings).not.toBeNull();
      expect(bindings?.['_A']?.toString()).toBe('x');
      expect(bindings?.['_B']?.toString()).toBe('y');
    });

    test('should match repeated wildcards correctly', () => {
      const pattern = parse('_A * _A');
      const target = parse('x * x');
      const bindings = matchPattern(pattern, target);
      expect(bindings).not.toBeNull();
      expect(bindings?.['_A']?.toString()).toBe('x');
    });

    test('should reject mismatched repeated wildcards', () => {
      const pattern = parse('_A * _A');
      const target = parse('x * y');
      const bindings = matchPattern(pattern, target);
      expect(bindings).toBeNull();
    });
  });

  describe('Commutative Matching', () => {
    test('should match commutative addition order 1', () => {
      const pattern = parse('_A + _B');
      const target = parse('x + y');
      const bindings = matchPattern(pattern, target);
      expect(bindings).not.toBeNull();
      const a = bindings?.['_A']?.toString();
      const b = bindings?.['_B']?.toString();
      expect((a === 'x' && b === 'y') || (a === 'y' && b === 'x')).toBe(true);
    });

    test('should match commutative addition order 2', () => {
      const pattern = parse('_A + _B');
      const target = parse('y + x');
      const bindings = matchPattern(pattern, target);
      expect(bindings).not.toBeNull();
      const a = bindings?.['_A']?.toString();
      const b = bindings?.['_B']?.toString();
      expect((a === 'x' && b === 'y') || (a === 'y' && b === 'x')).toBe(true);
    });

    test('should match commutative multiplication', () => {
      const pattern = parse('_A * _B');
      const target = parse('3 * x');
      const bindings = matchPattern(pattern, target);
      expect(bindings).not.toBeNull();
      const a = bindings?.['_A']?.toString();
      const b = bindings?.['_B']?.toString();
      expect((a === 'x' && b === '3') || (a === '3' && b === 'x')).toBe(true);
    });
  });

  describe('Nested and Identity Matches', () => {
    test('should match difference of squares pattern', () => {
      const pattern = parse('_A^2 - _B^2');
      const target = parse('x^2 - 3^2');
      const bindings = matchPattern(pattern, target);
      expect(bindings).not.toBeNull();
      expect(bindings?.['_A']?.toString()).toBe('x');
      expect(bindings?.['_B']?.toString()).toBe('3');
    });

    test('should match nested subtrees in wildcards', () => {
      const pattern = parse('_A^2 - _B^2');
      const target = parse('(x + 1)^2 - y^2');
      const bindings = matchPattern(pattern, target);
      expect(bindings).not.toBeNull();
      expect(cleanString(bindings?.['_A']!)).toBe('(x+1)');
      expect(bindings?.['_B']?.toString()).toBe('y');
    });

    test('should match trig identities', () => {
      const pattern = parse('sin(_theta)^2 + cos(_theta)^2');
      const target = parse('sin(x)^2 + cos(x)^2');
      const bindings = matchPattern(pattern, target);
      expect(bindings).not.toBeNull();
      expect(bindings?.['_theta']?.toString()).toBe('x');
    });

    test('should reject mismatched trig identity arguments', () => {
      const pattern = parse('sin(_theta)^2 + cos(_theta)^2');
      const target = parse('sin(x)^2 + cos(y)^2');
      const bindings = matchPattern(pattern, target);
      expect(bindings).toBeNull();
    });
  });

  describe('AST Instantiation', () => {
    test('should instantiate simple rewrite pattern', () => {
      const pattern = parse('(_A - _B) * (_A + _B)');
      const bindings: WildcardBindings = {
        '_A': parse('x'),
        '_B': parse('3')
      };
      const result = instantiatePattern(pattern, bindings);
      expect(cleanString(result)).toBe('(x-3)*(x+3)');
    });

    test('should instantiate nested subtrees', () => {
      const pattern = parse('(_A - _B) * (_A + _B)');
      const bindings: WildcardBindings = {
        '_A': parse('x + 1'),
        '_B': parse('y')
      };
      const result = instantiatePattern(pattern, bindings);
      expect(cleanString(result)).toBe('(x+1-y)*(x+1+y)');
    });
  });

  describe('Perfect Power Constant Matching', () => {
    test('should express 9 as 3^2', () => {
      const target = parse('9');
      const result = tryExpressAsPower(target);
      expect(result).not.toBeNull();
      expect(result?.toString()).toBe('3 ^ 2');
    });

    test('should express 8 as 2^3', () => {
      const target = parse('8');
      const result = tryExpressAsPower(target);
      expect(result).not.toBeNull();
      expect(result?.toString()).toBe('2 ^ 3');
    });

    test('should return null for non-perfect square constant 7', () => {
      const target = parse('7');
      const result = tryExpressAsPower(target);
      expect(result).toBeNull();
    });

    test('should return null for non-constant variables', () => {
      const target = parse('x');
      const result = tryExpressAsPower(target);
      expect(result).toBeNull();
    });
  });
});
