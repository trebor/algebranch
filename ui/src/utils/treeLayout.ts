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
/** Smallest a card may shrink to before the row overflows into a scroll. */
export const TREE_MIN_CARD_PX = 110;
/** Safety cap (px) so a lone card never balloons on an unusually wide panel. */
export const TREE_MAX_CARD_PX = 560;

export interface RowCardLayout {
  /** Left edge (px) of the first card in the row. */
  startX: number;
  /** Card width (px) — every card in the row shares it. */
  cardWidth: number;
  /** Distance (px) between adjacent card left edges (cardWidth + gap). */
  step: number;
}

/**
 * Lay a row of `rowNodeCount` cards across the *measured* tree container so the
 * row fills it with symmetric {@link TREE_GUTTER_PX} margins (#279). Cards split
 * the usable width (container − two gutters) evenly, separated by
 * {@link TREE_COL_GAP_PX} gaps *between* cards only — so a single-column row's
 * card spans the full gutter-to-gutter width and the left/right margins match.
 *
 * Earlier the layout assumed a fixed 240px container and capped each card at
 * 228px, so in the ~288px History panel the cards stayed left-anchored and all
 * the slack collected on the right (a fat right margin). Driving off the real
 * width with no fixed card cap (only a generous safety {@link TREE_MAX_CARD_PX})
 * keeps both margins at the gutter. If the cards would fall below
 * {@link TREE_MIN_CARD_PX} (too many columns for the panel) they hold that floor
 * and the row overflows into the existing horizontal scroll; if the safety cap
 * binds, the block is centered so the margins stay symmetric.
 */
export function rowCardLayout(containerWidth: number, rowNodeCount: number): RowCardLayout {
  const count = Math.max(1, rowNodeCount);
  const usable = Math.max(TREE_MIN_CARD_PX, containerWidth - TREE_GUTTER_PX * 2);
  const raw = (usable - (count - 1) * TREE_COL_GAP_PX) / count;
  const cardWidth = Math.min(TREE_MAX_CARD_PX, Math.max(TREE_MIN_CARD_PX, raw));
  const blockWidth = count * cardWidth + (count - 1) * TREE_COL_GAP_PX;
  const startX = TREE_GUTTER_PX + Math.max(0, (usable - blockWidth) / 2);
  return { startX, cardWidth, step: cardWidth + TREE_COL_GAP_PX };
}
