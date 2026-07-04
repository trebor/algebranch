import {
  normalizeMathInput,
  parseEquation,
  equationToString,
  equationToLatex,
  equationToUnicode,
} from '../src/index';

/**
 * Smart-input normalization (#398): LaTeX / Unicode-math / SymPy dialects should
 * normalize to the engine's canonical infix before parsing, so pasting an
 * equation from a `.tex` file, a chat message, or Python "just works".
 *
 * Most cases assert *end-to-end equivalence*: the smart input must parse to the
 * same canonical `equationToString` as its hand-written plain form. That tests
 * the real goal without pinning brittle intermediate-string details.
 */

/** `smart` and `plain` must parse to the identical canonical equation string. */
const expectEquivalent = (smart: string, plain: string) => {
  expect(equationToString(parseEquation(smart))).toBe(equationToString(parseEquation(plain)));
};

describe('normalizeMathInput — LaTeX', () => {
  test('\\frac and \\sqrt and greek function', () => {
    expectEquivalent('\\frac{x}{2} + \\sqrt{y} = \\sin(\\theta)', '(x)/2 + sqrt(y) = sin(theta)');
  });
  test('\\sqrt[n]{A} → nthRoot', () => {
    expectEquivalent('\\sqrt[3]{x} = 2', 'nthRoot(x, 3) = 2');
  });
  test('braced exponent ^{...}', () => {
    expectEquivalent('x^{2} - 4 = 0', 'x^2 - 4 = 0');
  });
  test('\\cdot and \\times → *', () => {
    expectEquivalent('a \\cdot b = c \\times d', 'a * b = c * d');
  });
  test('nested \\frac survives brace matching', () => {
    // The inner fraction must stay grouped as the numerator of the outer one.
    expect(equationToString(parseEquation('\\frac{\\frac{a}{b}}{c} = 1'))).toBe('(a / b) / c = 1');
  });
  test('\\left \\right delimiters are stripped', () => {
    expectEquivalent('\\left(a + b\\right) / 2 = c', '(a + b) / 2 = c');
  });
});

describe('normalizeMathInput — Unicode math', () => {
  test('superscript power', () => {
    expectEquivalent('x² - 4x = 0', 'x^2 - 4x = 0');
  });
  test('√ radical', () => {
    expectEquivalent('√x + 1 = 2', 'sqrt(x) + 1 = 2');
  });
  test('÷ and × operator glyphs', () => {
    expectEquivalent('6 ÷ 2 = 2 × x', '6 / 2 = 2 * x');
  });
  test('greek letter glyphs', () => {
    expectEquivalent('θ = π', 'theta = pi');
  });
  test('unicode minus U+2212', () => {
    expectEquivalent('x − 4 = 0', 'x - 4 = 0');
  });
});

describe('normalizeMathInput — Python / SymPy', () => {
  test('** → ^ and == → =', () => {
    expectEquivalent('x**2 == 0', 'x^2 = 0');
  });
  test('mixed pythonic expression', () => {
    expectEquivalent('x**2 - 4 == 0', 'x^2 - 4 = 0');
  });
});

describe('copy/export forms round-trip back through the parser', () => {
  // The invariant: anything the tree lets you *copy out* (plain, LaTeX, or
  // Unicode — see equationToFormat / #46) must paste back into the equation
  // input and parse to the same equation. Guards the "copy → paste → same math"
  // goal across every export format.
  const equations = [
    'x^2 - 4 * x = 0',
    'nthRoot(x, 3) = 2', // ³√(x) in Unicode — the reported regression
    'sqrt(x + 1) = 2',
    '(a + b) / 2 = c',
    'x^2 / 4 = 1',
    'sin(theta) = 1 / 2', // greek symbol + function
    '2 * (x + 3) = 10',
    'x^(1 / 2) = y', // non-integer exponent → `^(…)` in Unicode
  ];

  for (const src of equations) {
    test(src, () => {
      const eq = parseEquation(src);
      const canonical = equationToString(eq);
      for (const render of [equationToString, equationToLatex, equationToUnicode]) {
        const copied = render(eq);
        expect(equationToString(parseEquation(copied))).toBe(canonical);
      }
    });
  }
});

describe('normalizeMathInput — no-op & guardrails', () => {
  test('plain canonical infix passes through byte-identical', () => {
    const plain = 'x^2 - 9 = 0';
    expect(normalizeMathInput(plain)).toBe(plain);
  });
  test('imaginary unit ⅈ (U+2148) is preserved, never lowercased to ASCII i', () => {
    expect(normalizeMathInput('x = ⅈ')).toBe('x = ⅈ');
  });
  test('idempotent across all dialects', () => {
    const inputs = [
      '\\frac{x}{2} + \\sqrt{y} = \\sin(\\theta)',
      'x² - 4x = 0',
      'x**2 == 0',
      'x^2 - 9 = 0',
    ];
    for (const s of inputs) {
      const once = normalizeMathInput(s);
      expect(normalizeMathInput(once)).toBe(once);
    }
  });
});
