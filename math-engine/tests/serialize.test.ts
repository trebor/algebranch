import { parseEquation } from '../src';
import {
  equationToLatex,
  equationToLatexAligned,
  equationToUnicode,
  escapeLatexText,
  GREEK_UNICODE,
} from '../src/serialize';

const latex = (eq: string) => equationToLatex(parseEquation(eq));
const unicode = (eq: string) => equationToUnicode(parseEquation(eq));

describe('equationToLatex (bare, no $ delimiters)', () => {
  it('renders powers with braced exponents', () => {
    expect(latex('x^2 = 9')).toBe('x^{2} = 9');
  });

  it('renders division as \\frac with no inner parens', () => {
    expect(latex('(x - 9)/4 = 0')).toBe('\\frac{x - 9}{4} = 0');
  });

  it('combines power and fraction', () => {
    expect(latex('x^2 - 9/4 = 5')).toBe('x^{2} - \\frac{9}{4} = 5');
  });

  it('renders multiplication with \\cdot and precedence parens', () => {
    expect(latex('(x - 3)*(x + 3) = 0')).toBe('\\left(x - 3\\right) \\cdot \\left(x + 3\\right) = 0');
  });

  it('renders sqrt and nthRoot', () => {
    expect(latex('sqrt(x + 1) = 3')).toBe('\\sqrt{x + 1} = 3');
    expect(latex('nthRoot(x, 3) = 2')).toBe('\\sqrt[3]{x} = 2');
  });

  it('renders functions with \\left( \\right)', () => {
    expect(latex('sin(x) = 0')).toBe('\\sin\\left(x\\right) = 0');
    expect(latex('ln(x) = 1')).toBe('\\ln\\left(x\\right) = 1');
  });

  it('maps Greek symbol names to commands', () => {
    expect(latex('theta - alpha = 0')).toBe('\\theta - \\alpha = 0');
  });

  it('maps inequality relations', () => {
    expect(latex('x <= 5')).toBe('x \\le 5');
  });

  it('renders unary minus', () => {
    expect(latex('-x = 0')).toBe('-x = 0');
  });

  it('rounds long irrational constants via formatNumber', () => {
    // 1.4142135623730951 has > 12 fractional digits -> rounded to 1.41
    expect(latex('x = 1.4142135623730951')).toBe('x = 1.41');
  });
});

describe('equationToLatexAligned (rows for an aligned block)', () => {
  it('splits at the relation with an alignment tab and no annotation', () => {
    expect(equationToLatexAligned(parseEquation('x^2 = 9'))).toBe('x^{2} &= 9');
  });

  it('aligns inequality relations', () => {
    expect(equationToLatexAligned(parseEquation('x <= 5'))).toBe('x &\\le 5');
  });

  it('appends a justification in a second alignment column, escaped', () => {
    expect(equationToLatexAligned(parseEquation('x = 4'), 'express 4 as square: 2 ^ 2')).toBe(
      'x &= 4 && \\text{express 4 as square: 2 \\textasciicircum{} 2}',
    );
  });
});

describe('escapeLatexText', () => {
  it('neutralises a bare caret', () => {
    expect(escapeLatexText('2 ^ 2')).toBe('2 \\textasciicircum{} 2');
  });

  it('converts unicode math glyphs to math-mode islands', () => {
    expect(escapeLatexText('x ≠ 0')).toBe('x $\\neq$ 0');
  });

  it('escapes TeX specials', () => {
    expect(escapeLatexText('a & b_c 50%')).toBe('a \\& b\\_c 50\\%');
  });
});

describe('equationToUnicode', () => {
  it('renders integer powers as superscripts', () => {
    expect(unicode('x^2 = 9')).toBe('x² = 9');
  });

  it('superscripts a parenthesized base', () => {
    expect(unicode('(x + 1)^2 = 0')).toBe('(x + 1)² = 0');
  });

  it('falls back to ^(...) for non-integer exponents', () => {
    expect(unicode('x^(a + 1) = 0')).toBe('x^(a + 1) = 0');
  });

  it('renders inline division with precedence parens', () => {
    expect(unicode('(x - 9)/4 = 0')).toBe('(x − 9)/4 = 0');
  });

  it('uses the display minus glyph and superscript together', () => {
    expect(unicode('x^2 - 9/4 = 5')).toBe('x² − 9/4 = 5');
  });

  it('uses the display multiply glyph', () => {
    expect(unicode('(x - 3)*(x + 3) = 0')).toBe('(x − 3) ⋅ (x + 3) = 0');
  });

  it('renders sqrt, wrapping only non-atomic arguments', () => {
    expect(unicode('sqrt(5) = y')).toBe('√5 = y');
    expect(unicode('sqrt(x + 1) = 3')).toBe('√(x + 1) = 3');
  });

  it('renders nthRoot with a superscript index', () => {
    expect(unicode('nthRoot(x, 3) = 2')).toBe('³√(x) = 2');
  });

  it('maps Greek symbol names to glyphs', () => {
    expect(unicode('theta - alpha = 0')).toBe('θ − α = 0');
  });

  it('maps inequality relations', () => {
    expect(unicode('x <= 5')).toBe('x ≤ 5');
  });

  it('renders unary minus with the minus glyph', () => {
    expect(unicode('-x = 0')).toBe('−x = 0');
  });
});

describe('GREEK_UNICODE export', () => {
  it('exposes the Greek glyph table for cross-checking against the UI', () => {
    expect(GREEK_UNICODE.theta).toBe('θ');
    expect(GREEK_UNICODE.Omega).toBe('Ω');
  });
});
