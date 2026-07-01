// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Coordinate helpers for the history-tree layout (#279).
 *
 * The tree's node coordinates are computed in raw pixels (fixed row/card sizes,
 * `window.innerWidth`), then the cards and handles are *positioned* in rem while
 * the SVG connector layer keeps a px `viewBox`. Sharing one coordinate space
 * (px) but rendering it in rem lets the whole graph scale with the root
 * font-size: the accessibility text-size knob (#239, applied as
 * `html { font-size: calc(100% * var(--chrome-scale)) }`) and any non-16px
 * browser/OS base font.
 *
 * The divisor is the deliberately *constant* `REM_BASE`, not the live root
 * font-size. Dividing by a fixed 16 means `pxToRem` reproduces the original px
 * layout at the default root and *grows the tree as the root font-size grows*
 * (rendered size = px ÷ 16 × rootFontSize) — the real zoom win. Dividing by the
 * live font-size would instead cancel the knob out and pin the tree to a fixed
 * pixel size. SVG and DOM stay aligned at any root size because both share this
 * one divisor — the alignment never depended on the divisor matching 16px.
 */

/** The design-reference root font-size (px) the px coordinates are authored at. */
export const REM_BASE = 16;

/** Express a px coordinate as a rem CSS length against the constant {@link REM_BASE}. */
export function pxToRem(px: number): string {
  return `${px / REM_BASE}rem`;
}

/** Outer margin (px) reserved on each side of a row, before any card. */
export const TREE_GUTTER_PX = 16;
/** Gap (px) between adjacent cards within a row. */
export const TREE_COL_GAP_PX = 12;
/** Height (px) of a step card. */
export const TREE_CARD_HEIGHT_PX = 44;
/** Size/diameter (px) of the round operator badge bubbles. */
export const TREE_BADGE_SIZE_PX = 44;

/** Top offset (px) for the tree layout. */
export const TREE_TOP_OFFSET_PX = 20;
/** Vertical distance (px) between adjacent rows in the tree. */
export const TREE_ROW_HEIGHT_PX = 76;
/** Default/fallback width (px) for the SVG layout when the tree is empty. */
export const TREE_EMPTY_WIDTH_PX = 260;
/** Content width (px) of the tree panel in its standard (1/3 screen) state, subtracting paddings and borders. */
export const TREE_STANDARD_CONTENT_WIDTH = 282;
/** Smallest a card may shrink to before the row overflows into a scroll. */
export const TREE_MIN_CARD_PX = 110;
/** Safety cap (px) so a lone card never balloons on an unusually wide panel. */
export const TREE_MAX_CARD_PX = 560;

/**
 * Lane-based layout (#304).
 *
 * The history tree is a derivation: the *first* child of a node continues that
 * node's branch straight down; later children open new branches. We want each
 * branch to live in a fixed vertical **lane** (column) so a derivation reads as
 * a straight line down, new branches step to the right, and a dead-ended
 * branch's lane is *reclaimed* for a later branch rather than sprawling right
 * forever. This is the git-graph "straight branch" model; a tree is its easy
 * case (no merges, so no forbidden-column edge handling).
 *
 * The earlier renderer instead re-packed every node at a given depth evenly
 * across the panel, so a branch's x jumped left/right with its row's crowding
 * and cards changed width per row. Fixed lanes kill both: a node's column is a
 * property of its *branch*, not its row.
 */

/** A node's place in the lane grid: its row (`depth`) and column (`column`). */
export interface LaneNode {
  depth: number;
  column: number;
}

/**
 * Assign every node reachable from `rootId` a `depth` (row) and `column` (lane).
 *
 * A **spine** is a maximal first-child chain — a branch. We walk down from the
 * root and give every subtree a **contiguous block of columns** that no other
 * subtree intrudes into: a spine sits in its block's leftmost lane, and its
 * branches are packed into consecutive sub-blocks to its right. This is what
 * keeps connectors from reaching across unrelated columns and crossing them
 * (#304). Two further effects:
 * - **Make room** — each branch's block is sized to its whole subtree, so a new
 *   branch shoves its right-siblings (and everything past them) over to fit.
 * - **Newest hugs** — branches are packed newest-first, so the most recently
 *   created branch takes the lane next to its parent (its deeper rows leave the
 *   shallow rows above free for older branches' connectors to pass cleanly).
 * Columns are never reused across subtrees — the price of no crossings is that a
 * dead branch's lane stays reserved rather than refilled by a stranger.
 */
export function assignLanes(
  tree: Record<string, { childrenIds: string[]; timestamp?: number }>,
  rootId: string,
): Record<string, LaneNode> {
  const result: Record<string, LaneNode> = {};

  // Place the spine starting at `startId` with its block's left edge at `base`,
  // then pack its branches into consecutive blocks to the right. Returns the
  // total width (lane count) the spine's whole subtree consumes.
  const place = (startId: string, top: number, base: number): number => {
    const spineNodes: Array<[string, number]> = [];
    const branches: Array<{ id: string; depth: number; ts: number }> = [];
    let id: string | undefined = startId;
    let depth = top;
    while (id != null && tree[id]) {
      spineNodes.push([id, depth]);
      const kids: string[] = tree[id].childrenIds;
      for (let i = 1; i < kids.length; i++) {
        branches.push({ id: kids[i], depth: depth + 1, ts: tree[kids[i]]?.timestamp ?? 0 });
      }
      id = kids[0];
      depth += 1;
    }
    for (const [nodeId, nodeDepth] of spineNodes) {
      result[nodeId] = { depth: nodeDepth, column: base };
    }

    // Newest first so the latest branch hugs the parent at base + 1; older
    // siblings take the blocks beyond it.
    branches.sort((a, b) => b.ts - a.ts);
    let cursor = base + 1;
    for (const branch of branches) {
      cursor += place(branch.id, branch.depth, cursor);
    }
    return cursor - base;
  };
  place(rootId, 0, 0);
  return result;
}

/** How many lanes are sized to fit the measured panel before it scrolls (#304). */
export const TREE_VISIBLE_LANES = 1;

/**
 * The single, row-independent card width for the lane layout: sized so
 * {@link TREE_VISIBLE_LANES} lanes fit the measured panel (clamped to the
 * card-width bounds). Constant across every row, so columns stay dead straight
 * and wider trees scroll horizontally rather than re-packing (#304).
 */
export function laneCardWidth(containerWidth: number): number {
  const usable = Math.max(TREE_MIN_CARD_PX, containerWidth - TREE_GUTTER_PX * 2);
  const raw = (usable - (TREE_VISIBLE_LANES - 1) * TREE_COL_GAP_PX) / TREE_VISIBLE_LANES;
  return Math.min(TREE_MAX_CARD_PX, Math.max(TREE_MIN_CARD_PX, raw));
}

/** Left edge (px) of a card in the given `column`, lane 0 anchored at the gutter. */
export function laneX(column: number, cardWidth: number): number {
  return TREE_GUTTER_PX + column * (cardWidth + TREE_COL_GAP_PX);
}

/**
 * How many lanes the middle ("overview") zoom mode fits across the panel (#305).
 *
 * The three modes form a progressive ladder — Normal (1 lane) → Overview (this
 * many) → Full tree (all lanes). The old middle mode fit the *whole* tree width,
 * which — in the narrow 1/3 panel where width almost always binds — landed on the
 * same scale as Full tree, wasting a button. Fitting a fixed lane span instead
 * gives a genuine third step: readable cards with horizontal scroll for the rest.
 */
export const TREE_OVERVIEW_LANES = 3;

/**
 * Pixel width spanned by `lanes` cards laid out from the gutter — both outer
 * gutters, `lanes` cards, and the `lanes - 1` inter-card gaps between them. This
 * mirrors how `svgWidth` is built for a tree exactly `lanes` columns wide, so an
 * N-lane span and an N-column tree's width agree.
 */
export function laneSpanWidth(lanes: number, cardWidth: number): number {
  return TREE_GUTTER_PX * 2 + lanes * cardWidth + Math.max(0, lanes - 1) * TREE_COL_GAP_PX;
}

/**
 * The width the overview zoom fits into: the {@link TREE_OVERVIEW_LANES}-lane
 * span, but never wider than the tree itself (`svgWidth`). A tree narrower than
 * the overview span thus degrades to fit-width rather than zooming out to a
 * phantom lane; a wider tree caps at the span so its extra columns scroll.
 */
export function overviewTargetWidth(svgWidth: number, cardWidth: number): number {
  return Math.min(svgWidth, laneSpanWidth(TREE_OVERVIEW_LANES, cardWidth));
}

/** Vertical distance tolerance (px) to identify collateral loop nodes on the same row. */
export const TREE_COLLATERAL_TOLERANCE_PX = 10;

/** Arch vertical offset (px) for drawing a loop connector over intermediate nodes. */
export const TREE_LOOP_ARCH_OFFSET_PX = 50;

/** Sizing threshold (px) below which we do not apply scale-down zoom to avoid subpixel layout shifts. */
export const TREE_ZOOM_MIN_DIFF_PX = 8;
