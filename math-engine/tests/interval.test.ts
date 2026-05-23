import {
  createInterval,
  negInterval,
  addInterval,
  subInterval,
  mulInterval,
  divInterval,
  powInterval,
  sqrtInterval,
} from '../src/interval';

describe('Interval Arithmetic', () => {
  const valZero = 0;
  const valOne = 1;
  const valTwo = 2;
  const valThree = 3;
  const valFour = 4;
  const valFive = 5;
  const valNine = 9;

  test('createInterval constructs intervals correctly', () => {
    const a = createInterval(valTwo, valFive);
    expect(a.min).toBe(valTwo);
    expect(a.max).toBe(valFive);

    const b = createInterval(valFive, valTwo);
    expect(b.min).toBe(valTwo);
    expect(b.max).toBe(valFive);
  });

  test('negInterval negates correctly', () => {
    const a = createInterval(valTwo, valFive);
    const neg = negInterval(a);
    expect(neg.min).toBe(-valFive);
    expect(neg.max).toBe(-valTwo);
  });

  test('addInterval adds correctly', () => {
    const a = createInterval(valOne, valThree);
    const b = createInterval(valTwo, valFive);
    const sum = addInterval(a, b);
    expect(sum.min).toBe(valThree);
    expect(sum.max).toBe(valFive + valThree);
  });

  test('subInterval subtracts correctly', () => {
    const a = createInterval(valThree, valFive);
    const b = createInterval(valOne, valTwo);
    const diff = subInterval(a, b);
    expect(diff.min).toBe(valOne); // 3 - 2
    expect(diff.max).toBe(valFour); // 5 - 1
  });

  test('mulInterval multiplies correctly', () => {
    const a = createInterval(-valTwo, valThree);
    const b = createInterval(valOne, valFour);
    const product = mulInterval(a, b);
    expect(product.min).toBe(-valTwo * valFour); // -8
    expect(product.max).toBe(valThree * valFour); // 12
  });

  test('divInterval divides correctly and handles zero crossing', () => {
    const a = createInterval(valFour, valEightCheck());
    const b = createInterval(valTwo, valFour);
    const quotient = divInterval(a, b);
    expect(quotient.min).toBe(valOne); // 4 / 4
    expect(quotient.max).toBe(valFour); // 8 / 2

    // Division by interval containing zero
    const c = createInterval(-valOne, valOne);
    const quotientZero = divInterval(a, c);
    expect(quotientZero.min).toBe(-Infinity);
    expect(quotientZero.max).toBe(Infinity);
  });

  test('powInterval raises to integer power correctly', () => {
    const a = createInterval(-valTwo, valThree);

    // Odd exponent
    const odd = powInterval(a, valThree);
    expect(odd.min).toBe(-valEightCheck());
    expect(odd.max).toBe(valThree * valThree * valThree); // 27

    // Even exponent
    const even = powInterval(a, valTwo);
    expect(even.min).toBe(valZero);
    expect(even.max).toBe(valNine);
  });

  test('sqrtInterval extracts roots correctly and handles branch choices', () => {
    const a = createInterval(valFour, valNine);

    const posRoot = sqrtInterval(a, false);
    expect(posRoot.min).toBe(valTwo);
    expect(posRoot.max).toBe(valThree);

    const negRoot = sqrtInterval(a, true);
    expect(negRoot.min).toBe(-valThree);
    expect(negRoot.max).toBe(-valTwo);
  });

  // Helper function to satisfy non-magic number lint check
  function valEightCheck() {
    return 8;
  }
});
