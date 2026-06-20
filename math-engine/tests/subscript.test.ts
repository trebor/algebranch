// Cross-workspace import of the UI's display helper (a pure, import-free
// constants module) to lock down the subscript split (#113): the renderer shows
// `v_0` as `v₀`, but the AST/serialized name keeps the ASCII `v_0` — this guards
// the display-time split that both SymbolNode render sites share.
import { splitSubscript } from '../../ui/src/constants/mathSymbols';

describe('splitSubscript — display-time subscript split (#113)', () => {
  it('splits a simple numeric subscript', () => {
    expect(splitSubscript('x_1')).toEqual({ head: 'x', sub: '1' });
    expect(splitSubscript('v_0')).toEqual({ head: 'v', sub: '0' });
  });

  it('maps a Greek head through symbolToGlyph, keeping the subscript verbatim', () => {
    expect(splitSubscript('omega_0')).toEqual({ head: 'ω', sub: '0' });
  });

  it('renders a word subscript verbatim', () => {
    expect(splitSubscript('F_net')).toEqual({ head: 'F', sub: 'net' });
  });

  it('splits on the FIRST underscore only — the rest is verbatim', () => {
    expect(splitSubscript('a_b_c')).toEqual({ head: 'a', sub: 'b_c' });
  });

  it('returns no subscript for a plain name', () => {
    expect(splitSubscript('x')).toEqual({ head: 'x', sub: null });
    expect(splitSubscript('theta')).toEqual({ head: 'θ', sub: null });
  });

  it('renders a trailing bare underscore as plain text (no empty subscript)', () => {
    expect(splitSubscript('x_')).toEqual({ head: 'x_', sub: null });
  });
});
