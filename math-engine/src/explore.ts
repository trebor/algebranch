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
