import { parseEquation, getReducibleOptions } from '../src';

/**
 * #66 Deliverable 4 — de-emphasize "Evaluate to Decimal" for exact/irrational
 * forms (e, π, radicals). Ordering-only: an exact-form move must be the headline
 * (first) option, and decimal sinks to the bottom of each node's option list so
 * it reads as an opt-in step rather than the primary move.
 */
describe('Evaluate to Decimal is de-emphasized (ordering only)', () => {
  const labelsAt = (src: string, path: string): string[] => {
    const opts = getReducibleOptions(parseEquation(src));
    return (opts[path] ?? []).map((o) => o.label ?? '');
  };

  test('"Evaluate to Decimal", when offered with other moves, is always last', () => {
    const sources = [
      'x = sqrt(2)',
      'x = sqrt(8)',
      'x = sqrt(2) + sqrt(2)',
      'x = pi/2 + pi/3',
      'C = 2 * pi * r',
      'x = 1/2 + 1/3',
    ];
    for (const src of sources) {
      const opts = getReducibleOptions(parseEquation(src));
      for (const [path, list] of Object.entries(opts)) {
        const labels = list.map((o) => o.label ?? '');
        const idx = labels.indexOf('Evaluate to Decimal');
        if (idx !== -1 && labels.length > 1) {
          // Evaluate to Decimal should be last on `${src}` @ `${path}`
          expect({ src, path, labels, idx }).toMatchObject({ idx: labels.length - 1 });
        }
      }
    }
  });

  test('sqrt(2): exact "Square Root to Fractional Power" is the headline, not decimal', () => {
    const labels = labelsAt('x = sqrt(2)', 'rhs');
    expect(labels[0]).not.toBe('Evaluate to Decimal');
    expect(labels[labels.length - 1]).toBe('Evaluate to Decimal');
  });

  test('a bare radical term under a sum keeps its exact move ahead of decimal', () => {
    // rhs/0 is the first sqrt(2) term
    const labels = labelsAt('x = sqrt(2) + sqrt(2)', 'rhs/0');
    expect(labels[0]).not.toBe('Evaluate to Decimal');
    expect(labels[labels.length - 1]).toBe('Evaluate to Decimal');
  });

  test('π fractions: Combine Fractions is the headline, decimal last', () => {
    const labels = labelsAt('x = pi/2 + pi/3', 'rhs');
    expect(labels).toContain('Combine Fractions');
    expect(labels[0]).not.toBe('Evaluate to Decimal');
    expect(labels[labels.length - 1]).toBe('Evaluate to Decimal');
  });

  test('decimal still offered (not gated) when it is the only move on an irrational constant', () => {
    const labels = labelsAt('y = e', 'rhs');
    expect(labels).toEqual(['Evaluate to Decimal']);
  });
});
