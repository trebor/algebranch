// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type * as math from 'mathjs';

/**
 * Exploration-mode structural helpers (#290).
 *
 * The AST stores an n-ary commutative/associative operation as a left-nested
 * chain of binary pairs: `a + b + c` parses to `+[+[a,b],c]` and `x*y*z` to
 * `*[*[x,y],z]`. That inner pair is a **parser artifact**, not a meaningful
 * grouping — surfacing it as its own navigable stop makes the screen-reader
 * reading of a flat chain more confusing than it needs to be (you hear
 * "a plus b" as a node before reaching a, b, c individually).
 *
 * `isCommutativeChainLink` identifies exactly those artifact nodes so the
 * exploration reader can skip registering them as stops, leaving `a + b + c` a
 * flat sequence of siblings under one "sum". It flattens ONLY true associative
 * same-operator chains:
 *
 * - `+` and `*` are the only associative/commutative operators here. `−` and
 *   `÷` use distinct op strings (`a-b-c` = `-[-[a,b],c]`), so they never match
 *   and their non-associative grouping is preserved.
 * - Precedence survives: in `a + b*c` = `+[a,*[b,c]]` the product's parent is a
 *   `+`, a different op, so it stays whole.
 * - Explicit grouping survives: `a + (b + c)` = `+[a,(+[b,c])]` interposes a
 *   `ParenthesisNode` parent, so the inner `+` doesn't match and the user's
 *   parenthesised subterm keeps its own stop.
 */

const isOperator = (node: math.MathNode | null): node is math.OperatorNode =>
  !!node && node.type === 'OperatorNode';

const ASSOCIATIVE_OPS = new Set(['+', '*']);

/**
 * True when `node` is an arbitrary same-operator link in an associative chain —
 * an `OperatorNode` with op `+` or `*` whose immediate `parent` is an
 * `OperatorNode` with the same op. Such a node should NOT be a navigable
 * exploration stop; drilling skips straight past it to its terms.
 */
export const isCommutativeChainLink = (
  node: math.MathNode,
  parent: math.MathNode | null,
): boolean =>
  isOperator(node) &&
  ASSOCIATIVE_OPS.has(node.op) &&
  isOperator(parent) &&
  parent.op === node.op;

/** The flat structure of an associative chain, keyed by tree path. */
export interface FlattenedChain {
  /**
   * The chain's operands, in document order, each as its true tree path. For
   * `a+b+c` = `+[+[a,b],c]` rooted at `lhs`, these are the uneven-depth paths
   * `['lhs/0/0','lhs/0/1','lhs/1']` — so a renderer can lay `a`, `b`, `c` out as
   * flat siblings instead of the parser's nested pairs.
   */
  readonly operandPaths: string[];
  /**
   * The same-operator intermediate nodes that get collapsed, EXCLUDING the root
   * (`['lhs/0']` above). A caller should check these against its handle-bearing
   * paths (reducible/substitution) before flattening: collapsing a link node
   * would orphan any handle it carries (e.g. the `2+3`->`5` reduce on `2+3+x`).
   */
  readonly linkPaths: string[];
}

/**
 * Flattens a maximal same-operator associative chain rooted at `root` into its
 * ordered operands (#353 Workstream B). Recurses through same-op binary
 * `OperatorNode`s; anything else — a leaf, a different-op product, a
 * parenthesised subterm — is an operand and stops the descent, so precedence and
 * explicit grouping are preserved. Intended for a chain root (an associative
 * OperatorNode whose parent is not the same op); on a non-operator it degenerates
 * to a single operand at `rootPath`.
 */
export const flattenAssociativeChain = (
  root: math.MathNode,
  rootPath: string,
): FlattenedChain => {
  const operandPaths: string[] = [];
  const linkPaths: string[] = [];
  const op = isOperator(root) ? root.op : null;

  const walk = (node: math.MathNode, path: string): void => {
    if (isOperator(node) && node.op === op && node.args.length === 2) {
      if (path !== rootPath) linkPaths.push(path);
      walk(node.args[0], `${path}/0`);
      walk(node.args[1], `${path}/1`);
    } else {
      operandPaths.push(path);
    }
  };
  walk(root, rootPath);

  return { operandPaths, linkPaths };
};
