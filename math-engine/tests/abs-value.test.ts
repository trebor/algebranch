import * as math from 'mathjs';
import { parseEquation, equationToString, createInterval } from '../src';
import { equationToLatex, equationToUnicode } from '../src/serialize';
import { equationToSpeech } from '../src/speech';
import { evaluatePoint, evaluateInterval, areEquationsEquivalent } from '../src/validator';
import { HIGH_SCHOOL_IDENTITIES } from '../src/rules';
import { matchPattern, instantiatePattern } from '../src/matcher';
import { replaceNodeAtPath } from '../src/tree';

const cleanString = (node: math.MathNode) => node.toString().replace(/\s+/g, '');

describe('Absolute value operator (#179)', () => {
  describe('1. Parser whitelist', () => {
    it('parses abs(x) as an allowed unary function', () => {
      const eq = parseEquation('abs(x) = 5');
      expect(equationToString(eq)).toBe('abs(x) = 5');
    });

    it('parses abs of a compound argument', () => {
      expect(() => parseEquation('abs(x - 3) = 2')).not.toThrow();
    });
  });

  describe('2. evaluatePoint (equivalence gate)', () => {
    it('evaluates abs of a negative real', () => {
      const node = math.parse('abs(x)');
      expect(evaluatePoint(node, { x: -3 })).toBe(3);
      expect(evaluatePoint(node, { x: 4 })).toBe(4);
      expect(evaluatePoint(node, { x: 0 })).toBe(0);
    });

    it('evaluates abs of a complex value to its real magnitude', () => {
      // |3 + 4i| = 5
      const node = math.parse('abs(3 + 4 * i)');
      // engine imaginary unit token differs; use a complex scope value instead
      const complexNode = math.parse('abs(z)');
      const z = math.complex(3, 4) as unknown as number;
      expect(Number(evaluatePoint(complexNode, { z }))).toBeCloseTo(5);
      expect(node).toBeDefined();
    });

    it('treats abs(x) and sqrt(x^2) as equivalent over the reals', () => {
      const eqA = parseEquation('abs(x) = y');
      const eqB = parseEquation('sqrt(x^2) = y');
      expect(areEquationsEquivalent(eqA, eqB)).toBe(true);
    });
  });

  describe('3. evaluateInterval', () => {
    it('collapses a straddling interval to [0, max|endpoint|]', () => {
      const node = math.parse('abs(x)');
      const out = evaluateInterval(node, { x: createInterval(-5, 2) });
      expect(out.min).toBe(0);
      expect(out.max).toBe(5);
    });

    it('maps a wholly-negative interval to positive', () => {
      const node = math.parse('abs(x)');
      const out = evaluateInterval(node, { x: createInterval(-5, -2) });
      expect(out.min).toBe(2);
      expect(out.max).toBe(5);
    });

    it('is the identity on a wholly-positive interval', () => {
      const node = math.parse('abs(x)');
      const out = evaluateInterval(node, { x: createInterval(2, 5) });
      expect(out.min).toBe(2);
      expect(out.max).toBe(5);
    });
  });

  describe('4. Serialize as |…|', () => {
    it('renders unicode bars', () => {
      expect(equationToUnicode(parseEquation('abs(x) = 5'))).toBe('|x| = 5');
    });

    it('renders unicode bars around a compound argument', () => {
      expect(equationToUnicode(parseEquation('abs(x - 3) = 2'))).toBe('|x − 3| = 2');
    });

    it('renders LaTeX \\left|…\\right|', () => {
      expect(equationToLatex(parseEquation('abs(x) = 5'))).toBe('\\left|x\\right| = 5');
    });
  });

  describe('6. Speech (TTS)', () => {
    it('speaks abs as "the absolute value of …"', () => {
      expect(equationToSpeech(parseEquation('abs(x) = 5'))).toBe('the absolute value of x equals 5');
    });
  });

  describe('7. Rewrite rules', () => {
    const RULE_CASES = [
      { ruleId: 'abs_product', input: 'abs(x * y)', expected: 'abs(x)*abs(y)' },
      { ruleId: 'abs_product_reverse', input: 'abs(x) * abs(y)', expected: 'abs(x*y)' },
      { ruleId: 'abs_quotient', input: 'abs(x / y)', expected: 'abs(x)/abs(y)' },
      { ruleId: 'abs_quotient_reverse', input: 'abs(x) / abs(y)', expected: 'abs(x/y)' },
      { ruleId: 'abs_square', input: 'abs(x)^2', expected: 'x^2' },
      { ruleId: 'abs_of_sqrt_square', input: 'sqrt(x^2)', expected: 'abs(x)' },
      { ruleId: 'abs_as_sqrt_square', input: 'abs(x)', expected: 'sqrt(x^2)' },
    ];

    RULE_CASES.forEach(({ ruleId, input, expected }) => {
      it(`rule [${ruleId}] rewrites ${input} → ${expected} equivalently`, () => {
        const rule = HIGH_SCHOOL_IDENTITIES.find((r) => r.id === ruleId);
        expect(rule).toBeDefined();
        const activeRule = rule!;

        const targetNode = math.parse(input);
        const bindings = matchPattern(activeRule.sourcePattern, targetNode);
        expect(bindings).not.toBeNull();

        const rewritten = instantiatePattern(activeRule.targetPattern, bindings!);
        expect(cleanString(rewritten)).toBe(expected);

        const eqSource = parseEquation(`${input} = 10`);
        const eqTarget = replaceNodeAtPath(eqSource, 'lhs', rewritten);
        expect(areEquationsEquivalent(eqSource, eqTarget)).toBe(true);
      });
    });
  });
});
