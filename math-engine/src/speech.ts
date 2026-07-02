// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type * as math from 'mathjs';
import { IMAGINARY_UNIT } from './mathjs';
import { Equation, RelationOperator } from './tree';
import { formatNumber } from './index';
import { PREC, precedenceOf, isUnaryMinus, isAtomic, fnName } from './serialize';

/**
 * Math-to-speech serializer (#256): renders an Equation (or a single subtree)
 * as readable spoken English, parallel to the LaTeX/Unicode serializers in
 * `serialize.ts`. Custom-rendered glyphs have no native screen-reader voice, so
 * narration used to fall back to the raw AST string — VoiceOver read `x^2` as
 * "x caret 2". This serializer instead emits "x squared", following ClearSpeak's
 * pronunciation conventions for our closed algebra vocabulary (numbers, symbols
 * with subscripts/Greek, +−×÷, powers, roots, the trig/log functions, and the
 * five relations).
 *
 * It is deliberately hand-rolled rather than vendoring the Speech Rule Engine:
 * our vocabulary is small and stable, the grouping logic reuses the same
 * precedence walk the other serializers already share, and the output is a
 * synchronous string that drops straight into an `aria-label` or live region.
 * `equationToSpeech(eq): string` is the only contract callers depend on, so the
 * implementation can be swapped later if the vocabulary ever grows.
 *
 * Grouping mirrors `serialize.ts`: where a printed form would parenthesise a
 * child, speech says "the quantity …," with a trailing comma marking the spoken
 * boundary. Boundary commas dangling at a term's end are trimmed by the public
 * entry points so an aria-label never ends on a stray pause.
 */

const RELATION_SPEECH: Record<RelationOperator, string> = {
  '=': 'equals',
  '<': 'is less than',
  '>': 'is greater than',
  '<=': 'is less than or equal to',
  '>=': 'is greater than or equal to',
};

const OPERATOR_SPEECH: Record<string, string> = {
  '+': 'plus',
  '-': 'minus',
  '*': 'times',
};

// Function name → spoken phrase prefix; the argument is appended as " of …".
// Anything unlisted (a custom/uncommon function) speaks its bare name + " of".
const FUNCTION_SPEECH: Record<string, string> = {
  sin: 'sine', cos: 'cosine', tan: 'tangent',
  cot: 'cotangent', sec: 'secant', csc: 'cosecant',
  log: 'log', ln: 'natural log',
};

// Ordinal word for an nth-root index. 2 and 3 get the idiomatic "square"/"cube";
// the rest read as a plain ordinal ("the fourth root of …").
const ROOT_ORDINAL: Record<number, string> = {
  2: 'square', 3: 'cube', 4: 'fourth', 5: 'fifth', 6: 'sixth',
  7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth',
};

const isOperator = (node: math.MathNode): node is math.OperatorNode => node.type === 'OperatorNode';

// Strips a dangling grouping comma left at a spoken term's boundary.
const trimBoundary = (s: string): string => s.replace(/,\s*$/, '').trim();

// Wraps a child whose printed form would be parenthesised. The trailing comma
// marks the close of the group for a listener (TTS has no prosody to lean on).
const group = (inner: string): string => `the quantity ${inner},`;

// Spoken form of a symbol: head name plus any subscripts. The AST keeps ASCII
// names (`v_0`, `omega_0`), and Greek heads are already spelled out (`theta`),
// so the head speaks verbatim and each `_` segment becomes " sub …". The
// imaginary unit ⅈ (U+2148) is spoken as its conventional "i" rather than the
// raw glyph, which TTS has no voice for (#105).
const speakSymbol = (name: string): string =>
  name === IMAGINARY_UNIT
    ? 'i'
    : name.split('_').filter(Boolean).join(' sub ');

// Renders a child under a binary parent, adding "the quantity …" grouping only
// where the parenthesised printed form would (mirrors serialize.renderChild).
const speakChild = (
  child: math.MathNode,
  parentPrec: number,
  side: 'left' | 'right',
  parentOp: string,
): string => {
  const inner = speak(child);
  const cp = precedenceOf(child);
  let needs = cp < parentPrec;
  if (!needs && cp === parentPrec && side === 'right' && (parentOp === '-' || parentOp === '/')) {
    needs = true;
  }
  return needs ? group(inner) : inner;
};

const speakFunction = (node: math.FunctionNode): string => {
  const name = fnName(node);

  if (name === 'sqrt') return `the square root of ${speak(node.args[0])}`;

  if (name === 'nthRoot') {
    const radicand = speak(node.args[0]);
    const index = node.args[1];
    if (index && index.type === 'ConstantNode') {
      const value = (index as math.ConstantNode).value;
      const ord = typeof value === 'number' ? ROOT_ORDINAL[value] : undefined;
      if (ord) return `the ${ord} root of ${radicand}`;
    }
    return `the root of ${radicand} with index ${speak(index)}`;
  }

  const phrase = FUNCTION_SPEECH[name] ?? name;
  return `${phrase} of ${speak(node.args[0])}`;
};

const speakOperator = (node: math.OperatorNode): string => {
  if (isUnaryMinus(node)) {
    const operand = node.args[0];
    const inner = speak(operand);
    const body = precedenceOf(operand) < PREC.unary ? group(inner) : inner;
    return `negative ${body}`;
  }

  const op = node.op;
  const [left, right] = node.args;

  if (op === '^') {
    const base = left;
    const baseInner = speak(base);
    const baseSpeech = precedenceOf(base) <= PREC.pow ? group(baseInner) : baseInner;
    if (right.type === 'ConstantNode') {
      const value = (right as math.ConstantNode).value;
      if (value === 2) return `${baseSpeech} squared`;
      if (value === 3) return `${baseSpeech} cubed`;
    }
    const expSpeech = isAtomic(right) ? speak(right) : group(speak(right));
    return `${baseSpeech} to the power of ${expSpeech}`;
  }

  if (op === '/') {
    const [num, den] = [left, right];
    if (isAtomic(num) && isAtomic(den)) return `${speak(num)} over ${speak(den)}`;
    return `the fraction with numerator ${speak(num)} and denominator ${speak(den)}`;
  }

  const prec = op === '*' ? PREC.mul : PREC.add;
  const l = speakChild(left, prec, 'left', op);
  const r = speakChild(right, prec, 'right', op);
  return `${l} ${OPERATOR_SPEECH[op] ?? op} ${r}`;
};

// Core recursive walk: the bare spoken form of `node` (boundary commas intact).
const speak = (node: math.MathNode): string => {
  switch (node.type) {
    case 'ConstantNode':
      return formatNumber((node as math.ConstantNode).value);
    case 'SymbolNode':
      return speakSymbol((node as math.SymbolNode).name);
    case 'ParenthesisNode':
      return speak((node as math.ParenthesisNode).content);
    case 'FunctionNode':
      return speakFunction(node as math.FunctionNode);
    case 'OperatorNode':
      return speakOperator(node as math.OperatorNode);
    default:
      return node.toString();
  }
};

/** Spoken form of a single subtree, for a per-term `aria-label` (#256). */
export const nodeToSpeech = (node: math.MathNode): string => trimBoundary(speak(node));

/** Spoken form of a whole Equation, e.g. "x squared minus 9 equals 0" (#256). */
export const equationToSpeech = (eq: Equation): string => {
  const relation = (eq.relation ?? '=') as RelationOperator;
  return `${trimBoundary(speak(eq.lhs))} ${RELATION_SPEECH[relation]} ${trimBoundary(speak(eq.rhs))}`;
};
