// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

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

// The imaginary-unit token (#105): the distinct Unicode codepoint U+2148 'ⅈ'
// ("DOUBLE-STRUCK ITALIC SMALL I"), NOT the ASCII letter `i` (which stays a
// free variable). Kept in lockstep with the engine's `IMAGINARY_UNIT`; this
// module stays import-free (see the drift guard in the glyph-parity test), so
// the shared value is asserted equal there rather than imported here.
export const IMAGINARY_UNIT = 'ⅈ';

// Whether a SymbolNode name is the imaginary unit. It renders via its own
// upright-roman-i path (ISO-80000-2) rather than through the Greek/subscript
// maps, so callers gate that special-casing on this predicate.
export const isImaginaryUnit = (name: string): boolean => name === IMAGINARY_UNIT;

// True minus sign (U+2212) rather than the hyphen-minus.
export const MINUS_SYMBOL = '−';

// Identification shown for the imaginary unit on hover — names the glyph and its
// meaning in one breath (#105). Shared by the ⅈ hover hint (on the glyph in an
// equation) and the insert-button tooltip so the two always read the same.
export const IMAGINARY_UNIT_HINT = `i = √${MINUS_SYMBOL}1`;

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

// Reverse lookup for the Greek-name hover hint (#116): a symbol rendered as a
// Greek glyph (θ) carries its ASCII spelling in the AST (`theta`), so surfacing
// the name is just "is this whole name a mapped Greek spelling?". Returns the
// name when it is (the tooltip text), else null — so plain variables (`x`) and
// Greek-prefixed names (`theta1`, `omega_0`) get nothing, matching how
// symbolToGlyph maps only exact whole-name matches.
export const greekNameFor = (name: string): string | null =>
  name in SYMBOL_DISPLAY ? name : null;

// Hover-hint text identifying a symbol: a Greek letter's spelled name (`theta`)
// or the imaginary unit's `i = √−1` identification (#105). Null for a plain
// variable, which needs no hint. The single lookup the equation renderer uses to
// decide what osmotic-learning hint, if any, to surface for a SymbolNode.
export const symbolHintFor = (name: string): string | null =>
  isImaginaryUnit(name) ? IMAGINARY_UNIT_HINT : greekNameFor(name);

// Display-time subscript split (#113): an underscore-bearing symbol name like
// `v_0`, `F_net`, or `omega_0` renders as a head glyph plus a lowered subscript
// (v₀, Fₙₑₜ, ω₀). Like the Greek map this is RENDER-TIME ONLY — the AST and
// serialized name keep the ASCII spelling (`v_0`), so the parser, share-links,
// and copy/export are untouched and the data layer needs nothing.
//
// Rules (per #113):
//  - Split on the FIRST underscore only; everything after it is the verbatim
//    subscript (`a_b_c` → head `a`, sub `b_c`). Identifier subscripts only —
//    mathjs parses `x_(i+1)` as `x_ · (i+1)`, so expression subscripts never
//    reach here as one symbol.
//  - The head still goes through `symbolToGlyph`, so `omega_0` → ω head + `0`.
//  - A trailing bare underscore (`x_`) carries no subscript: render it as the
//    plain name rather than a dangling empty subscript.
export const splitSubscript = (name: string): { head: string; sub: string | null } => {
  const i = name.indexOf('_');
  if (i === -1 || i === name.length - 1) return { head: symbolToGlyph(name), sub: null };
  return { head: symbolToGlyph(name.slice(0, i)), sub: name.slice(i + 1) };
};
