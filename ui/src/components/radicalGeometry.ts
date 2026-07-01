// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type * as math from 'mathjs';
import { getFunctionName } from 'math-engine-client';

/**
 * Shared radical (√) glyph + tall-index geometry, so the live renderer
 * (`EquationNode`) and the preview renderer (`PreviewEquationNode`) draw the same
 * crook and seat a tall nth-root index the same way (#356). The seating logic
 * shipped for #201 in the live renderer; this module is the single source both
 * import so they can never drift.
 */

/**
 * True when an nthRoot's index is "tall" — a fraction or a nested radical — i.e. much
 * taller than the crook's default slot. Such an index grows the node box to stay
 * contained (#201) and must be lifted so its bottom rests on the crook rather than the
 * radical's vertex. Detected on the paren-unwrapped index child.
 */
export const hasTallRootIndex = (node: math.MathNode | null | undefined): boolean => {
  if (!node || node.type !== 'FunctionNode') return false;
  const fn = node as math.FunctionNode;
  if (getFunctionName(fn) !== 'nthRoot' || fn.args.length < 2) return false;
  let idx: math.MathNode = fn.args[1];
  while (idx && idx.type === 'ParenthesisNode') idx = (idx as math.ParenthesisNode).content;
  if (!idx) return false;
  return (
    (idx.type === 'OperatorNode' && (idx as math.OperatorNode).op === '/') ||
    (idx.type === 'FunctionNode' && ['sqrt', 'nthRoot'].includes(getFunctionName(idx as math.FunctionNode)))
  );
};

/**
 * Radical stroke geometry (0..100 viewBox). The arm spans the FULL height — the vertex
 * is pinned to the very bottom (RADICAL_VERTEX_Y = 100) and the arm rises to the very
 * top (RADICAL_ARM_TOP_Y = 0). The crook tick is drawn at a chosen y; the tick→vertex
 * descent is the "dip" below the crook. A plain radical / short digit index keeps the
 * classic notch at RADICAL_DEFAULT_CROOK_Y. A tall index (fraction/radical) instead
 * seats at RADICAL_CROOK_FRACTION (#201): a 0.75 crook leaves the dip beneath it at 1/4
 * of the height, giving the index 3/4 of the height above and wasting less space. The
 * same fraction drives both the tick and where the tall index's bottom is seated, so
 * glyph and index always agree. (The stroke's round caps sit at y=0/100, so the SVG is
 * overflow-visible to keep them from clipping.)
 */
export const RADICAL_VERTEX_Y = 100;
export const RADICAL_ARM_TOP_Y = 0;
export const RADICAL_DEFAULT_CROOK_Y = 55;
export const RADICAL_CROOK_FRACTION = 75 / 100;
export const radicalPath = (crookY: number): string =>
  `M 1,${crookY} L 3.5,${crookY} L 7.5,${RADICAL_VERTEX_Y} L 12,${RADICAL_ARM_TOP_Y}`;

/**
 * Breathing room (em) a tall index keeps at its nestled corner (#201). A SINGLE inset
 * drives both the gap above the index (below the arm's top) and the gap to its right
 * (before the rising arm), so equidistance is structural — change this one value and
 * both gaps move together — instead of two hand-tuned margins that drift apart across
 * font sizes. The index's lower-left corner stays pinned in the crook; the box grows up
 * and left into the pocket, which naturally widens upward.
 */
export const INDEX_INSET_EM = 0.2;

/**
 * Horizontal distance (em) from the index column's right edge to the arm where it
 * crosses the crook line. The index lives in its own column immediately left of the
 * 0.7em radical SVG; the arm runs from the vertex (7.5,100) to the top-right (12,0), so
 * at the crook height it sits at RADICAL_ARM_X_AT_CROOK (of 12) within that column. The
 * index column's right edge is flush with the 0.7em radical SVG's left edge, so with no
 * horizontal pull the index falls INDEX_ARM_GAP_BASE_EM short of the arm at the crook.
 * Pulling the index right by (inset − base) leaves exactly `inset` of gap, so the right
 * gap equals the top and bottom gaps by construction: one dial (INDEX_INSET_EM) moves
 * all.
 */
export const RADICAL_SVG_WIDTH_EM = 0.7;
export const RADICAL_ARM_X_AT_CROOK = 7.5 + (12 - 7.5) * (1 - RADICAL_CROOK_FRACTION);
export const INDEX_ARM_GAP_BASE_EM = RADICAL_SVG_WIDTH_EM * (RADICAL_ARM_X_AT_CROOK / 12);
export const INDEX_ARM_RIGHT_MARGIN_EM = INDEX_INSET_EM - INDEX_ARM_GAP_BASE_EM;
