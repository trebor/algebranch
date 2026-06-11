import { parseEquation, equationToString } from '../src/index';

describe('parseEquation Strict Whitelist & Validation', () => {
  // 1. Valid equations
  test('accepts valid arithmetic and algebraic equations', () => {
    const valid = [
      'x = 5',
      'y = x ^ 2 - 4',
      '3 * x + 4 = 10',
      'sin(x) + cos(y) = 1',
      '(a + b) / 2 = c',
      'sqrt(x ^ 2 + y ^ 2) = r',
      'nthRoot(x, 3) = 2',
    ];

    valid.forEach((eqStr) => {
      expect(() => parseEquation(eqStr)).not.toThrow();
      const parsed = parseEquation(eqStr);
      expect(equationToString(parsed)).toBe(eqStr);
    });
  });

  // 2. Incomplete or empty sides
  test('rejects empty or whitespace-only sides', () => {
    const invalid = [
      'x =',
      '= y',
      '=',
      '  =  ',
      'x =   ',
      '   = y',
    ];

    invalid.forEach((eqStr) => {
      expect(() => parseEquation(eqStr)).toThrow('Both sides of the equation must be non-empty');
    });
  });

  // 3. Reserved programming keywords
  test('rejects reserved keywords as variable names', () => {
    const reserved = ['undefined', 'null', 'nan', 'infinity', 'true', 'false'];
    
    reserved.forEach((kw) => {
      expect(() => parseEquation(`x = ${kw}`)).toThrow(/reserved keyword|not allowed/);
      expect(() => parseEquation(`${kw} = y`)).toThrow(/reserved keyword|not allowed/);
    });
  });

  // 4. Non-numeric constants
  test('rejects non-numeric constants', () => {
    expect(() => parseEquation('x = "hello"')).toThrow('not allowed as a constant');
    expect(() => parseEquation('x = true')).toThrow('not allowed as a constant');
    expect(() => parseEquation('x = false')).toThrow('not allowed as a constant');
  });

  // 5. Unsupported operators
  test('rejects logical, bitwise, and comparison operators', () => {
    const forbiddenOps = [
      'x and y = 5',
      'x or y = 5',
      'not x = 5',
      'x & y = 5',
      'x | y = 5',
      'x < y = 5',
      'x > y = 5',
      'x == y = 5',
      'x != y = 5',
      '5 cm to m = x',
    ];

    forbiddenOps.forEach((eqStr) => {
      expect(() => parseEquation(eqStr)).toThrow();
    });
  });

  // 6. Unsupported functions
  test('rejects non-whitelisted function names', () => {
    const forbiddenFns = [
      'x = random(1)',
      'x = log10(y)',
      'x = eval("1+1")',
    ];

    forbiddenFns.forEach((eqStr) => {
      expect(() => parseEquation(eqStr)).toThrow(/is not allowed/);
    });
  });
});
