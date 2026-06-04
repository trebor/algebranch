import * as math from 'mathjs';
import { HIGH_SCHOOL_IDENTITIES } from '../src/rules';
import { matchPattern, instantiatePattern } from '../src/matcher';
import { parseEquation, replaceNodeAtPath, areEquationsEquivalent } from '../src';

const cleanString = (node: math.MathNode) => node.toString().replace(/\s+/g, '');

interface RuleTestCase {
  ruleId: string;
  input: string;
  expected: string;
}

const ALL_RULE_TEST_CASES: RuleTestCase[] = [
  // 1. Polynomials & Factoring
  { ruleId: 'diff_squares_factor', input: 'x^2 - 3^2', expected: '(x-3)*(x+3)' },
  { ruleId: 'diff_squares_expand', input: '(x - 3) * (x + 3)', expected: 'x^2-3^2' },
  { ruleId: 'perfect_square_factor_plus', input: 'x^2 + 2 * x * 3 + 3^2', expected: '(x+3)^2' },
  { ruleId: 'perfect_square_expand_plus', input: '(x + 3)^2', expected: 'x^2+2*x*3+3^2' },
  { ruleId: 'perfect_square_factor_minus', input: 'x^2 - 2 * x * 3 + 3^2', expected: '(x-3)^2' },
  { ruleId: 'perfect_square_expand_minus', input: '(x - 3)^2', expected: 'x^2-2*x*3+3^2' },
  { ruleId: 'sum_cubes_factor', input: 'x^3 + 2^3', expected: '(x+2)*(x^2-x*2+2^2)' },
  { ruleId: 'sum_cubes_expand', input: '(x + 2) * (x^2 - x * 2 + 2^2)', expected: 'x^3+2^3' },
  { ruleId: 'diff_cubes_factor', input: 'x^3 - 2^3', expected: '(x-2)*(x^2+x*2+2^2)' },
  { ruleId: 'diff_cubes_expand', input: '(x - 2) * (x^2 + x * 2 + 2^2)', expected: 'x^3-2^3' },

  // 2. Exponent Rules
  { ruleId: 'exponent_product', input: 'x^2 * x^3', expected: 'x^(2+3)' },
  { ruleId: 'exponent_product_reverse', input: 'x^(2 + 3)', expected: 'x^2*x^3' },
  { ruleId: 'exponent_quotient', input: 'x^5 / x^2', expected: 'x^(5-2)' },
  { ruleId: 'exponent_quotient_reverse', input: 'x^(5 - 2)', expected: 'x^5/x^2' },
  { ruleId: 'exponent_power_of_power', input: '(x^2)^3', expected: 'x^(2*3)' },
  { ruleId: 'exponent_power_of_power_reverse', input: 'x^(2 * 3)', expected: '(x^2)^3' },
  { ruleId: 'exponent_power_of_product', input: '(x * y)^3', expected: 'x^3*y^3' },
  { ruleId: 'exponent_power_of_product_reverse', input: 'x^3 * y^3', expected: '(x*y)^3' },
  { ruleId: 'exponent_power_of_quotient', input: '(x / y)^3', expected: 'x^3/y^3' },
  { ruleId: 'exponent_power_of_quotient_reverse', input: 'x^3 / y^3', expected: '(x/y)^3' },
  { ruleId: 'exponent_negative', input: 'x^-3', expected: '1/x^3' },
  { ruleId: 'exponent_negative_reverse', input: '1 / x^3', expected: 'x^(-3)' },

  // 3. Logarithm Rules
  { ruleId: 'log_product', input: 'log(x * y)', expected: 'log(x)+log(y)' },
  { ruleId: 'log_product_reverse', input: 'log(x) + log(y)', expected: 'log(x*y)' },
  { ruleId: 'log_quotient', input: 'log(x / y)', expected: 'log(x)-log(y)' },
  { ruleId: 'log_quotient_reverse', input: 'log(x) - log(y)', expected: 'log(x/y)' },
  { ruleId: 'log_power', input: 'log(x^3)', expected: '3*log(x)' },
  { ruleId: 'log_power_reverse', input: '3 * log(x)', expected: 'log(x^3)' },

  // 4. Trigonometric Identities
  { ruleId: 'trig_pythagorean', input: 'sin(x)^2 + cos(x)^2', expected: '1' },
  { ruleId: 'trig_tan_def', input: 'tan(x)', expected: 'sin(x)/cos(x)' },
  { ruleId: 'trig_tan_def_reverse', input: 'sin(x) / cos(x)', expected: 'tan(x)' },
  { ruleId: 'trig_sec_def', input: 'sec(x)', expected: '1/cos(x)' },
  { ruleId: 'trig_sec_def_reverse', input: '1 / cos(x)', expected: 'sec(x)' },
  { ruleId: 'trig_csc_def', input: 'csc(x)', expected: '1/sin(x)' },
  { ruleId: 'trig_csc_def_reverse', input: '1 / sin(x)', expected: 'csc(x)' },
  { ruleId: 'trig_double_sin', input: 'sin(2 * x)', expected: '2*sin(x)*cos(x)' },
  { ruleId: 'trig_double_sin_reverse', input: '2 * sin(x) * cos(x)', expected: 'sin(2*x)' },

  // New High School Algebraic and Trig Rules
  { ruleId: 'cube_sum_factor', input: 'x^3 + 3 * x^2 * y + 3 * x * y^2 + y^3', expected: '(x+y)^3' },
  { ruleId: 'cube_sum_expand', input: '(x + y)^3', expected: 'x^3+3*x^2*y+3*x*y^2+y^3' },
  { ruleId: 'cube_diff_factor', input: 'x^3 - 3 * x^2 * y + 3 * x * y^2 - y^3', expected: '(x-y)^3' },
  { ruleId: 'cube_diff_expand', input: '(x - y)^3', expected: 'x^3-3*x^2*y+3*x*y^2-y^3' },
  { ruleId: 'exponent_sqrt', input: 'sqrt(x)', expected: 'x^(1/2)' },
  { ruleId: 'exponent_sqrt_reverse', input: 'x^(1/2)', expected: 'sqrt(x)' },
  { ruleId: 'exponent_nthRoot', input: 'nthRoot(x, n)', expected: 'x^(1/n)' },
  { ruleId: 'exponent_nthRoot_reverse', input: 'x^(1/n)', expected: 'nthRoot(x,n)' },
  { ruleId: 'log_change_base', input: 'log(x, y)', expected: 'log(x)/log(y)' },
  { ruleId: 'log_change_base_reverse', input: 'log(x) / log(y)', expected: 'log(x,y)' },
  { ruleId: 'trig_cot_def', input: 'cot(x)', expected: 'cos(x)/sin(x)' },
  { ruleId: 'trig_cot_def_reverse', input: 'cos(x) / sin(x)', expected: 'cot(x)' },
  { ruleId: 'trig_cot_reciprocal', input: 'cot(x)', expected: '1/tan(x)' },
  { ruleId: 'trig_cot_reciprocal_reverse', input: '1 / tan(x)', expected: 'cot(x)' },
  { ruleId: 'trig_tan_reciprocal', input: 'tan(x)', expected: '1/cot(x)' },
  { ruleId: 'trig_tan_reciprocal_reverse', input: '1 / cot(x)', expected: 'tan(x)' },
  { ruleId: 'trig_pythagorean_cos_sq', input: '1 - sin(x)^2', expected: 'cos(x)^2' },
  { ruleId: 'trig_pythagorean_cos_sq_reverse', input: 'cos(x)^2', expected: '1-sin(x)^2' },
  { ruleId: 'trig_pythagorean_sin_sq', input: '1 - cos(x)^2', expected: 'sin(x)^2' },
  { ruleId: 'trig_pythagorean_sin_sq_reverse', input: 'sin(x)^2', expected: '1-cos(x)^2' },
  { ruleId: 'trig_pythagorean_tan_sec', input: 'tan(x)^2 + 1', expected: 'sec(x)^2' },
  { ruleId: 'trig_pythagorean_tan_sec_reverse', input: 'sec(x)^2 - 1', expected: 'tan(x)^2' },
  { ruleId: 'trig_pythagorean_cot_csc', input: '1 + cot(x)^2', expected: 'csc(x)^2' },
  { ruleId: 'trig_pythagorean_cot_csc_reverse', input: 'csc(x)^2 - 1', expected: 'cot(x)^2' },
  { ruleId: 'trig_double_cos_form1', input: 'cos(2 * x)', expected: 'cos(x)^2-sin(x)^2' },
  { ruleId: 'trig_double_cos_form1_reverse', input: 'cos(x)^2 - sin(x)^2', expected: 'cos(2*x)' },
  { ruleId: 'trig_double_cos_form2', input: 'cos(2 * x)', expected: '2*cos(x)^2-1' },
  { ruleId: 'trig_double_cos_form2_reverse', input: '2 * cos(x)^2 - 1', expected: 'cos(2*x)' },
  { ruleId: 'trig_double_cos_form3', input: 'cos(2 * x)', expected: '1-2*sin(x)^2' },
  { ruleId: 'trig_double_cos_form3_reverse', input: '1 - 2 * sin(x)^2', expected: 'cos(2*x)' },
  { ruleId: 'trig_double_tan', input: 'tan(2 * x)', expected: '(2*tan(x))/(1-tan(x)^2)' },
  { ruleId: 'trig_double_tan_reverse', input: '(2 * tan(x)) / (1 - tan(x)^2)', expected: 'tan(2*x)' },
  { ruleId: 'repeated_addition_2', input: '2 * (x + 3)', expected: '(x+3)+(x+3)' },
  { ruleId: 'repeated_addition_2_right', input: '(x + 3) * 2', expected: '(x+3)+(x+3)' },
  { ruleId: 'repeated_addition_2_reverse', input: '(x + 3) + (x + 3)', expected: '2*(x+3)' }
];

describe('Exhaustive Bidirectional Identity Rules Verification', () => {
  test('should verify existence of test case for every identity in the registry', () => {
    const registryIds = HIGH_SCHOOL_IDENTITIES.map(r => r.id);
    const testIds = ALL_RULE_TEST_CASES.map(tc => tc.ruleId);

    registryIds.forEach(id => {
      expect(testIds).toContain(id);
    });
  });

  ALL_RULE_TEST_CASES.forEach(({ ruleId, input, expected }) => {
    test(`Rule [${ruleId}]: matches input "${input}", instantiates target, and preserves mathematical equivalence`, () => {
      const rule = HIGH_SCHOOL_IDENTITIES.find(r => r.id === ruleId);
      expect(rule).toBeDefined();
      const activeRule = rule!;

      // 1. Parse and match input pattern
      const targetNode = math.parse(input);
      const bindings = matchPattern(activeRule.sourcePattern, targetNode);
      expect(bindings).not.toBeNull();

      // 2. Instantiate and verify rewritten string matches expected representation
      const rewrittenNode = instantiatePattern(activeRule.targetPattern, bindings!);
      expect(cleanString(rewrittenNode)).toBe(expected);

      // 3. Assemble full equations and verify mathematical equivalence
      const eqSource = parseEquation(`${input} = 10`);
      const eqTarget = replaceNodeAtPath(eqSource, 'lhs', rewrittenNode);
      
      const isEquiv = areEquationsEquivalent(eqSource, eqTarget);
      if (!isEquiv) {
        throw new Error(
          `Rule [${ruleId}] produced mathematically non-equivalent rewrite: "${input}" -> "${expected}"`
        );
      }
      expect(isEquiv).toBe(true);
    });
  });
});
