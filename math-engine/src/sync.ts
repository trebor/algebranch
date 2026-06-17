// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { Equation, SerializedEquation, getAllPaths, serializeEquation } from './tree';
import { generateValidMoves } from './validator';
import { getReducibleOptions } from './simplify';

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
export const computeMathSync = (eq: Equation, sourcePath: string | null): MathSyncResult => {
  // 1. Active paths: nodes that can be moved/transformed.
  const activePaths: string[] = [];
  for (const path of getAllPaths(eq)) {
    try {
      if (Object.keys(generateValidMoves(eq, path)).length > 0) {
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
      equation: serializeEquation(red.simplified),
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
        targetPaths[k] = serializeEquation(moves[k]);
      }
    } catch {
      // No targets for a source that can't move.
    }
  }

  return { activePaths, reduciblePaths, targetPaths };
};
