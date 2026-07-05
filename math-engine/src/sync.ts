// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { Equation, SerializedEquation, getAllPaths, getNodeByPath, serializeEquation, ensureNodeIds } from './tree';
import { generateValidMoves, hasValidMove } from './validator';
import { getReducibleOptions, getUndefinedDivisionPaths } from './simplify';
import { isCommutativeChainLink } from './explore';

/**
 * The sync-state payload the UI store consumes each time the equation (or the
 * selected source term) changes. Every field is plain JSON — equations are
 * carried as `SerializedEquation` so the payload crosses no live-mathjs boundary
 * and round-trips losslessly (node IDs preserved for FLIP animation continuity).
 */
export interface MathSyncResult {
  /** Paths whose node has at least one valid move/transposition available. */
  readonly activePaths: string[];
  /** Per-path simplify/distribute/identity rewrites available in place. */
  readonly reduciblePaths: Record<
    string,
    { equation: SerializedEquation; type: 'reduce' | 'distribute' | 'identity'; label?: string }[]
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

export const computeMathSync = (eq: Equation, sourcePath: string | null): MathSyncResult => {
  // 1. Active paths: nodes that can be moved/transformed.
  const activePaths: string[] = [];
  for (const path of getAllPaths(eq)) {
    try {
      // An arbitrary chain link is never selectable/boxable. Its terms stay
      // addressable, and any legitimate reduction (e.g. `2+3`->`5`) is unaffected
      // because reduciblePaths (step 2) is a separate channel.
      if (isChainLinkPath(eq, path)) {
        continue;
      }
      // Existence-only short-circuit: step 1 only needs "has ≥1 move", so this
      // stops at the first valid move rather than building the full map (#188).
      if (hasValidMove(eq, path)) {
        activePaths.push(path);
      }
    } catch {
      // A path that can't generate moves is simply not active.
    }
  }

  // 2. Reducible paths: nodes that can be simplified, distributed, or rewritten
  //    via algebraic identities.
  const reductions = getReducibleOptions(eq);
  const reduciblePaths: MathSyncResult['reduciblePaths'] = {};
  for (const path of Object.keys(reductions)) {
    reduciblePaths[path] = reductions[path].map((red) => ({
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
        targetPaths[k] = serializeEquation(moves[k]);
      }
    } catch {
      // No targets for a source that can't move.
    }
  }

  // 4. Undefined paths: division-by-zero subtrees are a dead end (#413). The
  //    engine reports the diagnostic; the UI decides how to render it.
  const undefinedPaths = getUndefinedDivisionPaths(eq).map((path) => ({
    path,
    reason: 'division-by-zero' as const,
  }));

  return { activePaths, reduciblePaths, targetPaths, undefinedPaths };
};
