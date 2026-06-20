// Cross-workspace import of the UI's display helper (a pure, import-free
// constants module) to lock down the Greek-name reverse lookup (#116): hovering
// a Greek glyph surfaces its spelled-out name (θ → "theta"). This guards the
// "is this a mapped Greek spelling, and what's its name?" predicate that the
// SymbolNode hover tooltip is gated on.
import { greekNameFor } from '../../ui/src/constants/mathSymbols';

describe('greekNameFor — Greek-name reverse lookup (#116)', () => {
  it('returns the name for a mapped lowercase Greek spelling', () => {
    expect(greekNameFor('theta')).toBe('theta');
    expect(greekNameFor('pi')).toBe('pi');
    expect(greekNameFor('omega')).toBe('omega');
  });

  it('returns the name for a mapped capital Greek spelling', () => {
    expect(greekNameFor('Delta')).toBe('Delta');
    expect(greekNameFor('Omega')).toBe('Omega');
  });

  it('returns null for a plain variable', () => {
    expect(greekNameFor('x')).toBeNull();
    expect(greekNameFor('y')).toBeNull();
  });

  it('returns null for omicron (intentionally unmapped — ο ≡ Latin o)', () => {
    expect(greekNameFor('omicron')).toBeNull();
  });

  it('matches the WHOLE name only — not Greek-prefixed variables or subscripts', () => {
    expect(greekNameFor('theta1')).toBeNull();
    expect(greekNameFor('beta_max')).toBeNull();
    expect(greekNameFor('omega_0')).toBeNull();
  });
});
