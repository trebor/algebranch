// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import * as math from 'mathjs';
import { getFunctionName } from './validator';

export interface WildcardBindings {
  [wildcardName: string]: math.MathNode;
}

const isWildcard = (node: math.MathNode): boolean => {
  return node.type === 'SymbolNode' && (node as math.SymbolNode).name.startsWith('_');
};

const unwrap = (node: math.MathNode): math.MathNode => {
  let current = node;
  while (current.type === 'ParenthesisNode') {
    current = (current as math.ParenthesisNode).content;
  }
  return current;
};


const areNodesStructurallyEqual = (a: math.MathNode, b: math.MathNode): boolean => {
  const unwrappedA = unwrap(a);
  const unwrappedB = unwrap(b);

  if (unwrappedA.type !== unwrappedB.type) return false;

  if (unwrappedA.type === 'ConstantNode') {
    return (unwrappedA as math.ConstantNode).value === (unwrappedB as math.ConstantNode).value;
  }
  if (unwrappedA.type === 'SymbolNode') {
    return (unwrappedA as math.SymbolNode).name === (unwrappedB as math.SymbolNode).name;
  }
  if (unwrappedA.type === 'OperatorNode') {
    const opA = unwrappedA as math.OperatorNode;
    const opB = unwrappedB as math.OperatorNode;
    if (opA.op !== opB.op || opA.args.length !== opB.args.length) return false;
    return opA.args.every((arg, index) => areNodesStructurallyEqual(arg, opB.args[index]));
  }
  if (unwrappedA.type === 'FunctionNode') {
    const fnA = unwrappedA as math.FunctionNode;
    const fnB = unwrappedB as math.FunctionNode;
    if (getFunctionName(fnA) !== getFunctionName(fnB) || fnA.args.length !== fnB.args.length) return false;
    return fnA.args.every((arg, index) => areNodesStructurallyEqual(arg, fnB.args[index]));
  }
  return unwrappedA.toString().replace(/\s+/g, '') === unwrappedB.toString().replace(/\s+/g, '');
};

/**
 * Matches a pattern AST containing wildcard nodes (e.g. _A, _B) against a target node.
 * Returns the bindings dictionary if matched successfully, otherwise returns null.
 */
export function matchPattern(
  pattern: math.MathNode,
  target: math.MathNode,
  bindings: WildcardBindings = {}
): WildcardBindings | null {
  if (isWildcard(pattern)) {
    const name = (pattern as math.SymbolNode).name;
    const existing = bindings[name];
    if (existing) {
      if (areNodesStructurallyEqual(existing, target)) {
        return bindings;
      }
      return null;
    }
    // Bind to the exact target node (retaining parenthesization)
    return {
      ...bindings,
      [name]: target,
    };
  }

  // Handle standard node matching
  const unwrappedPattern = unwrap(pattern);
  const unwrappedTarget = unwrap(target);

  if (unwrappedPattern.type !== unwrappedTarget.type) {
    return null;
  }

  if (unwrappedPattern.type === 'ConstantNode') {
    if ((unwrappedPattern as math.ConstantNode).value === (unwrappedTarget as math.ConstantNode).value) {
      return bindings;
    }
    return null;
  }

  if (unwrappedPattern.type === 'SymbolNode') {
    if ((unwrappedPattern as math.SymbolNode).name === (unwrappedTarget as math.SymbolNode).name) {
      return bindings;
    }
    return null;
  }

  if (unwrappedPattern.type === 'OperatorNode') {
    const opP = unwrappedPattern as math.OperatorNode;
    const opT = unwrappedTarget as math.OperatorNode;

    if (opP.op !== opT.op || opP.args.length !== opT.args.length) {
      return null;
    }

    // Support commutative operations: + and *
    if (opP.op === '+' || opP.op === '*') {
      if (opP.args.length === 2) {
        // Try matching 1-to-1 directly first: Pattern[0] with Target[0], Pattern[1] with Target[1]
        const bindings1 = matchPattern(opP.args[0], opT.args[0], bindings);
        if (bindings1) {
          const finalBindings = matchPattern(opP.args[1], opT.args[1], bindings1);
          if (finalBindings) {
            return finalBindings;
          }
        }

        // Try matching cross-wise: Pattern[0] with Target[1], Pattern[1] with Target[0]
        const bindings2 = matchPattern(opP.args[0], opT.args[1], bindings);
        if (bindings2) {
          const finalBindings = matchPattern(opP.args[1], opT.args[0], bindings2);
          if (finalBindings) {
            return finalBindings;
          }
        }

        return null;
      }
    }

    // Normal non-commutative operator matching
    let currentBindings = { ...bindings };
    for (let i = 0; i < opP.args.length; i++) {
      const next = matchPattern(opP.args[i], opT.args[i], currentBindings);
      if (next) {
        currentBindings = next;
      } else {
        return null;
      }
    }
    return currentBindings;
  }

  if (unwrappedPattern.type === 'FunctionNode') {
    const fnP = unwrappedPattern as math.FunctionNode;
    const fnT = unwrappedTarget as math.FunctionNode;

    if (getFunctionName(fnP) !== getFunctionName(fnT) || fnP.args.length !== fnT.args.length) {
      return null;
    }

    let currentBindings = { ...bindings };
    for (let i = 0; i < fnP.args.length; i++) {
      const next = matchPattern(fnP.args[i], fnT.args[i], currentBindings);
      if (next) {
        currentBindings = next;
      } else {
        return null;
      }
    }
    return currentBindings;
  }

  // Fallback string-based matching for other node types
  if (unwrappedPattern.toString().replace(/\s+/g, '') === unwrappedTarget.toString().replace(/\s+/g, '')) {
    return bindings;
  }

  return null;
}

/**
 * Replaces wildcard symbols in a pattern AST with their bound nodes from match bindings.
 */
export function instantiatePattern(
  pattern: math.MathNode,
  bindings: WildcardBindings
): math.MathNode {
  if (isWildcard(pattern)) {
    const name = (pattern as math.SymbolNode).name;
    const bound = bindings[name];
    if (bound) {
      return bound.clone();
    }
    return pattern;
  }

  if ('args' in pattern && Array.isArray((pattern as any).args)) {
    const cloned = pattern.clone() as any;
    cloned.args = (pattern as any).args.map((arg: math.MathNode) =>
      instantiatePattern(arg, bindings)
    );
    return cloned;
  }

  if ('content' in pattern && (pattern as any).content) {
    const cloned = pattern.clone() as any;
    cloned.content = instantiatePattern((pattern as any).content, bindings);
    return cloned;
  }

  return pattern;
}

/**
 * Checks if a ConstantNode represents a perfect power (e.g. 9, 8, 16, 64)
 * and returns all valid OperatorNodes representing its power forms (e.g. [8^2, 4^3, 2^6] for 64).
 */
export function tryExpressAsPowerOptions(node: math.MathNode): math.MathNode[] {
  if (node.type !== 'ConstantNode') return [];
  const val = (node as math.ConstantNode).value;
  if (typeof val !== 'number' || !Number.isInteger(val) || val <= 1) return [];

  const options: math.MathNode[] = [];
  
  // Since base >= 2 and exponent >= 2, max exponent is floor(log2(val))
  const maxExponent = Math.floor(Math.log2(val));

  for (let p = 2; p <= maxExponent; p++) {
    const b = Math.pow(val, 1 / p);
    const roundedB = Math.round(b);
    if (Math.abs(Math.pow(roundedB, p) - val) < 1e-9) {
      options.push(new math.OperatorNode('^', 'pow', [
        new math.ConstantNode(roundedB),
        new math.ConstantNode(p)
      ]));
    }
  }

  return options;
}

/**
 * If a node is a ConstantNode representing a perfect square or cube (e.g. 9 or 8),
 * returns an OperatorNode representing the power form (e.g. 3^2 or 2^3).
 * Otherwise returns null. If multiple forms exist, returns the first one (square).
 */
export function tryExpressAsPower(node: math.MathNode): math.MathNode | null {
  const options = tryExpressAsPowerOptions(node);
  return options.length > 0 ? options[0] : null;
}
