import * as math from 'mathjs';
import { tryFactor, factorCount } from '../src/factor';
import { mjs } from '../src/mathjs';
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

describe('factorCount — multiplicative factor count (#424)', () => {
  it('counts top-level factors of a product, flattening nesting', () => {
    expect(factorCount(mjs.parse('x*(x-1)*(x+1)*(x+2)'))).toBe(4);
    expect(factorCount(mjs.parse('3*x*(2*x+3)'))).toBe(3);
  });

  it('treats a sum or bare term as a single factor', () => {
    expect(factorCount(mjs.parse('x^2 + 5*x + 6'))).toBe(1);
    expect(factorCount(mjs.parse('x^4 + 2*x^3 - x^2 - 2*x'))).toBe(1);
    expect(factorCount(mjs.parse('x'))).toBe(1);
  });

  it('scores the de-factored form as fewer factors than the source product', () => {
    // the offer #424 must suppress: 4 factors collapsed to 2
    expect(factorCount(mjs.parse('x*(x^3 + 2*x^2 - x - 2)'))).toBe(2);
  });
});

describe('tryFactor — no de-factoring invariant (#424)', () => {
  // Parsed with `mjs` (the engine's own instance) so `rationalize` accepts these
  // product nodes and actually reaches candidate generation — vanilla math.parse
  // builds nodes it rejects, which would mask the invariant behind an early throw.
  it('does not offer to expand an already-factored product back to x*(cubic)', () => {
    const opts = tryFactor(mjs.parse('x*(x-1)*(x+1)*(x+2)'));
    expect(opts.filter((o) => o.label.startsWith('Factor out'))).toHaveLength(0);
    const forms = opts.map((o) => norm(o.node.toString()));
    expect(forms).not.toContain(norm('x*(x^3 + 2*x^2 - x - 2)'));
  });

  it('does not offer a partial de-factoring of the x*(x-1)*(x+1) subtree', () => {
    expect(
      tryFactor(mjs.parse('x*(x-1)*(x+1)')).filter((o) => o.label.startsWith('Factor out')),
    ).toHaveLength(0);
  });

  it('does not offer a lateral re-order of an already-factored (x-1)(x+1)', () => {
    expect(tryFactor(mjs.parse('(x-1)*(x+1)'))).toHaveLength(0);
  });

  it('does not over-suppress: legitimate sum factorings are still offered', () => {
    expect(tryFactor(mjs.parse('x^2 + 5*x + 6')).some((o) => o.label === 'Factor')).toBe(true);
    expect(tryFactor(mjs.parse('6*x^2 + 9*x')).some((o) => o.label.startsWith('Factor out'))).toBe(true);
  });

  it('offers no Factor option for the product via getReducibleOptions, but keeps Distribute', () => {
    const labels = Object.values(getReducibleOptions(parseEquation('x*(x-1)*(x+1)*(x+2) = 3')))
      .flat()
      .map((o) => o.label ?? '');
    expect(labels.some((l) => l.startsWith('Factor'))).toBe(false);
    expect(labels).toContain('Distribute'); // the honest expand path stays available
  });
});

describe('tryFactor — multivariate GCF extraction (#428)', () => {
  const gcfOf = (expr: string): { form?: string; label?: string } => {
    const opt = tryFactor(mjs.parse(expr)).find((o) => o.label.startsWith('Factor out'));
    return { form: opt && norm(opt.node.toString()), label: opt?.label };
  };

  it('factors a*c - b*c into c(a - b) and labels it "Factor out c"', () => {
    const { form, label } = gcfOf('a*c - b*c');
    expect(form).toBe('c*a-b');
    expect(label).toBe('Factor out c');
  });

  it('factors x*y + x*z into x(y + z)', () => {
    expect(gcfOf('x*y + x*z').form).toBe('x*y+z');
  });

  it('factors 6x^2*y + 9x*y into 3xy(2x + 3)', () => {
    expect(gcfOf('6*x^2*y + 9*x*y').form).toBe('3*x*y*2*x+3');
  });

  it('factors x*y + x into x(y + 1)', () => {
    expect(gcfOf('x*y + x').form).toBe('x*y+1');
  });

  it('offers no candidate when there is no common factor (a*c + b*d)', () => {
    expect(tryFactor(mjs.parse('a*c + b*d'))).toHaveLength(0);
  });

  it('offers no candidate for a multivariate product (a*b*c)', () => {
    expect(tryFactor(mjs.parse('a*b*c'))).toHaveLength(0);
  });

  it('offers no candidate for non-monomial terms (a/c + b, sin(a) + b)', () => {
    expect(tryFactor(mjs.parse('a/c + b'))).toHaveLength(0);
    expect(tryFactor(mjs.parse('sin(a) + b'))).toHaveLength(0);
  });

  it('emits at most one "Factor out" candidate for a many-variable sum', () => {
    const opts = tryFactor(mjs.parse('a*b*d + a*c*d - a*d'));
    expect(opts.filter((o) => o.label.startsWith('Factor out')).length).toBeLessThanOrEqual(1);
  });

  it('suppresses the generic "Simplify" once a precise GCF factoring exists (#421)', () => {
    const labels = Object.values(getReducibleOptions(parseEquation('a*c - b*c = d')))
      .flat()
      .map((o) => o.label ?? '');
    expect(labels).toContain('Factor out c');
    expect(labels).not.toContain('Simplify');
  });

  it('offers a validated multivariate factoring via getReducibleOptions', () => {
    const eq = parseEquation('a*c - b*c = d');
    const opts = getReducibleOptions(eq);
    const factorings = Object.values(opts)
      .flat()
      .filter((o) => typeof o.label === 'string' && o.label === 'Factor out c');
    expect(factorings.length).toBeGreaterThan(0);
    for (const f of factorings) {
      expect(areEquationsEquivalent(eq, f.simplified)).toBe(true);
    }
  });
});

describe('tryFactor — guards', () => {
  it('returns nothing for a genuinely common-factorless multivariate sum', () => {
    expect(tryFactor(math.parse('a*c + b*d'))).toHaveLength(0);
  });

  it('returns nothing for a bare constant or non-polynomial', () => {
    expect(tryFactor(math.parse('7'))).toHaveLength(0);
    expect(tryFactor(math.parse('sin(x)'))).toHaveLength(0);
  });

  it('safely returns nothing and does not hang for complex products', () => {
    const complexProduct = math.parse('((2 * x + 3) + (x - 1)) * ((2 * x + 3) ^ 2 - (2 * x + 3) * (x - 1) + (x - 1) ^ 2)');
    expect(tryFactor(complexProduct)).toHaveLength(0);
  });
});

describe('partial-GCF suppression inside a larger sum', () => {
  const labelsFor = (lhs: string): string[] =>
    Object.values(getReducibleOptions(parseEquation(`${lhs} = 0`)))
      .flat()
      .map((o) => o.label ?? '');

  it('does not offer a partial "Factor out" on x^2 + 5x + 6 (would be x(x+5)+6)', () => {
    const labels = labelsFor('x^2 + 5*x + 6');
    expect(labels.some((l) => l.startsWith('Factor out'))).toBe(false);
    expect(labels).toContain('Factor'); // the full (x+2)(x+3) still offered
  });

  it('still offers whole-expression GCF for 6x^2 + 9x', () => {
    expect(labelsFor('6*x^2 + 9*x').some((l) => l.startsWith('Factor out'))).toBe(true);
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
