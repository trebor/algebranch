// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type * as math from 'mathjs';
import { mjs } from './mathjs';
import { Equation, RelationOperator, ensureNodeIds } from './tree';

// Matches a single relational operator. Two-character operators are listed first
// so `<=`/`>=` win over a bare `<`/`>`/`=` at the same position.
const RELATION_REGEX = /<=|>=|<|>|=/g;

export * from './mathjs';
export * from './interval';
export * from './tree';
export * from './validator';
export * from './simplify';
export * from './matcher';
export * from './rules';
export * from './describe';
export * from './globalOps';
export * from './substitute';
export * from './graphing';
export * from './factor';
export * from './serialize';
export * from './speech';
export * from './compress';
export * from './sync';

/**
 * Parses an equation string of the form "LHS = RHS" into an Equation tree.
 */
export const parseEquation = (eqStr: string): Equation => {
  const relationMatches = [...eqStr.matchAll(RELATION_REGEX)];
  const expectedRelationCount = 1;

  if (relationMatches.length !== expectedRelationCount) {
    throw new Error('Equation must contain exactly one relation operator (=, <, >, <=, >=)');
  }

  const match = relationMatches[0];
  const relation = match[0] as RelationOperator;
  const splitIndex = match.index ?? 0;
  const lhsStr = eqStr.slice(0, splitIndex).trim();
  const rhsStr = eqStr.slice(splitIndex + relation.length).trim();

  if (!lhsStr || !rhsStr) {
    throw new Error('Both sides of the equation must be non-empty');
  }

  const eq = {
    lhs: mjs.parse(lhsStr),
    rhs: mjs.parse(rhsStr),
    relation,
  };

  const allowedNodeTypes = new Set(['ConstantNode', 'SymbolNode', 'ParenthesisNode', 'OperatorNode', 'FunctionNode']);
  const allowedOperators = new Set(['+', '-', '*', '/', '^']);
  const allowedFunctions = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'sqrt', 'nthRoot']);
  const forbiddenSymbolNames = new Set(['undefined', 'null', 'nan', 'infinity', 'true', 'false']);

  const getFnName = (n: math.FunctionNode): string => {
    const nodeAny = n as any;
    if (nodeAny.fn) {
      if (typeof nodeAny.fn === 'string') return nodeAny.fn;
      if (typeof nodeAny.fn === 'object' && nodeAny.fn !== null && 'name' in nodeAny.fn) {
        return nodeAny.fn.name;
      }
    }
    return nodeAny.name || '';
  };

  const checkNode = (node: math.MathNode) => {
    node.traverse((n) => {
      if (!allowedNodeTypes.has(n.type)) {
        throw new Error(`Unsupported expression structure: "${n.type}" is not allowed`);
      }

      if (n.type === 'SymbolNode') {
        const name = (n as math.SymbolNode).name;
        if (forbiddenSymbolNames.has(name.toLowerCase())) {
          throw new Error(`"${name}" is a reserved keyword and cannot be used as a variable name`);
        }
      } else if (n.type === 'ConstantNode') {
        const val = (n as math.ConstantNode).value;
        if (typeof val !== 'number' || isNaN(val)) {
          throw new Error(`Value "${val}" is not allowed as a constant in equations`);
        }
      } else if (n.type === 'OperatorNode') {
        const opNode = n as math.OperatorNode;
        if (!allowedOperators.has(opNode.op)) {
          throw new Error(`Operator "${opNode.op}" is not allowed in equations`);
        }
      } else if (n.type === 'FunctionNode') {
        const funcNode = n as math.FunctionNode;
        const name = getFnName(funcNode);
        if (!allowedFunctions.has(name)) {
          throw new Error(`Function "${name}" is not allowed in equations`);
        }
      }
    });
  };
  checkNode(eq.lhs);
  checkNode(eq.rhs);

  return ensureNodeIds(eq);
};

/**
 * Largest number of fractional digits we treat as an exact, user-meaningful
 * decimal. A value whose shortest round-tripping representation has more
 * fractional digits than this is treated as a float approximation (an
 * irrational evaluation or floating-point noise like 0.1 + 0.2) and rounded
 * for a compact display. Human-entered decimals essentially never exceed this,
 * while doubles for irrationals fill out ~15-17 fractional digits — so the
 * threshold cleanly separates "show verbatim" from "round". (#66)
 */
const MAX_EXACT_FRACTION_DIGITS = 12;

/**
 * Formats a number for display. Short, exact decimals are shown verbatim so a
 * value the user actually typed (e.g. 1.41421356) is never silently truncated;
 * long float approximations are rounded to 2 decimal places for a compact
 * display, and very large/small magnitudes use scientific notation.
 */
export const formatNumber = (val: any): string => {
  let numVal = val;
  if (typeof val === 'object' && val !== null) {
    if (typeof val.toNumber === 'function') {
      numVal = val.toNumber();
    } else {
      numVal = Number(val);
    }
  }
  
  if (typeof numVal !== 'number' || isNaN(numVal)) {
    return String(val);
  }

  const absVal = Math.abs(numVal);
  
  // Very large or very small -> scientific notation
  if (absVal >= 1e6 || (absVal > 0 && absVal < 1e-3)) {
    let formatted = numVal.toExponential(2);
    // Remove positive exponent plus signs, e.g. e+6 -> e6
    formatted = formatted.replace(/e\+/, 'e');
    // Remove trailing zeros in decimal part, e.g. 1.20e-6 -> 1.2e-6, 1.00e6 -> 1e6
    formatted = formatted.replace(/\.?0+(?=e)/, '');
    return formatted;
  }
  
  if (Number.isInteger(numVal)) {
    return numVal.toString();
  }

  // `toString()` yields the shortest string that round-trips to this double.
  // If it's a short, exact decimal, show it verbatim — never truncate precision
  // the user entered. Only genuine approximations (long fractional tails) get
  // rounded to 2 decimal places for a compact display.
  const exact = numVal.toString();
  const dot = exact.indexOf('.');
  const fractionDigits = dot === -1 ? 0 : exact.length - dot - 1;
  if (fractionDigits <= MAX_EXACT_FRACTION_DIGITS) {
    return exact;
  }

  const rounded = Math.round(numVal * 100) / 100;
  return rounded.toString();
};

/**
 * Serializes an Equation tree back to a string form "LHS = RHS".
 */
export const equationToString = (eq: Equation): string => {
  const options = {
    handler: (node: math.MathNode, options: any): string | undefined => {
      if (node.type === 'ConstantNode') {
        return formatNumber((node as math.ConstantNode).value);
      }
      return undefined;
    }
  };
  return `${eq.lhs.toString(options)} ${eq.relation ?? '='} ${eq.rhs.toString(options)}`;
};
