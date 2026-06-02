import * as math from 'mathjs';

export interface RewriteRule {
  id: string;
  name: string;
  category: string;
  sourcePatternStr: string;
  targetPatternStr: string;
  sourcePattern: math.MathNode;
  targetPattern: math.MathNode;
  description: string;
}

interface RawRule {
  id: string;
  name: string;
  category: string;
  sourcePatternStr: string;
  targetPatternStr: string;
  description: string;
}

const RAW_RULES: RawRule[] = [
  // 1. Polynomial & Factoring Identities
  {
    id: 'diff_squares_factor',
    name: 'Factor Difference of Squares',
    category: 'Polynomials & Factoring',
    sourcePatternStr: '_A^2 - _B^2',
    targetPatternStr: '(_A - _B) * (_A + _B)',
    description: 'Factors the difference of two squared terms.',
  },
  {
    id: 'diff_squares_expand',
    name: 'Expand Conjugate Binomials',
    category: 'Polynomials & Factoring',
    sourcePatternStr: '(_A - _B) * (_A + _B)',
    targetPatternStr: '_A^2 - _B^2',
    description: 'Expands conjugate factors into a difference of squares.',
  },
  {
    id: 'perfect_square_factor_plus',
    name: 'Factor Perfect Square (Sum)',
    category: 'Polynomials & Factoring',
    sourcePatternStr: '_A^2 + 2 * _A * _B + _B^2',
    targetPatternStr: '(_A + _B)^2',
    description: 'Factors a trinomial of the form a^2 + 2ab + b^2 into a squared sum.',
  },
  {
    id: 'perfect_square_factor_minus',
    name: 'Factor Perfect Square (Difference)',
    category: 'Polynomials & Factoring',
    sourcePatternStr: '_A^2 - 2 * _A * _B + _B^2',
    targetPatternStr: '(_A - _B)^2',
    description: 'Factors a trinomial of the form a^2 - 2ab + b^2 into a squared difference.',
  },
  {
    id: 'perfect_square_expand_plus',
    name: 'Expand Binomial Square (Sum)',
    category: 'Polynomials & Factoring',
    sourcePatternStr: '(_A + _B)^2',
    targetPatternStr: '_A^2 + 2 * _A * _B + _B^2',
    description: 'Expands a squared sum binomial into trinomial form.',
  },
  {
    id: 'perfect_square_expand_minus',
    name: 'Expand Binomial Square (Difference)',
    category: 'Polynomials & Factoring',
    sourcePatternStr: '(_A - _B)^2',
    targetPatternStr: '_A^2 - 2 * _A * _B + _B^2',
    description: 'Expands a squared difference binomial into trinomial form.',
  },
  {
    id: 'sum_cubes_factor',
    name: 'Factor Sum of Cubes',
    category: 'Polynomials & Factoring',
    sourcePatternStr: '_A^3 + _B^3',
    targetPatternStr: '(_A + _B) * (_A^2 - _A * _B + _B^2)',
    description: 'Factors the sum of two cubed terms.',
  },
  {
    id: 'diff_cubes_factor',
    name: 'Factor Difference of Cubes',
    category: 'Polynomials & Factoring',
    sourcePatternStr: '_A^3 - _B^3',
    targetPatternStr: '(_A - _B) * (_A^2 + _A * _B + _B^2)',
    description: 'Factors the difference of two cubed terms.',
  },

  // 2. Exponent Rules
  {
    id: 'exponent_product',
    name: 'Product of Powers',
    category: 'Exponent Rules',
    sourcePatternStr: '_x^_A * _x^_B',
    targetPatternStr: '_x^(_A + _B)',
    description: 'Combines multiplication of powers sharing the same base.',
  },
  {
    id: 'exponent_quotient',
    name: 'Quotient of Powers',
    category: 'Exponent Rules',
    sourcePatternStr: '_x^_A / _x^_B',
    targetPatternStr: '_x^(_A - _B)',
    description: 'Simplifies division of powers sharing the same base.',
  },
  {
    id: 'exponent_power_of_power',
    name: 'Power of a Power',
    category: 'Exponent Rules',
    sourcePatternStr: '(_x^_A)^_B',
    targetPatternStr: '_x^(_A * _B)',
    description: 'Simplifies a power raised to another exponent.',
  },
  {
    id: 'exponent_power_of_product',
    name: 'Power of a Product',
    category: 'Exponent Rules',
    sourcePatternStr: '(_x * _y)^_A',
    targetPatternStr: '_x^_A * _y^_A',
    description: 'Distributes the exponent to terms inside a product.',
  },
  {
    id: 'exponent_power_of_product_reverse',
    name: 'Factor Exponent Out of Product',
    category: 'Exponent Rules',
    sourcePatternStr: '_x^_A * _y^_A',
    targetPatternStr: '(_x * _y)^_A',
    description: 'Factors a common exponent out of multiplied power terms.',
  },
  {
    id: 'exponent_power_of_quotient',
    name: 'Power of a Quotient',
    category: 'Exponent Rules',
    sourcePatternStr: '(_x / _y)^_A',
    targetPatternStr: '_x^_A / _y^_A',
    description: 'Distributes the exponent to numerator and denominator.',
  },
  {
    id: 'exponent_power_of_quotient_reverse',
    name: 'Factor Exponent Out of Quotient',
    category: 'Exponent Rules',
    sourcePatternStr: '_x^_A / _y^_A',
    targetPatternStr: '(_x / _y)^_A',
    description: 'Factors a common exponent out of divided power terms.',
  },
  {
    id: 'exponent_negative',
    name: 'Negative Exponent Rule',
    category: 'Exponent Rules',
    sourcePatternStr: '_x^-_A',
    targetPatternStr: '1 / _x^_A',
    description: 'Expresses negative powers as reciprocals.',
  },

  // 3. Logarithm Rules
  {
    id: 'log_product',
    name: 'Logarithm Product Rule',
    category: 'Logarithm Rules',
    sourcePatternStr: 'log(_A * _B)',
    targetPatternStr: 'log(_A) + log(_B)',
    description: 'Expands the logarithm of a product into a sum of logarithms.',
  },
  {
    id: 'log_quotient',
    name: 'Logarithm Quotient Rule',
    category: 'Logarithm Rules',
    sourcePatternStr: 'log(_A / _B)',
    targetPatternStr: 'log(_A) - log(_B)',
    description: 'Expands the logarithm of a quotient into a difference of logarithms.',
  },
  {
    id: 'log_power',
    name: 'Logarithm Power Rule',
    category: 'Logarithm Rules',
    sourcePatternStr: 'log(_A^_k)',
    targetPatternStr: '_k * log(_A)',
    description: 'Moves the exponent inside a logarithm to a multiplier coefficient.',
  },
  {
    id: 'log_product_reverse',
    name: 'Logarithm Product Rule (Reverse)',
    category: 'Logarithm Rules',
    sourcePatternStr: 'log(_A) + log(_B)',
    targetPatternStr: 'log(_A * _B)',
    description: 'Condenses the sum of two logarithms into the logarithm of their product.',
  },
  {
    id: 'log_quotient_reverse',
    name: 'Logarithm Quotient Rule (Reverse)',
    category: 'Logarithm Rules',
    sourcePatternStr: 'log(_A) - log(_B)',
    targetPatternStr: 'log(_A / _B)',
    description: 'Condenses the difference of two logarithms into the logarithm of their quotient.',
  },
  {
    id: 'log_power_reverse',
    name: 'Logarithm Power Rule (Reverse)',
    category: 'Logarithm Rules',
    sourcePatternStr: '_k * log(_A)',
    targetPatternStr: 'log(_A^_k)',
    description: 'Moves a multiplier coefficient outside a logarithm to the exponent of the argument.',
  },

  // 4. Trigonometric Identities
  {
    id: 'trig_pythagorean',
    name: 'Pythagorean Identity',
    category: 'Trigonometric Identities',
    sourcePatternStr: 'sin(_theta)^2 + cos(_theta)^2',
    targetPatternStr: '1',
    description: 'Simplifies sin^2 + cos^2 of any angle to 1.',
  },
  {
    id: 'trig_tan_def',
    name: 'Tangent Quotient Identity',
    category: 'Trigonometric Identities',
    sourcePatternStr: 'tan(_theta)',
    targetPatternStr: 'sin(_theta) / cos(_theta)',
    description: 'Expresses tangent as sine divided by cosine.',
  },
  {
    id: 'trig_tan_def_reverse',
    name: 'Tangent Quotient Identity (Reverse)',
    category: 'Trigonometric Identities',
    sourcePatternStr: 'sin(_theta) / cos(_theta)',
    targetPatternStr: 'tan(_theta)',
    description: 'Rewrites sin/cos quotient as tangent.',
  },
  {
    id: 'trig_sec_def',
    name: 'Secant Reciprocal Identity',
    category: 'Trigonometric Identities',
    sourcePatternStr: 'sec(_theta)',
    targetPatternStr: '1 / cos(_theta)',
    description: 'Expresses secant as the reciprocal of cosine.',
  },
  {
    id: 'trig_sec_def_reverse',
    name: 'Secant Reciprocal Identity (Reverse)',
    category: 'Trigonometric Identities',
    sourcePatternStr: '1 / cos(_theta)',
    targetPatternStr: 'sec(_theta)',
    description: 'Rewrites reciprocal of cosine as secant.',
  },
  {
    id: 'trig_csc_def',
    name: 'Cosecant Reciprocal Identity',
    category: 'Trigonometric Identities',
    sourcePatternStr: 'csc(_theta)',
    targetPatternStr: '1 / sin(_theta)',
    description: 'Expresses cosecant as the reciprocal of sine.',
  },
  {
    id: 'trig_csc_def_reverse',
    name: 'Cosecant Reciprocal Identity (Reverse)',
    category: 'Trigonometric Identities',
    sourcePatternStr: '1 / sin(_theta)',
    targetPatternStr: 'csc(_theta)',
    description: 'Rewrites reciprocal of sine as cosecant.',
  },
  {
    id: 'trig_double_sin',
    name: 'Double Angle Sine',
    category: 'Trigonometric Identities',
    sourcePatternStr: 'sin(2 * _theta)',
    targetPatternStr: '2 * sin(_theta) * cos(_theta)',
    description: 'Expands sine of a double angle.',
  },
];

export const HIGH_SCHOOL_IDENTITIES: RewriteRule[] = RAW_RULES.map((rule) => {
  try {
    return {
      ...rule,
      sourcePattern: math.parse(rule.sourcePatternStr),
      targetPattern: math.parse(rule.targetPatternStr),
    };
  } catch (err) {
    console.error(`Failed to parse rewrite rule patterns for: ${rule.id}`, err);
    throw err;
  }
});
