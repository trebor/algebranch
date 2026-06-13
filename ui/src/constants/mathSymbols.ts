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
