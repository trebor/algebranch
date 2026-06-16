import * as math from 'mathjs';
import { Equation, RelationOperator } from './tree';
import { formatNumber } from './index';

/**
 * Pretty serializers (#46): render an Equation tree as LaTeX or as display-ready
 * Unicode, parallel to the plain-ASCII `equationToString`. These are additive
 * export paths — the AST and the plain serialization stay ASCII (see
 * `ui/src/constants/mathSymbols.ts`); only these functions prettify.
 *
 * Both formats share one precedence-aware recursive walk and differ only in a
 * small set of format-specific choices (power, fraction, root, multiply/minus
 * glyph, grouping). The Unicode glyph choices mirror the in-app display so an
 * exported line matches what's on screen: `⋅` for multiply (#28), `−` for minus,
 * `≤`/`≥` for relations (#34), and Greek spellings → glyphs (#65).
 *
 * Glyph-table ownership: this module is intentionally self-contained rather than
 * importing the UI's `mathSymbols.ts` (engine/UI boundary). `GREEK_UNICODE` is
 * exported so a UI test can guard the two tables against drift.
 */

type Format = 'latex' | 'unicode';

// Operator precedence. Atoms/functions/parenthesised content sit above every
// operator so they are never parenthesised as a child.
const PREC = { add: 1, mul: 2, unary: 3, pow: 4, atom: 5 } as const;

// Greek spelled-out name → LaTeX command. Mirrors the curated coverage of the
// UI's SYMBOL_DISPLAY (#65): all lowercase except omicron, plus the capitals
// visually distinct from Latin.
const GREEK_LATEX: Record<string, string> = {
  alpha: '\\alpha', beta: '\\beta', gamma: '\\gamma', delta: '\\delta', epsilon: '\\epsilon',
  zeta: '\\zeta', eta: '\\eta', theta: '\\theta', iota: '\\iota', kappa: '\\kappa',
  lambda: '\\lambda', mu: '\\mu', nu: '\\nu', xi: '\\xi', pi: '\\pi',
  rho: '\\rho', sigma: '\\sigma', tau: '\\tau', upsilon: '\\upsilon', phi: '\\phi',
  chi: '\\chi', psi: '\\psi', omega: '\\omega',
  Gamma: '\\Gamma', Delta: '\\Delta', Theta: '\\Theta', Lambda: '\\Lambda', Xi: '\\Xi',
  Pi: '\\Pi', Sigma: '\\Sigma', Phi: '\\Phi', Psi: '\\Psi', Omega: '\\Omega',
};

// Greek spelled-out name → Unicode glyph. Kept in lockstep with the UI's
// SYMBOL_DISPLAY by a guard test (#46) so copy/export matches the on-screen render.
export const GREEK_UNICODE: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π',
  rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ',
  chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ',
  Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

const RELATION_LATEX: Record<RelationOperator, string> = {
  '=': '=', '<': '<', '>': '>', '<=': '\\le', '>=': '\\ge',
};
const RELATION_UNICODE: Record<RelationOperator, string> = {
  '=': '=', '<': '<', '>': '>', '<=': '≤', '>=': '≥',
};

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
};

const FUNCTION_LATEX: Record<string, string> = {
  sin: '\\sin', cos: '\\cos', tan: '\\tan', cot: '\\cot', sec: '\\sec', csc: '\\csc',
  log: '\\log', ln: '\\ln',
};

const isOperator = (node: math.MathNode): node is math.OperatorNode => node.type === 'OperatorNode';
const isParenthesis = (node: math.MathNode) => node.type === 'ParenthesisNode';

// mathjs FunctionNode.fn is sometimes a string, sometimes a SymbolNode-like object.
const fnName = (node: math.FunctionNode): string => {
  const anyNode = node as any;
  if (typeof anyNode.fn === 'string') return anyNode.fn;
  if (anyNode.fn && typeof anyNode.fn === 'object' && 'name' in anyNode.fn) return anyNode.fn.name;
  return anyNode.name ?? '';
};

const isUnaryMinus = (node: math.OperatorNode): boolean =>
  node.op === '-' && node.args.length === 1;

// Precedence of a node as it participates in parenthesisation decisions.
const precedenceOf = (node: math.MathNode): number => {
  if (isParenthesis(node)) return precedenceOf((node as any).content);
  if (isOperator(node)) {
    const op = (node as math.OperatorNode).op;
    if (isUnaryMinus(node as math.OperatorNode)) return PREC.unary;
    if (op === '+' || op === '-') return PREC.add;
    if (op === '*' || op === '/') return PREC.mul;
    if (op === '^') return PREC.pow;
  }
  return PREC.atom;
};

// A leaf-ish node that reads cleanly as a root/function argument without parens.
const isAtomic = (node: math.MathNode): boolean => {
  if (isParenthesis(node)) return isAtomic((node as any).content);
  return node.type === 'ConstantNode' || node.type === 'SymbolNode' || node.type === 'FunctionNode';
};

const wrap = (s: string, format: Format): string =>
  format === 'latex' ? `\\left(${s}\\right)` : `(${s})`;

// Renders a non-negative/negative integer constant as Unicode superscripts, or
// null when the node isn't a plain integer (caller falls back to `^(...)`).
const superscriptInt = (node: math.MathNode): string | null => {
  if (node.type !== 'ConstantNode') return null;
  const value = (node as math.ConstantNode).value;
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return String(value)
    .split('')
    .map((ch) => SUPERSCRIPT[ch])
    .join('');
};

const renderSymbol = (name: string, format: Format): string =>
  format === 'latex' ? GREEK_LATEX[name] ?? name : GREEK_UNICODE[name] ?? name;

// Renders `child` as it appears under a binary parent of precedence `parentPrec`,
// adding parentheses only when the child would otherwise reassociate.
const renderChild = (
  child: math.MathNode,
  format: Format,
  parentPrec: number,
  side: 'left' | 'right',
  parentOp: string,
): string => {
  const inner = render(child, format);
  const cp = precedenceOf(child);

  // A LaTeX \frac is visually self-grouping, so a division child never needs
  // surrounding parens regardless of precedence.
  const childIsDivision = isOperator(child) && (child as math.OperatorNode).op === '/';
  if (format === 'latex' && childIsDivision) return inner;

  let needs = cp < parentPrec;
  if (!needs && cp === parentPrec && side === 'right') {
    // Non-(commutative+associative) parents: the right operand must keep its
    // grouping. `a - (b ± c)`, `a / (b·c)`, and `a · (b/c)`.
    if (parentOp === '-' || parentOp === '/') needs = true;
    else if (parentOp === '*' && childIsDivision) needs = true;
  }
  return needs ? wrap(inner, format) : inner;
};

const renderFunction = (node: math.FunctionNode, format: Format): string => {
  const name = fnName(node);
  const args = node.args;

  if (name === 'sqrt') {
    const arg = render(args[0], format);
    if (format === 'latex') return `\\sqrt{${arg}}`;
    return isAtomic(args[0]) ? `√${arg}` : `√${wrap(arg, format)}`;
  }

  if (name === 'nthRoot') {
    const radicand = render(args[0], format);
    const index = args[1];
    if (format === 'latex') return `\\sqrt[${render(index, format)}]{${radicand}}`;
    const sup = superscriptInt(index);
    const root = sup !== null ? `${sup}√` : `√`; // non-integer index is vanishingly rare in-app
    return `${root}${wrap(radicand, format)}`;
  }

  const arg = render(args[0], format);
  if (format === 'latex') {
    const fn = FUNCTION_LATEX[name] ?? `\\${name}`;
    return `${fn}\\left(${arg}\\right)`;
  }
  return `${name}(${arg})`;
};

const renderOperator = (node: math.OperatorNode, format: Format): string => {
  const minus = format === 'latex' ? '-' : '−';

  if (isUnaryMinus(node)) {
    const operand = node.args[0];
    const inner = render(operand, format);
    const body = precedenceOf(operand) < PREC.unary ? wrap(inner, format) : inner;
    return `${minus}${body}`;
  }

  const op = node.op;
  const [left, right] = node.args;

  if (op === '^') {
    const base = render(left, format);
    // The base is parenthesised for any operator (incl. a nested power, since `^`
    // is right-associative); atoms and functions stand alone.
    const baseStr = precedenceOf(left) <= PREC.pow ? wrap(base, format) : base;
    if (format === 'latex') return `${baseStr}^{${render(right, format)}}`;
    const sup = superscriptInt(right);
    return sup !== null ? `${baseStr}${sup}` : `${baseStr}^(${render(right, format)})`;
  }

  if (op === '/') {
    if (format === 'latex') {
      return `\\frac{${render(left, format)}}{${render(right, format)}}`;
    }
    const l = renderChild(left, format, PREC.mul, 'left', op);
    const r = renderChild(right, format, PREC.mul, 'right', op);
    return `${l}/${r}`;
  }

  if (op === '*') {
    const l = renderChild(left, format, PREC.mul, 'left', op);
    const r = renderChild(right, format, PREC.mul, 'right', op);
    const glyph = format === 'latex' ? '\\cdot' : '⋅';
    return `${l} ${glyph} ${r}`;
  }

  // '+' and '-'
  const sign = op === '-' ? minus : '+';
  const l = renderChild(left, format, PREC.add, 'left', op);
  const r = renderChild(right, format, PREC.add, 'right', op);
  return `${l} ${sign} ${r}`;
};

// Core recursive walk: returns the bare rendering of `node` (no outer parens).
const render = (node: math.MathNode, format: Format): string => {
  switch (node.type) {
    case 'ConstantNode':
      return formatNumber((node as math.ConstantNode).value);
    case 'SymbolNode':
      return renderSymbol((node as math.SymbolNode).name, format);
    case 'ParenthesisNode':
      // Drop the explicit grouping; parenthesisation is re-derived from precedence.
      return render((node as any).content, format);
    case 'FunctionNode':
      return renderFunction(node as math.FunctionNode, format);
    case 'OperatorNode':
      return renderOperator(node as math.OperatorNode, format);
    default:
      return node.toString();
  }
};

const renderEquation = (eq: Equation, format: Format): string => {
  const relation = (eq.relation ?? '=') as RelationOperator;
  const rel = format === 'latex' ? RELATION_LATEX[relation] : RELATION_UNICODE[relation];
  return `${render(eq.lhs, format)} ${rel} ${render(eq.rhs, format)}`;
};

// Unicode math glyphs our step descriptors emit, mapped to math-mode islands so
// they survive inside a LaTeX \text{} cell (KaTeX/MathJax/Overleaf all render these).
const UNICODE_TO_TEX: Record<string, string> = {
  '≠': '$\\neq$', '≤': '$\\leq$', '≥': '$\\geq$',
  '·': '$\\cdot$', '×': '$\\times$', '−': '$-$',
};

/**
 * Escapes arbitrary justification/assumption prose for a LaTeX `\text{}` cell:
 * TeX specials are neutralised (a bare `^` from "2 ^ 2" is otherwise an error)
 * and the few unicode math glyphs become math-mode islands. Result renders in
 * KaTeX, MathJax, and Overleaf (#46).
 */
export const escapeLatexText = (s: string): string =>
  s
    .replace(/[\\{}$&#%_^~]/g, (c) => {
      if (c === '^') return '\\textasciicircum{}';
      if (c === '~') return '\\textasciitilde{}';
      if (c === '\\') return '\\textbackslash{}';
      return `\\${c}`;
    })
    .replace(/[≠≤≥·×−]/g, (c) => UNICODE_TO_TEX[c] ?? c);

/** Serializes an Equation as a bare LaTeX math expression (no `$` delimiters). */
export const equationToLatex = (eq: Equation): string => renderEquation(eq, 'latex');

/**
 * Renders one row of a LaTeX `aligned` derivation (#46): the equation split at
 * the relation for alignment (`lhs &= rhs`), with an optional justification in a
 * second alignment column (`&&`) so reasons line up in their own tidy column
 * (the renderer handles the spacing). No trailing `\\` — the caller joins rows.
 */
export const equationToLatexAligned = (eq: Equation, annotation?: string): string => {
  const relation = (eq.relation ?? '=') as RelationOperator;
  const row = `${render(eq.lhs, 'latex')} &${RELATION_LATEX[relation]} ${render(eq.rhs, 'latex')}`;
  return annotation ? `${row} && \\text{${escapeLatexText(annotation)}}` : row;
};

/** Serializes an Equation as display-ready Unicode (matches the in-app render). */
export const equationToUnicode = (eq: Equation): string => renderEquation(eq, 'unicode');
