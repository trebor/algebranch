import { formatNumber, parseEquation, equationToString } from '../src/index';

describe('formatNumber utility', () => {
  test('formats integers correctly', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(123)).toBe('123');
    expect(formatNumber(-456)).toBe('-456');
  });

  // #66 Deliverable 5: short, exact decimals are shown verbatim (lossless) —
  // we must never silently truncate a value a user actually typed.
  test('shows short exact decimals verbatim without truncating', () => {
    expect(formatNumber(1.23)).toBe('1.23');
    expect(formatNumber(1.234)).toBe('1.234');
    expect(formatNumber(1.236)).toBe('1.236');
    expect(formatNumber(-1.236)).toBe('-1.236');
    expect(formatNumber(1.2)).toBe('1.2');
    expect(formatNumber(0.005)).toBe('0.005');
    expect(formatNumber(0.0012)).toBe('0.0012');
    // A precise decimal a user might enter (e.g. an approximation of √2)
    // survives in full rather than collapsing to 1.41.
    expect(formatNumber(1.41421356)).toBe('1.41421356');
    expect(formatNumber(3.14159265)).toBe('3.14159265');
  });

  // Long fractional tails — irrational approximations and floating-point noise —
  // are treated as approximations and rounded to 2 decimal places for a clean,
  // compact display (this is what "Evaluate to Decimal" relies on).
  test('rounds long float approximations to 2 decimal places', () => {
    expect(formatNumber(Math.SQRT2)).toBe('1.41'); // 1.4142135623730951
    expect(formatNumber(Math.PI)).toBe('3.14'); // 3.141592653589793
    expect(formatNumber(Math.E)).toBe('2.72'); // 2.718281828459045
    expect(formatNumber(1 / 3)).toBe('0.33'); // 0.3333333333333333
    expect(formatNumber(2 / 3)).toBe('0.67'); // 0.6666666666666666
    expect(formatNumber(0.1 + 0.2)).toBe('0.3'); // 0.30000000000000004 (float noise)
  });

  test('formats extremely small decimals (< 1e-3) in scientific notation', () => {
    // 0.00099 is < 0.001
    expect(formatNumber(0.00099)).toBe('9.9e-4');
    expect(formatNumber(0.000123)).toBe('1.23e-4');
    expect(formatNumber(1e-5)).toBe('1e-5');
    expect(formatNumber(-1e-5)).toBe('-1e-5');
    expect(formatNumber(1.2345e-6)).toBe('1.23e-6');
  });

  test('formats extremely large numbers (>= 1e6) in scientific notation', () => {
    expect(formatNumber(1000000)).toBe('1e6');
    expect(formatNumber(1234567)).toBe('1.23e6');
    expect(formatNumber(-1234567)).toBe('-1.23e6');
    expect(formatNumber(1.23456e7)).toBe('1.23e7');
  });

  test('handles non-numeric and fallback scenarios', () => {
    expect(formatNumber('abc')).toBe('abc');
    expect(formatNumber(null)).toBe('null');
    expect(formatNumber(undefined)).toBe('undefined');
  });
});

describe('decimal precision round-trips through equationToString (#66)', () => {
  test('a precise user-entered decimal is not truncated on display', () => {
    const eq = parseEquation('x = 1.41421356');
    expect(equationToString(eq)).toBe('x = 1.41421356');
  });

  test('short exact decimals round-trip unchanged', () => {
    for (const src of ['y = 0.005', 'z = 1.234', 'a = 3.14159265', 'b = -2.5']) {
      expect(equationToString(parseEquation(src))).toBe(src);
    }
  });
});
