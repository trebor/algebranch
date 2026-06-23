import { parseEquation } from '../src';
import { equationToSpeech, nodeToSpeech } from '../src/speech';

const speak = (eq: string) => equationToSpeech(parseEquation(eq));

describe('equationToSpeech — readable spoken math (#256)', () => {
  it('reads a power of two as "squared", not "caret 2"', () => {
    expect(speak('x^2 - 9 = 0')).toBe('x squared minus 9 equals 0');
  });

  it('reads a power of three as "cubed"', () => {
    expect(speak('x^3 = 8')).toBe('x cubed equals 8');
  });

  it('reads a higher power as "to the power of N"', () => {
    expect(speak('x^5 = 1')).toBe('x to the power of 5 equals 1');
  });

  it('groups a compound base under a power as "the quantity …"', () => {
    expect(speak('(x + 2)^2 = 9')).toBe('the quantity x plus 2, squared equals 9');
  });

  it('reads sqrt as "the square root of"', () => {
    expect(speak('sqrt(x + 1) = 3')).toBe('the square root of x plus 1 equals 3');
  });

  it('reads an explicit cube root', () => {
    expect(speak('nthRoot(x, 3) = 2')).toBe('the cube root of x equals 2');
  });

  it('reads a simple fraction as "a over b"', () => {
    expect(speak('a/b = c')).toBe('a over b equals c');
  });

  it('reads a compound fraction with numerator/denominator framing', () => {
    expect(speak('(x + 1)/2 = 5')).toBe(
      'the fraction with numerator x plus 1 and denominator 2 equals 5',
    );
  });

  it('reads unary minus as "negative"', () => {
    expect(speak('-x = 5')).toBe('negative x equals 5');
  });

  it('reads multiplication as "times" and addition as "plus"', () => {
    expect(speak('2*x + 3 = 7')).toBe('2 times x plus 3 equals 7');
  });

  it('reads trig functions by full name', () => {
    expect(speak('sin(x) = 0')).toBe('sine of x equals 0');
  });

  it('reads natural log', () => {
    expect(speak('ln(x) = 1')).toBe('natural log of x equals 1');
  });

  it('reads each relation operator', () => {
    expect(speak('x < 5')).toBe('x is less than 5');
    expect(speak('x > 5')).toBe('x is greater than 5');
    expect(speak('x <= 2')).toBe('x is less than or equal to 2');
    expect(speak('x >= 2')).toBe('x is greater than or equal to 2');
  });

  it('reads subscripts as "sub"', () => {
    expect(speak('v_0 = 9')).toBe('v sub 0 equals 9');
  });

  it('reads spelled-out Greek names verbatim', () => {
    expect(speak('theta = pi')).toBe('theta equals pi');
  });

  it('groups both factors of a product of sums', () => {
    expect(speak('(x + 1)*(x - 1) = 0')).toBe(
      'the quantity x plus 1, times the quantity x minus 1 equals 0',
    );
  });

  it('groups the right operand of a subtraction by a sum', () => {
    expect(speak('a - (b + c) = 0')).toBe('a minus the quantity b plus c equals 0');
  });
});

describe('nodeToSpeech — single subtree for per-term aria-labels (#256)', () => {
  const node = (eq: string) => parseEquation(eq).lhs;

  it('speaks a bare power term', () => {
    expect(nodeToSpeech(node('x^2 = 0'))).toBe('x squared');
  });

  it('strips a trailing grouping comma at the term boundary', () => {
    expect(nodeToSpeech(node('a*(b + c) = 0'))).toBe('a times the quantity b plus c');
  });

  it('speaks a sqrt term', () => {
    expect(nodeToSpeech(node('sqrt(x) = 0'))).toBe('the square root of x');
  });
});
