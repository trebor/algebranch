import { parseEquation, getReducibleOptions, equationToString, getQuadraticStandardForm } from '../src';
import { describeReduction } from '../src/describe';
import type { ReductionOption } from '../src/simplify';

/** Collect every reduction option (across all paths) whose label matches. */
const optionsMatching = (eqStr: string, predicate: (label?: string) => boolean): ReductionOption[] => {
  const eq = parseEquation(eqStr);
  const reductions = getReducibleOptions(eq);
  const out: ReductionOption[] = [];
  for (const path of Object.keys(reductions)) {
    for (const r of reductions[path]) {
      if (predicate(r.label)) out.push(r);
    }
  }
  return out;
};

const isStandardFormOpt = (l?: string) => l === 'Write in Standard Form';
const isFormulaOpt = (l?: string) => !!l && l.includes('Quadratic Formula');

describe('#90 — surface the =0 normalization as an inspectable step', () => {
  describe('getQuadraticStandardForm (unit)', () => {
    const sf = (s: string, v = 'x') => {
      const out = getQuadraticStandardForm(parseEquation(s), v);
      return out ? equationToString(out) : null;
    };

    it('normalizes a non-=0 arrangement to ax²+bx+c = 0', () => {
      expect(sf('x^2 + 5*x = -6')).toBe('x ^ 2 + 5 * x + 6 = 0');
    });

    it('collects terms from both sides', () => {
      expect(sf('x^2 = 5*x - 6')).toBe('x ^ 2 - 5 * x + 6 = 0');
    });

    it('elides a unit leading coefficient (no 1*x^2)', () => {
      const out = sf('x^2 + 5*x = -6')!;
      expect(out).not.toContain('1 * x');
    });

    it('keeps a non-unit leading coefficient', () => {
      expect(sf('2*x^2 + 10*x = -12')).toBe('2 * x ^ 2 + 10 * x + 12 = 0');
    });

    it('preserves variable-on-RHS orientation', () => {
      expect(sf('-6 = x^2 + 5*x')).toBe('0 = x ^ 2 + 5 * x + 6');
    });

    it('returns null when already in =0 standard form', () => {
      expect(sf('x^2 + 5*x + 6 = 0')).toBeNull();
      expect(sf('0 = x^2 - 5*x + 6')).toBeNull();
    });

    it('returns null for a non-quadratic', () => {
      expect(sf('x + 5 = 6')).toBeNull();
    });
  });

  describe('option surfacing (getReducibleOptions)', () => {
    it('offers normalization (not the formula) for a non-=0 quadratic', () => {
      const sf = optionsMatching('x^2 + 5*x = -6', isStandardFormOpt);
      const formula = optionsMatching('x^2 + 5*x = -6', isFormulaOpt);
      expect(sf).toHaveLength(1);
      expect(equationToString(sf[0].simplified)).toBe('x ^ 2 + 5 * x + 6 = 0');
      expect(formula).toHaveLength(0);
    });

    it('offers the ± formula (not normalization) once already in =0 form', () => {
      const sf = optionsMatching('x^2 + 5*x + 6 = 0', isStandardFormOpt);
      const formula = optionsMatching('x^2 + 5*x + 6 = 0', isFormulaOpt);
      expect(sf).toHaveLength(0);
      expect(formula.length).toBeGreaterThanOrEqual(2);
    });

    it('chains: normalized output then offers the ± formula', () => {
      const sf = optionsMatching('x^2 + 5*x = -6', isStandardFormOpt);
      const normalized = sf[0].simplified;
      const reductions = getReducibleOptions(normalized);
      const formula = Object.values(reductions).flat().filter((r) => isFormulaOpt(r.label));
      expect(formula.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('step descriptor', () => {
    it('describes the normalization as a standard-form rewrite', () => {
      const eq = parseEquation('x^2 + 5*x = -6');
      const opt = optionsMatching('x^2 + 5*x = -6', isStandardFormOpt)[0];
      const change = describeReduction(eq, opt);
      expect(change.kind).toBe('rewrite');
      expect(change.op).toBe('quadratic_standard_form');
    });
  });
});
