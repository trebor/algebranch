import { describe, it, expect } from 'vitest';
import {
  REM_BASE,
  pxToRem,
  rowCardLayout,
  TREE_GUTTER_PX,
  TREE_COL_GAP_PX,
  TREE_MIN_CARD_PX,
} from '@/utils/treeLayout';

describe('history-tree px → rem conversion', () => {
  // The tree layout is computed in px, then positioned in rem so the whole graph
  // (and its SVG viewBox, which stays in px) scales with the root font-size —
  // the text-size knob (#239) and any non-16px browser base. REM_BASE is the
  // *design* reference root size, deliberately constant: dividing by it (not by
  // the live font-size) is what lets the tree grow with the knob rather than
  // pinning it to a fixed pixel size (#279).
  it('uses a 16px design-reference root', () => {
    expect(REM_BASE).toBe(16);
  });

  it('renders identically to the px layout at the default root (1rem = 16px)', () => {
    expect(pxToRem(16)).toBe('1rem');
    expect(pxToRem(44)).toBe('2.75rem');
    expect(pxToRem(0)).toBe('0rem');
  });

  it('converts arbitrary px to rem against the constant base', () => {
    expect(pxToRem(228)).toBe(`${228 / 16}rem`);
    expect(pxToRem(76)).toBe('4.75rem');
  });
});

describe('history-tree row layout fills the panel with symmetric margins (#279)', () => {
  // Right margin of the last card mirrored against the container's right edge.
  const rightMargin = (container: number, count: number) => {
    const { startX, cardWidth, step } = rowCardLayout(container, count);
    const rightEdge = startX + (count - 1) * step + cardWidth;
    return container - rightEdge;
  };

  it('gives a single-column card equal gutters that fill the ~288px panel', () => {
    const W = 288;
    const { startX, cardWidth } = rowCardLayout(W, 1);
    expect(startX).toBe(TREE_GUTTER_PX);
    expect(cardWidth).toBe(W - TREE_GUTTER_PX * 2); // 256, not the old 228 cap
    expect(rightMargin(W, 1)).toBe(TREE_GUTTER_PX);
  });

  it('keeps both outer margins at the gutter when the columns fit', () => {
    // Two columns fit the 288px panel; three need the room of a wide sheet.
    expect(rowCardLayout(288, 2).startX).toBeCloseTo(TREE_GUTTER_PX);
    expect(rightMargin(288, 2)).toBeCloseTo(TREE_GUTTER_PX);
    for (const count of [2, 3]) {
      expect(rowCardLayout(600, count).startX).toBeCloseTo(TREE_GUTTER_PX);
      expect(rightMargin(600, count)).toBeCloseTo(TREE_GUTTER_PX);
    }
  });

  it('separates adjacent cards by exactly one gap', () => {
    const { cardWidth, step } = rowCardLayout(288, 2);
    expect(step - cardWidth).toBe(TREE_COL_GAP_PX);
  });

  it('holds a minimum card width and overflows when the panel is too narrow for the columns', () => {
    const { cardWidth, startX } = rowCardLayout(288, 6);
    expect(cardWidth).toBe(TREE_MIN_CARD_PX);
    expect(startX).toBe(TREE_GUTTER_PX); // left-anchored; row overflows into scroll
  });
});
