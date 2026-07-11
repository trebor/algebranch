// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Canonical equation-input-format reference data (#507). The single source of
 * truth for "what can I type into Algebranch", shared by every surface that
 * accepts an equation string:
 *   - the `/input-format` on-domain reference page,
 *   - the equation-input dialog's help link (`EquationInputModal`),
 *   - the `/link-format` deep-link page (which links here rather than
 *     duplicating the operator/function catalog).
 *
 * The accepted set is defined by the engine, not this file — operators and
 * functions mirror the allow-lists in `math-engine/src/index.ts`
 * (`parseEquation`), and the aliases mirror the transforms in
 * `math-engine/src/normalizeInput.ts`. `tests/inputSyntax.test.ts` feeds every
 * example below through the real `parseEquation` so this reference can never
 * drift from what the parser actually accepts — the same drift-proofing the
 * `/link-format` worked examples get from the shared URL encoder.
 */

/** An operator or relation the parser accepts, with a tiny worked snippet. */
export interface OperatorRow {
  sym: string;
  name: string;
  example: string;
}

/** A function or constant call form. */
export interface CallRow {
  call: string;
  name: string;
}

/**
 * An accepted *alias*: a LaTeX / Unicode / Python form the normalizer rewrites
 * to Algebranch's canonical infix. `input` and `canonical` are full equations
 * that parse to the same thing — the test asserts exactly that.
 */
export interface AliasRow {
  input: string;
  canonical: string;
  note: string;
}

// Operators + relations. Mirrors `allowedOperators` and RELATION_REGEX in the
// engine. Implicit multiplication (`2x`) is understood, so it is called out on
// the `*` row rather than given a row of its own.
export const INPUT_OPERATORS: OperatorRow[] = [
  { sym: '+', name: 'Addition', example: 'a+b' },
  { sym: '-', name: 'Subtraction and negation', example: 'a-b, -x' },
  { sym: '*', name: 'Multiplication — implicit 2x also works', example: '2*x' },
  { sym: '/', name: 'Division', example: 'a/b' },
  { sym: '^', name: 'Exponent', example: 'x^2' },
  { sym: '= < > <= >=', name: 'Equation or inequality relation', example: 'x<=3' },
];

// Functions. Mirrors `allowedFunctions` in the engine. `nthRoot` is the
// counterintuitive one: camelCase, radicand BEFORE the index.
export const INPUT_FUNCTIONS: CallRow[] = [
  { call: 'sqrt(x)', name: 'Square root' },
  {
    call: 'nthRoot(x, n)',
    name: 'nth root — camelCase; radicand first, index second, so nthRoot(x, 3) is a cube root',
  },
  { call: 'abs(x)', name: 'Absolute value, shown as |x|' },
  { call: 'log(x), log(x, b)', name: 'Natural logarithm, or logarithm to base b' },
  { call: 'sin(x) cos(x) tan(x)', name: 'Trigonometric functions' },
  { call: 'csc(x) sec(x) cot(x)', name: 'Reciprocal trigonometric functions' },
];

// Constants recognized as symbols.
export const INPUT_CONSTANTS: CallRow[] = [
  { call: 'pi', name: 'π' },
  { call: 'e', name: "Euler's number" },
  {
    call: 'ⅈ',
    name: 'Imaginary unit — the dedicated glyph ⅈ, not the letter i; complex mode only',
  },
];

// Accepted input aliases the normalizer rewrites (see normalizeInput.ts). Each
// `input` parses to the same equation as its `canonical` form — asserted in the
// test, so a broken alias here fails CI rather than silently misleading a user.
export const INPUT_ALIASES: AliasRow[] = [
  { input: '\\frac{1}{2}=x', canonical: '1/2=x', note: 'LaTeX fraction' },
  { input: '\\sqrt{x}=3', canonical: 'sqrt(x)=3', note: 'LaTeX square root' },
  { input: '\\sqrt[3]{x}=2', canonical: 'nthRoot(x,3)=2', note: 'LaTeX nth root' },
  { input: '2\\cdot x=8', canonical: '2*x=8', note: 'LaTeX \\cdot / \\times → *' },
  { input: 'x\\geq 5', canonical: 'x>=5', note: 'LaTeX \\geq / \\leq → >= / <=' },
  { input: '√x=3', canonical: 'sqrt(x)=3', note: 'Unicode radical' },
  { input: 'x²=9', canonical: 'x^2=9', note: 'Unicode superscript → exponent' },
  { input: 'x×2=6', canonical: 'x*2=6', note: 'Unicode ×, ÷, − operators' },
  { input: 'x**2=9', canonical: 'x^2=9', note: 'Python-style ** → ^' },
];
