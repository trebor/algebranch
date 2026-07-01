import { describe, it, expect } from 'vitest';
import {
  REM_BASE,
  pxToRem,
  assignLanes,
  laneCardWidth,
  laneX,
  laneSpanWidth,
  overviewTargetWidth,
  TREE_VISIBLE_LANES,
  TREE_OVERVIEW_LANES,
  TREE_GUTTER_PX,
  TREE_COL_GAP_PX,
  TREE_MIN_CARD_PX,
  TREE_MAX_CARD_PX,
} from '@/utils/treeLayout';

// Build a minimal lane-assignment tree from an adjacency map of
// parent -> ordered child ids. The first child of every node continues its
// parent's spine straight down; later children open new branches (#304).
// `ts` optionally stamps a node's creation time; the layout places a parent's
// newest branch closest to it, so tests that exercise that supply timestamps.
const makeTree = (
  adjacency: Record<string, string[]>,
  ts: Record<string, number> = {},
): Record<string, { childrenIds: string[]; timestamp?: number }> => {
  const tree: Record<string, { childrenIds: string[]; timestamp?: number }> = {};
  const ids = new Set<string>(['0']);
  Object.entries(adjacency).forEach(([id, kids]) => {
    ids.add(id);
    kids.forEach((k) => ids.add(k));
  });
  ids.forEach((id) => {
    tree[id] = { childrenIds: adjacency[id] ?? [], timestamp: ts[id] };
  });
  return tree;
};
const cols = (lanes: ReturnType<typeof assignLanes>) =>
  Object.fromEntries(Object.entries(lanes).map(([id, n]) => [id, n.column]));

// A layered tree (row = depth, column = lane) has zero edge crossings iff, at
// every depth transition, ordering the child nodes by column keeps their
// parents' columns non-decreasing — two edges (p1->c1), (p2->c2) with c1 < c2
// cross exactly when p1 > p2. Returns the offending pair, or null if clean.
const findCrossing = (
  tree: Record<string, { childrenIds: string[] }>,
  lanes: ReturnType<typeof assignLanes>,
): string | null => {
  const parentOf: Record<string, string> = {};
  Object.entries(tree).forEach(([id, n]) => n.childrenIds.forEach((c) => (parentOf[c] = id)));
  const byDepth: Record<number, string[]> = {};
  Object.entries(lanes).forEach(([id, n]) => (byDepth[n.depth] ??= []).push(id));
  for (const depthNodes of Object.values(byDepth)) {
    const edges = depthNodes
      .filter((id) => parentOf[id] != null)
      .map((id) => ({ id, childCol: lanes[id].column, parentCol: lanes[parentOf[id]].column }))
      .sort((a, b) => a.childCol - b.childCol);
    for (let i = 1; i < edges.length; i++) {
      if (edges[i].parentCol < edges[i - 1].parentCol) {
        return `${edges[i - 1].id} & ${edges[i].id}`;
      }
    }
  }
  return null;
};

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

describe('lane assignment keeps branches on straight vertical columns (#304)', () => {
  it('keeps a linear derivation in a single column', () => {
    const lanes = assignLanes(makeTree({ '0': ['1'], '1': ['2'], '2': ['3'] }), '0');
    expect(cols(lanes)).toEqual({ '0': 0, '1': 0, '2': 0, '3': 0 });
    expect(lanes['3'].depth).toBe(3);
  });

  it('lets the first child inherit the column and branches the rest right', () => {
    // 0 -> [A, B]; A -> [C].  A is the mainline (stays in lane 0), B opens lane 1,
    // and C descends straight down from A in lane 0.
    const lanes = assignLanes(makeTree({ '0': ['A', 'B'], 'A': ['C'] }), '0');
    expect(cols(lanes)).toEqual({ '0': 0, 'A': 0, 'B': 1, 'C': 0 });
  });

  it('gives each side branch its own column rather than reusing a freed one', () => {
    // Mainline 0->A->B->C in lane 0. X is A's 2nd child (a leaf at depth 2).
    // Y is B's 2nd child (depth 3) with a child Z. Even though X's lane is free
    // below depth 2, Y/Z does NOT reuse it — reuse is dropped so no stranger ever
    // sits between a parent and its descendants (no crossings).
    const lanes = assignLanes(
      makeTree({ '0': ['A'], 'A': ['B', 'X'], 'B': ['C', 'Y'], 'Y': ['Z'] }),
      '0',
    );
    expect(cols(lanes)).toMatchObject({ '0': 0, 'A': 0, 'B': 0, 'C': 0, 'X': 1, 'Y': 2, 'Z': 2 });
  });

  it('always opens a child to the right of its parent, never into a lower free lane', () => {
    // root has three children: A (mainline, lane 0), B (leaf, lane 1), C (lane 2).
    // C then branches (F continues C's column; G is C's 2nd child). At G's depth
    // lane 1 is free (B was a leaf), so the old "smallest free lane" rule would
    // drop G into lane 1 — to the *left* of its parent C. G must instead open to
    // C's right (#304 make-room).
    const lanes = assignLanes(
      makeTree({ '0': ['A', 'B', 'C'], 'A': ['A2'], 'C': ['F', 'G'] }),
      '0',
    );
    const c = cols(lanes);
    expect(c).toMatchObject({ '0': 0, A: 0, B: 1, C: 2, F: 2 });
    expect(c.G).toBeGreaterThan(c.C); // child sits to the right of its parent
  });

  it('places the newest branch next to its parent and shoves older ones right', () => {
    // A (on the trunk) gets two branches alive at the same depths: B first, then
    // the newer C. The newest branch should hug the trunk in lane 1, pushing the
    // older B out to lane 2 — "make room", not "fling C to the first free lane".
    const lanes = assignLanes(
      makeTree(
        { '0': ['A'], A: ['A2', 'B', 'C'], B: ['B2'], C: ['C2'] },
        { B: 1, C: 2 }, // C created after B
      ),
      '0',
    );
    const c = cols(lanes);
    expect(c).toMatchObject({ '0': 0, A: 0, A2: 0 });
    expect(c.C).toBe(1); // newest branch hugs the parent
    expect(c.B).toBe(2); // older branch shoved right to make room
  });

  it('gives each branch its own contiguous column instead of reusing a freed one', () => {
    // Reuse is deliberately dropped to guarantee no crossings: X (A's 2nd child)
    // is a leaf in lane 1; Y starts below X but does NOT reclaim lane 1 — it gets
    // its own lane 2 so no stranger ever sits between a parent and its descendants.
    const lanes = assignLanes(
      makeTree({ '0': ['A'], 'A': ['B', 'X'], 'B': ['D'], 'D': ['E', 'Y'] }),
      '0',
    );
    expect(cols(lanes)).toMatchObject({ '0': 0, A: 0, B: 0, D: 0, E: 0, X: 1, Y: 2 });
  });

  it('produces no edge crossings even where lane reuse used to interleave', () => {
    // Trunk 0->A->B->C. A spawns a deep branch P->Q; B spawns the newer, shallow
    // branch R. Reusing a column here would drop R between the trunk and P,
    // crossing P's edge. The contiguous-band layout must keep it crossing-free.
    const tree = makeTree(
      { '0': ['A'], A: ['B', 'P'], B: ['C', 'R'], P: ['Q'] },
      { P: 1, R: 2 }, // R created after P
    );
    const lanes = assignLanes(tree, '0');
    expect(findCrossing(tree, lanes)).toBeNull();
  });
});

describe('lane geometry: fixed card width, straight columns, scroll for overflow (#304)', () => {
  it('sizes a card to fit a fixed number of visible lanes in the panel', () => {
    const W = 288;
    const width = laneCardWidth(W);
    const usable = W - TREE_GUTTER_PX * 2;
    const expected = (usable - (TREE_VISIBLE_LANES - 1) * TREE_COL_GAP_PX) / TREE_VISIBLE_LANES;
    expect(width).toBeCloseTo(expected);
    expect(width).toBeGreaterThanOrEqual(TREE_MIN_CARD_PX);
    expect(width).toBeLessThanOrEqual(TREE_MAX_CARD_PX);
  });

  it('anchors lane 0 at the gutter and steps later lanes right by a constant', () => {
    const width = laneCardWidth(288);
    const step = width + TREE_COL_GAP_PX;
    expect(laneX(0, width)).toBe(TREE_GUTTER_PX);
    expect(laneX(1, width)).toBeCloseTo(TREE_GUTTER_PX + step);
    expect(laneX(2, width)).toBeCloseTo(TREE_GUTTER_PX + 2 * step);
  });

  it('uses one constant card width regardless of how crowded a row is', () => {
    // The old per-row repack made width depend on the row's node count; lanes do not.
    expect(laneCardWidth(288)).toBe(laneCardWidth(288));
    expect(laneCardWidth(600)).toBeGreaterThan(laneCardWidth(288));
  });
});

describe('overview zoom targets a fixed lane span, not the whole tree width (#305)', () => {
  const cw = laneCardWidth(288);

  it('spans N lanes as both gutters plus N cards and N-1 inter-card gaps', () => {
    // laneSpanWidth mirrors how svgWidth is built for an exactly-N-column tree:
    // the rightmost card's left edge (laneX) + its width + the right gutter.
    for (const n of [1, 2, 3, 5]) {
      const viaLaneX = laneX(n - 1, cw) + cw + TREE_GUTTER_PX;
      expect(laneSpanWidth(n, cw)).toBeCloseTo(viaLaneX);
    }
    // Explicit form: 2 gutters + n cards + (n-1) gaps.
    expect(laneSpanWidth(3, cw)).toBeCloseTo(
      TREE_GUTTER_PX * 2 + 3 * cw + 2 * TREE_COL_GAP_PX,
    );
  });

  it('a single lane spans just the card between its two gutters (no gap)', () => {
    expect(laneSpanWidth(1, cw)).toBeCloseTo(TREE_GUTTER_PX * 2 + cw);
  });

  it('the middle zoom targets three lanes', () => {
    expect(TREE_OVERVIEW_LANES).toBe(3);
  });

  it('caps a wide tree at the three-lane span so extra columns scroll rather than shrink', () => {
    // A tree far wider than three lanes: overview should fit only three lanes
    // (readable scale + horizontal scroll), NOT the full width (which would be
    // the old fit-width behavior and shrink everything).
    const wideSvg = laneSpanWidth(8, cw);
    expect(overviewTargetWidth(wideSvg, cw)).toBeCloseTo(laneSpanWidth(TREE_OVERVIEW_LANES, cw));
    expect(overviewTargetWidth(wideSvg, cw)).toBeLessThan(wideSvg);
  });

  it('falls back to the tree width when the tree is narrower than three lanes', () => {
    // A 2-column tree has nothing past lane 1, so overview must not zoom out to a
    // phantom third lane — it degrades to fit-width (target = svgWidth).
    const narrowSvg = laneSpanWidth(2, cw);
    expect(overviewTargetWidth(narrowSvg, cw)).toBeCloseTo(narrowSvg);
  });
});
