import * as math from 'mathjs';
import { tryFactor } from '../src/factor';
import { getReducibleOptions } from '../src/simplify';
import { parseEquation } from '../src/index';
import { areEquationsEquivalent } from '../src/validator';

const norm = (s: string) => s.replace(/[\s()]/g, '');

/** All factored forms offered anywhere in `lhs = 0`, as normalized strings. */
const factoredForms = (lhs: string): string[] => {
  const eq = parseEquation(`${lhs} = 0`);
  const opts = getReducibleOptions(eq);
  return Object.values(opts)
    .flat()
    .filter((o) => typeof o.label === 'string' && o.label.startsWith('Factor'))
    .map((o) => norm(o.simplified.lhs.toString()));
};

describe('tryFactor — monic quadratics', () => {
  it('factors x^2 + 5x + 6 into (x+2)(x+3)', () => {
    const opts = tryFactor(math.parse('x^2 + 5*x + 6'));
    const forms = opts.map((o) => norm(o.node.toString()));
    expect(forms).toContain('x+2*x+3'); // (x+2)(x+3)
  });

  it('factors x^2 - 5x + 6 with negative roots', () => {
    const forms = tryFactor(math.parse('x^2 - 5*x + 6')).map((o) => norm(o.node.toString()));
    expect(forms).toContain('x-3*x-2');
  });

  it('factors x^2 - 9 as a difference of squares (x-3)(x+3)', () => {
    const forms = tryFactor(math.parse('x^2 - 9')).map((o) => norm(o.node.toString()));
    expect(forms.some((f) => f === 'x-3*x+3' || f === 'x+3*x-3')).toBe(true);
  });

  it('offers nothing for a prime quadratic x^2 + x + 1', () => {
    const quad = tryFactor(math.parse('x^2 + x + 1')).filter((o) => o.label === 'Factor');
    expect(quad).toHaveLength(0);
  });
});

describe('tryFactor — leading-coefficient quadratics', () => {
  const factorForm = (expr: string): string | undefined => {
    const opt = tryFactor(math.parse(expr)).find((o) => o.label === 'Factor');
    return opt && norm(opt.node.toString());
  };

  it('factors 2x^2 + 7x + 3 into (2x+1)(x+3)', () => {
    expect(factorForm('2*x^2 + 7*x + 3')).toBe('2*x+1*x+3');
  });

  it('factors 4x^2 + 8x + 3 into (2x+1)(2x+3)', () => {
    expect(factorForm('4*x^2 + 8*x + 3')).toBe('2*x+1*2*x+3');
  });

  it('factors 6x^2 + x - 2 into (2x-1)(3x+2)', () => {
    expect(factorForm('6*x^2 + x - 2')).toBe('2*x-1*3*x+2');
  });

  it('offers no clean factoring for an irrational-root quadratic 2x^2 + 4x + 1', () => {
    expect(factorForm('2*x^2 + 4*x + 1')).toBeUndefined();
  });

  it('every offered leading-coeff factoring is equivalent', () => {
    for (const expr of ['2*x^2 + 7*x + 3', '6*x^2 + x - 2', '3*x^2 - x - 2']) {
      const eq = parseEquation(`${expr} = 0`);
      for (const o of Object.values(getReducibleOptions(eq)).flat()) {
        if (typeof o.label === 'string' && o.label.startsWith('Factor')) {
          expect(areEquationsEquivalent(eq, o.simplified)).toBe(true);
        }
      }
    }
  });
});

describe('cubes — pattern rules via getReducibleOptions', () => {
  const labelsFor = (lhs: string): string[] =>
    Object.values(getReducibleOptions(parseEquation(`${lhs} = 0`)))
      .flat()
      .map((o) => o.label ?? '');

  it('offers "Factor Difference of Cubes" for a^3 - b^3', () => {
    expect(labelsFor('a^3 - b^3')).toContain('Factor Difference of Cubes');
  });

  it('offers "Factor Sum of Cubes" for a^3 + b^3', () => {
    expect(labelsFor('a^3 + b^3')).toContain('Factor Sum of Cubes');
  });
});

describe('tryFactor — GCF extraction', () => {
  it('factors 6x^2 + 9x into 3x(2x + 3)', () => {
    const opts = tryFactor(math.parse('6*x^2 + 9*x'));
    const gcf = opts.find((o) => o.label.startsWith('Factor out'));
    expect(gcf).toBeDefined();
    expect(norm(gcf!.node.toString())).toBe('3*x*2*x+3');
  });

  it('does not offer a GCF for a single monomial 5x', () => {
    expect(tryFactor(math.parse('5*x')).filter((o) => o.label.startsWith('Factor out'))).toHaveLength(0);
  });
});

describe('tryFactor — guards', () => {
  it('returns nothing for multivariate expressions', () => {
    expect(tryFactor(math.parse('x*y + x'))).toHaveLength(0);
  });

  it('returns nothing for a bare constant or non-polynomial', () => {
    expect(tryFactor(math.parse('7'))).toHaveLength(0);
    expect(tryFactor(math.parse('sin(x)'))).toHaveLength(0);
  });
});

describe('getReducibleOptions integration', () => {
  it('offers a validated factoring of x^2 + 5x + 6 = 0', () => {
    const forms = factoredForms('x^2 + 5*x + 6');
    expect(forms).toContain('x+2*x+3');
  });

  it('every offered factoring is equivalent to the original equation', () => {
    const eq = parseEquation('6*x^2 + 9*x = 0');
    const opts = getReducibleOptions(eq);
    const factorings = Object.values(opts)
      .flat()
      .filter((o) => typeof o.label === 'string' && o.label.startsWith('Factor'));
    expect(factorings.length).toBeGreaterThan(0);
    for (const f of factorings) {
      expect(areEquationsEquivalent(eq, f.simplified)).toBe(true);
    }
  });
});
