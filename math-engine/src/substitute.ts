// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type * as math from 'mathjs';
import { mjs } from './mathjs';
import { Equation, getChildren, ensureNodeIds, cloneWithChildren, replaceNodeAtPath } from './tree';
import { getVariables, getFunctionName } from './validator';

/**
 * A usable definition of a variable, typically harvested from another
 * workspace whose current equation has the variable isolated (#3).
 */
export interface SubstitutionFact {
  readonly variable: string;
  readonly expression: math.MathNode;
  /** Optional provenance (e.g. source workspace tab) for UI labels. */
  readonly sourceId?: string;
  readonly sourceName?: string;
}

export interface SubstitutionOption {
  readonly path: string;
  readonly substituted: Equation;
  readonly variable: string;
  /** The replacement expression as a strictly parsable symbolic string. */
  readonly replacement: string;
  readonly fact: SubstitutionFact;
  readonly type?: 'forward' | 'reverse';
}

const unwrapParens = (n: math.MathNode): math.MathNode => {
  while (n.type === 'ParenthesisNode') {
    n = (n as math.ParenthesisNode).content;
  }
  return n;
};

/**
 * Returns the isolated definition an equation provides, if any: one side must be
 * a bare variable (pi/e excluded) that does NOT occur on the other side
 * (`y = y + 1` defines nothing). The other side is the defining expression.
 */
export const getIsolatedDefinition = (
  eq: Equation,
): { variable: string; expression: math.MathNode } | null => {
  const isBareVar = (n: math.MathNode): n is math.SymbolNode => {
    if (n.type !== 'SymbolNode') return false;
    const name = (n as math.SymbolNode).name;
    return name !== 'pi' && name !== 'e';
  };

  const lhs = unwrapParens(eq.lhs);
  if (isBareVar(lhs) && !getVariables(eq.rhs).includes(lhs.name)) {
    return { variable: lhs.name, expression: eq.rhs };
  }
  const rhs = unwrapParens(eq.rhs);
  if (isBareVar(rhs) && !getVariables(eq.lhs).includes(rhs.name)) {
    return { variable: rhs.name, expression: eq.lhs };
  }
  return null;
};

/**
 * Forward substitution (#3, Phase 1): for each fact `y = expr`, every occurrence
 * of `y` in the equation yields an option replacing all occurrences with
 * `(expr)` — parenthesized when the replacement is an operator expression so
 * precedence is preserved. Options are grouped by node path for UI selection.
 *
 * Pure and synchronous — intended to run client-side via the unified engine
 * (#44), no API round-trip.
 */
export const getSubstitutionOptions = (
  eq: Equation,
  facts: readonly SubstitutionFact[],
): Record<string, SubstitutionOption[]> => {
  const result: Record<string, SubstitutionOption[]> = {};

  const collectVarPaths = (node: math.MathNode, prefix: string, name: string, hits: string[]) => {
    if (node.type === 'SymbolNode' && (node as math.SymbolNode).name === name) {
      hits.push(prefix);
    }
    getChildren(node).forEach((child, i) => collectVarPaths(child, `${prefix}/${i}`, name, hits));
  };

  const replaceSymbol = (node: math.MathNode, name: string, replacement: math.MathNode): math.MathNode => {
    if (node.type === 'SymbolNode' && (node as math.SymbolNode).name === name) {
      return replacement.cloneDeep();
    }
    const children = getChildren(node);
    if (children.length > 0) {
      const newChildren = children.map(child => replaceSymbol(child, name, replacement));
      return cloneWithChildren(node, newChildren);
    }
    return node;
  };

  for (const fact of facts) {
    if (!fact?.variable || !fact.expression) continue;

    const hits: string[] = [];
    collectVarPaths(eq.lhs, 'lhs', fact.variable, hits);
    collectVarPaths(eq.rhs, 'rhs', fact.variable, hits);

    if (hits.length === 0) continue;

    try {
      const cloned = fact.expression.cloneDeep();
      const replacementNode =
        cloned.type === 'OperatorNode' ? new mjs.ParenthesisNode(cloned) : cloned;
      
      const substitutedLhs = replaceSymbol(eq.lhs, fact.variable, replacementNode);
      const substitutedRhs = replaceSymbol(eq.rhs, fact.variable, replacementNode);
      const substituted = ensureNodeIds({ lhs: substitutedLhs, rhs: substitutedRhs, relation: eq.relation });

      for (const path of hits) {
        (result[path] ||= []).push({
          path,
          substituted,
          variable: fact.variable,
          replacement: fact.expression.toString(),
          fact,
          type: 'forward',
        });
      }
    } catch {
      // Skip if substitution fails
      continue;
    }
  }

  return result;
};

const normalizeAST = (node: math.MathNode): math.MathNode => {
  const unwrapped = unwrapParens(node);

  if (unwrapped.type === 'OperatorNode') {
    const opNode = unwrapped as math.OperatorNode;
    const normalizedArgs = opNode.args.map(arg => normalizeAST(arg));
    if (opNode.op === '+' || opNode.op === '*') {
      normalizedArgs.sort((a, b) => a.toString().localeCompare(b.toString()));
    }
    return new mjs.OperatorNode(opNode.op, opNode.fn, normalizedArgs);
  }

  if (unwrapped.type === 'FunctionNode') {
    const fnNode = unwrapped as math.FunctionNode;
    const normalizedArgs = fnNode.args.map(arg => normalizeAST(arg));
    return new mjs.FunctionNode(getFunctionName(fnNode), normalizedArgs);
  }

  return unwrapped;
};

export const areNodesCanonicallyEqual = (a: math.MathNode, b: math.MathNode): boolean => {
  try {
    const normA = normalizeAST(a);
    const normB = normalizeAST(b);
    return normA.toString().replace(/\s+/g, '') === normB.toString().replace(/\s+/g, '');
  } catch {
    return false;
  }
};

/**
 * Reverse substitution (#51, Phase 2): for each fact `y = expr`, if a subtree of the
 * equation matches `expr` (canonically, including commutative reorderings), yields an option
 * collapsing that subtree to `y`.
 */
export const getCombineOptions = (
  eq: Equation,
  facts: readonly SubstitutionFact[],
): Record<string, SubstitutionOption[]> => {
  const result: Record<string, SubstitutionOption[]> = {};

  const traverse = (node: math.MathNode, path: string) => {
    for (const fact of facts) {
      if (!fact?.variable || !fact.expression) continue;

      if (areNodesCanonicallyEqual(node, fact.expression)) {
        try {
          const substituted = ensureNodeIds(
            replaceNodeAtPath(eq, path, new mjs.SymbolNode(fact.variable))
          );
          (result[path] ||= []).push({
            path,
            substituted,
            variable: fact.variable,
            replacement: fact.expression.toString(),
            fact,
            type: 'reverse',
          });
        } catch {
          // Skip if combine fails
        }
      }
    }

    getChildren(node).forEach((child, i) => {
      traverse(child, `${path}/${i}`);
    });
  };

  traverse(eq.lhs, 'lhs');
  traverse(eq.rhs, 'rhs');

  return result;
};
