import { formatNumber } from '../src/index';

describe('formatNumber utility', () => {
  test('formats integers correctly', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(123)).toBe('123');
    expect(formatNumber(-456)).toBe('-456');
  });

  test('formats reasonably sized decimals with up to 2 decimal places', () => {
    expect(formatNumber(1.23)).toBe('1.23');
    expect(formatNumber(1.234)).toBe('1.23');
    expect(formatNumber(1.236)).toBe('1.24');
    expect(formatNumber(-1.236)).toBe('-1.24');
    expect(formatNumber(1.2)).toBe('1.2');
    expect(formatNumber(0.005)).toBe('0.01');
    expect(formatNumber(0.001)).toBe('0'); // 0.001 rounds to 0.00 if max 2 decimal places?
    // Wait, let's check: 0.001 >= 0.001, so it is in the range absVal < 1e-3 (which is < 0.001).
    // So 0.001 goes to the bottom: Math.round(0.001 * 100) / 100 = 0.
    expect(formatNumber(0.0012)).toBe('0');
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
