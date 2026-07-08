// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { Equation, getAllPaths, getNodeByPath } from 'math-engine-client';

const idOf = (node: unknown): string | undefined =>
  (node as { id?: string } | null | undefined)?.id;

/**
 * Every node id present across both sides of an equation. Node ids are stable and
 * survive transforms that preserve them (the same stewardship that drives the FLIP
 * morph on apply, #234), so a preview node whose id is in the *current* equation's
 * set carried over unchanged; a fresh id is a change (#423).
 */
export const collectNodeIds = (eq: Equation): Set<string> => {
  const ids = new Set<string>();
  for (const path of getAllPaths(eq)) {
    const id = idOf(getNodeByPath(eq, path));
    if (id) ids.add(id);
  }
  return ids;
};

/**
 * The diff signal for a transform preview: the set of ids in `previewEq` that
 * carried over from `currentEq` (unchanged nodes). {@link PreviewEquationNode}
 * dims a node whose id is in this set and leaves changed/new nodes vivid, so the
 * eye lands on what the transform will do.
 *
 * Returns `null` — meaning "no diff emphasis, render as today" — for the two
 * degenerate cases where dimming has nothing to say:
 *  - **nothing carried** (a transform that rebuilds its result with all-fresh ids):
 *    every node would be bright, so this gracefully degrades to today's look;
 *  - **nothing changed** (the preview is the current equation): every node would
 *    dim into uniform mud.
 */
export const computePreviewDiff = (
  currentEq: Equation,
  previewEq: Equation,
): ReadonlySet<string> | null => {
  const current = collectNodeIds(currentEq);
  const carried = new Set<string>();
  let total = 0;
  for (const path of getAllPaths(previewEq)) {
    const id = idOf(getNodeByPath(previewEq, path));
    if (!id) continue;
    total += 1;
    if (current.has(id)) carried.add(id);
  }
  const changed = total - carried.size;
  if (carried.size === 0 || changed === 0) return null;
  return carried;
};
