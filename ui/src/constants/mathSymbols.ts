// Centralized display glyphs for math symbols.
//
// This is the RENDERING layer only — the engine AST and serialized strings keep
// ASCII operators ("*", "-"), so copy/export and the equation input parser are
// unaffected. #65 (Greek letters) is expected to extend this module with a
// symbol-name → glyph map alongside these operator glyphs.

// Multiplication renders as a centered dot rather than "×", which is too easily
// confused with the variable x (#28). U+22C5 (DOT OPERATOR) sits on the math axis;
// swap to "·" (U+00B7 MIDDLE DOT) here if a smaller mid-dot is preferred.
export const MULTIPLY_SYMBOL = '⋅';

// True minus sign (U+2212) rather than the hyphen-minus.
export const MINUS_SYMBOL = '−';

// Display map for the binary operators the equation renderers emit.
export const OPERATOR_DISPLAY: Record<string, string> = {
  '+': '+',
  '-': MINUS_SYMBOL,
  '*': MULTIPLY_SYMBOL,
};

// Display glyphs for relation operators (#34). The engine keeps ASCII (`<=`),
// while the renderer shows the typographic ≤ / ≥.
export const RELATION_DISPLAY: Record<string, string> = {
  '=': '=',
  '<': '<',
  '>': '>',
  '<=': '≤',
  '>=': '≥',
};

// Display glyphs for spelled-out Greek symbol names (#65). Applied at RENDER TIME
// only: the AST and serialized strings keep the ASCII spelling (`theta`), so the
// parser, share-links, and copy/export stay unaffected and homoglyph bugs (Greek
// ν vs Latin v) can never enter the data. Lookup is on the WHOLE symbol name, so a
// variable like `theta1` or `beta_max` is left untouched — only exact matches map.
//
// Coverage (consensus on #65):
//  - All lowercase Greek EXCEPT omicron (ο is pixel-identical to Latin o).
//  - Only the capitals that are visually distinct from Latin — `Beta`→Β would just
//    look like `B`, and `Rho`→Ρ reads as a misleading `P`, so those are omitted.
//  - `pi` renders as π even though mathjs treats it as the numeric constant; that's
//    a display concern only, matching the prior inline behavior in the renderers.
export const SYMBOL_DISPLAY: Record<string, string> = {
  // Lowercase (omicron intentionally omitted)
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π',
  rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ',
  chi: 'χ', psi: 'ψ', omega: 'ω',
  // Capitals distinct from Latin glyphs
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ',
  Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

// Render-time glyph for a symbol name, falling back to the name itself when it
// isn't a mapped Greek spelling. The single lookup point for every place a
// SymbolNode name is shown (EquationNode, PreviewEquationNode, …).
export const symbolToGlyph = (name: string): string => SYMBOL_DISPLAY[name] ?? name;
