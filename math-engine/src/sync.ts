// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { Equation, SerializedEquation, getAllPaths, getNodeByPath, serializeEquation, ensureNodeIds } from './tree';
import { generateValidMoves, hasValidMove, getEquationStatus } from './validator';
import { getReducibleOptions, getUndefinedDivisionPaths, ReductionOption } from './simplify';
import { isCommutativeChainLink } from './explore';
import { equationToString } from './index';

/**
 * The sync-state payload the UI store consumes each time the equation (or the
 * selected source term) changes. Every field is plain JSON — equations are
 * carried as `SerializedEquation` so the payload crosses no live-mathjs boundary
 * and round-trips losslessly (node IDs preserved for FLIP animation continuity).
 */
export interface MathSyncResult {
  /** Paths whose node has at least one valid move/transposition available. */
  readonly activePaths: string[];
  /** Per-path simplify/expand/factor/identity rewrites available in place. */
  readonly reduciblePaths: Record<
    string,
    { equation: SerializedEquation; type: 'reduce' | 'expand' | 'factor' | 'identity'; label?: string }[]
  >;
  /** Valid drop targets for the currently selected source term (keyed by target path). */
  readonly targetPaths: Record<string, SerializedEquation>;
  /**
   * Subtrees that are mathematically undefined and thus a dead end — no move can
   * be offered on them. Today the only reason is a division whose denominator is
   * (or folds to) zero (#413); `path` addresses the offending `/ 0` node so the
   * UI can badge exactly that subtree.
   */
  readonly undefinedPaths: { path: string; reason: 'division-by-zero' }[];
  /**
   * A reached terminal conclusion that freezes the tree (#487): a variable-free
   * constant relation that is either a `contradiction` (e.g. `3 = -3`, no
   * solution) or an `identity` (e.g. `0 = 0`, always true). Both are the *answer*,
   * not a mistake — there is no solving progress left, so every move channel is
   * emptied, exactly like the ÷0 freeze. Unlike ÷0 the halt is a whole-equation
   * property with no offending subtree, so it carries a status rather than paths;
   * the UI surfaces it as a standing conclusion. `null` on any non-terminal state,
   * and on an undefined (÷0) state — that dead end takes priority (see below).
   */
  readonly terminalStatus: 'contradiction' | 'identity' | null;
}

/**
 * Computes the full sync-state payload for an equation client-side.
 *
 * This is the former `POST /api/math` `sync-state` handler, lifted into the
 * engine so the app runs without a backend solving service (#136). It operates
 * on a live `Equation` (the client already holds one, with node IDs intact) —
 * no serialize/deserialize round-trip is needed, since that only ever existed to
 * cross the HTTP boundary.
 *
 * @param eq         the current equation
 * @param sourcePath the selected source term whose drop targets to compute, or
 *                   null when nothing is selected (then `targetPaths` is empty)
 */
/**
 * True when the node at `path` in `eq` is an arbitrary same-operator chain link
 * (`a+b+c` = `+[+[a,b],c]`, the inner `+`). Associativity makes that grouping a
 * parser artifact, not a meaningful subterm, so it must be neither selectable nor
 * a drop target — the interaction analog of the exploration-stop suppression in
 * #290 (#353). The immediate parent is the node one path segment up (null for a
 * side root). Resolution failures return false: an unresolvable path is not a
 * link, and callers should keep it rather than abort.
 */
const isChainLinkPath = (eq: Equation, path: string): boolean => {
  try {
    const slash = path.lastIndexOf('/');
    const parent = slash < 0 ? null : getNodeByPath(eq, path.slice(0, slash));
    return isCommutativeChainLink(getNodeByPath(eq, path), parent);
  } catch {
    return false;
  }
};

/**
 * Rendered signature of an equation, used to detect no-op offers (#367): a
 * transform whose result renders identically to the current state changes
 * nothing, so surfacing it is pure noise. `equationToString` is a purely
 * structural render (no simplification) that is order- and paren-sensitive, so
 * this collides ONLY on a true byte-for-byte no-op — a genuine commutative
 * reorder (`a·b` → `b·a`) renders differently and is correctly kept.
 */
const stateSignature = (eq: Equation): string => equationToString(eq);

/**
 * The single "genuine simplification" rule (#487): a reduction that makes real
 * progress toward the simplest form. Only a `reduce` counts, and never the lossy
 * `Evaluate to Decimal` — an `identity`/`expand`/`factor` is a same-value re-shape,
 * and a decimal eval is an alternate form, neither of which is progress. Shared by
 * the terminal-freeze gate below and its history-tree badge so the two agree.
 */
const isGenuineSimplification = (o: { type: ReductionOption['type']; label?: string }): boolean =>
  o.type === 'reduce' && o.label !== 'Evaluate to Decimal';

/**
 * The reached terminal conclusion that freezes the tree (#487), or `null`. The
 * canonical predicate behind BOTH the `computeMathSync` freeze and the history-tree
 * state badge, so the frozen canvas and the badge can never disagree.
 *
 * A variable-free constant relation is the answer — a `contradiction` (`3 = -3`,
 * no solution) or an `identity` (`0 = 0`, always true) — but only once the
 * arithmetic is actually done: while a genuine simplification is still pending
 * (`2*3+4 = 10`) it is NOT yet terminal, so the learner reaches the bare `10 = 10`
 * themselves rather than having the verdict declared over their head. A ÷0 dead end
 * is unsound, not a valid answer, so it is never a conclusion here — it owns its own
 * freeze and takes priority.
 */
export const getTerminalStatus = (eq: Equation): 'contradiction' | 'identity' | null => {
  if (getUndefinedDivisionPaths(eq).length > 0) return null;
  const status = getEquationStatus(eq);
  if (status !== 'contradiction' && status !== 'identity') return null;
  const currentSignature = stateSignature(eq);
  const reductions = getReducibleOptions(eq);
  const hasPendingSimplification = Object.values(reductions).some((list) =>
    list.some((r) => isGenuineSimplification(r) && stateSignature(r.simplified) !== currentSignature),
  );
  return hasPendingSimplification ? null : status;
};

export const computeMathSync = (eq: Equation, sourcePath: string | null): MathSyncResult => {
  // 0. Undefined check first: once any subtree is undefined (today: a division by
  //    zero, #413), the WHOLE equation is undefined. "Undefined" is not a value you
  //    can transpose across or cancel, so no algebraic manipulation yields a defined
  //    equivalent — the equation is a true dead end whose only sound action is undo
  //    (#419). The freeze is equation-global: even a term that doesn't itself touch
  //    the /0 offers no move. We still report the offending subtree(s) so the UI can
  //    badge exactly where the /0 is. (Reductions are already suppressed on
  //    /0-touching paths per #333; this makes the guarantee explicit and total.)
  const undefinedPaths = getUndefinedDivisionPaths(eq).map((path) => ({
    path,
    reason: 'division-by-zero' as const,
  }));
  if (undefinedPaths.length > 0) {
    return { activePaths: [], reduciblePaths: {}, targetPaths: {}, undefinedPaths, terminalStatus: null };
  }

  // Signature of the current state, computed once. Any offered transform whose
  // result matches it is a no-op and is suppressed below (#367) — a generic filter
  // applied across both offer channels (reductions and drop targets), not a
  // special-case for any one expression.
  const currentSignature = stateSignature(eq);

  // 1. Reducible paths: nodes that can be simplified, distributed, or rewritten
  //    via algebraic identities. Computed first because the terminal-freeze check
  //    (0b, below) needs to know whether any real simplification is still pending.
  const reductions = getReducibleOptions(eq);
  const reduciblePaths: MathSyncResult['reduciblePaths'] = {};
  for (const path of Object.keys(reductions)) {
    // Drop any option whose result renders identically to the current state — a
    // no-op reduction that just re-derives the current node (#367). If the whole
    // list is no-ops, the path is omitted entirely rather than left empty.
    const meaningful = reductions[path].filter(
      (red) => stateSignature(red.simplified) !== currentSignature,
    );
    if (meaningful.length === 0) {
      continue;
    }
    reduciblePaths[path] = meaningful.map((red) => ({
      // A reduction transform can leave two tree slots aliasing one node, or holding
      // the same (or a null) id (#400). This payload is rendered directly as an
      // EquationNode preview, where the node id is the React child key — so a
      // duplicate id becomes a duplicate key ("Encountered two children with the
      // same key"). ensureNodeIds de-aliases and makes every id unique here, while
      // preserving the ids inherited from `eq` (so surviving terms still FLIP when
      // the option is applied). String-matching consumers call getReducibleOptions
      // directly and are unaffected.
      equation: serializeEquation(ensureNodeIds(red.simplified)),
      type: red.type,
      label: red.label,
    }));
  }

  // 0b. Terminal-conclusion freeze (#487): a fully-simplified variable-free
  //     constant relation is a reached answer, so freeze the whole tree exactly
  //     like ÷0 (empty every move channel) and report the status for the standing
  //     conclusion the UI shows. The rule (÷0 priority, and "not until the
  //     arithmetic is done") lives in getTerminalStatus, shared with the tree badge.
  const terminalStatus = getTerminalStatus(eq);
  if (terminalStatus !== null) {
    return { activePaths: [], reduciblePaths: {}, targetPaths: {}, undefinedPaths: [], terminalStatus };
  }

  // 2. Active paths: nodes that can be moved/transformed.
  const activePaths: string[] = [];
  for (const path of getAllPaths(eq)) {
    try {
      // An arbitrary chain link is never selectable/boxable. Its terms stay
      // addressable, and any legitimate reduction (e.g. `2+3`->`5`) is unaffected
      // because reduciblePaths (step 1) is a separate channel.
      if (isChainLinkPath(eq, path)) {
        continue;
      }
      // Existence-only short-circuit: step 2 only needs "has ≥1 move", so this
      // stops at the first valid move rather than building the full map (#188).
      if (hasValidMove(eq, path)) {
        activePaths.push(path);
      }
    } catch {
      // A path that can't generate moves is simply not active.
    }
  }

  // 3. Target paths: valid drop targets for the selected source term.
  const targetPaths: Record<string, SerializedEquation> = {};
  if (sourcePath) {
    try {
      const moves = generateValidMoves(eq, sourcePath);
      delete moves[sourcePath];
      for (const k of Object.keys(moves)) {
        // Symmetry with step 1: an arbitrary chain link isn't a valid drop target
        // either — dropping onto the `(a+b)` of `a+b+c` only reshuffles the chain
        // (`a+b+c` -> `a+c+b`) and boxes the artifact group via isTarget. Skip it;
        // its terms remain valid targets (#353). Target keys are matched against the
        // rendered `eq`, the same tree the UI keys isTarget on.
        if (isChainLinkPath(eq, k)) {
          continue;
        }
        // Suppress a drop target that lands byte-for-byte on the current state — a
        // no-op move (e.g. dropping `3` onto `(x+2)` in `(x+2)·3` reproduces it). The
        // same generic signature test as the reduction channel above (#367).
        if (stateSignature(moves[k]) === currentSignature) {
          continue;
        }
        targetPaths[k] = serializeEquation(moves[k]);
      }
    } catch {
      // No targets for a source that can't move.
    }
  }

  return { activePaths, reduciblePaths, targetPaths, undefinedPaths, terminalStatus: null };
};
