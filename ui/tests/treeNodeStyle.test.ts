import { describe, it, expect } from 'vitest';
import { treeNodeStyle } from '@/utils/treeNodeStyle';
import { THEME_GLASS } from '@/constants/theme';

// The history-tree node style resolves overlapping states in a fixed priority:
// loop-highlight > current > on-active-path > default. A node can satisfy several
// at once (the current node is always on the active path), so the priority — not
// mere membership — is the behavior under test (#305 active-path emphasis).
describe('history-tree node style priority (#305)', () => {
  const S = (over: Partial<Parameters<typeof treeNodeStyle>[0]> = {}) =>
    treeNodeStyle({ isLoopHighlight: false, isCurrent: false, isOnPath: false, ...over });

  it('defaults to the muted inactive style when the node is off the active path', () => {
    expect(S()).toEqual({
      card: THEME_GLASS.TREE_NODE_DEFAULT,
      badge: THEME_GLASS.TREE_NODE_BADGE_DEFAULT,
    });
  });

  it('gives an on-path ancestor its own emphasis, distinct from both default and current', () => {
    const onPath = S({ isOnPath: true });
    expect(onPath).toEqual({
      card: THEME_GLASS.TREE_NODE_ON_PATH,
      badge: THEME_GLASS.TREE_NODE_BADGE_ON_PATH,
    });
    // The whole point: it must read differently from an inactive branch AND from
    // the single current node.
    expect(onPath.card).not.toBe(THEME_GLASS.TREE_NODE_DEFAULT);
    expect(onPath.card).not.toBe(THEME_GLASS.TREE_NODE_ACTIVE);
  });

  it('lets the current node outrank on-path (it is always on its own path)', () => {
    expect(S({ isCurrent: true, isOnPath: true })).toEqual({
      card: THEME_GLASS.TREE_NODE_ACTIVE,
      badge: THEME_GLASS.TREE_NODE_BADGE_ACTIVE,
    });
  });

  it('lets a loop highlight outrank everything else', () => {
    expect(S({ isLoopHighlight: true, isCurrent: true, isOnPath: true })).toEqual({
      card: THEME_GLASS.TREE_NODE_LOOP,
      badge: THEME_GLASS.TREE_NODE_BADGE_LOOP,
    });
  });
});

// #485: the active path was "blue on blue" — indigo-tinted node fills on the
// navy tree ground barely read. The fix keeps every node fill BLACK (the neutral
// family) and shows path membership through the node BORDER and the connecting
// EDGE instead. These guard that decision: a future refactor must not smuggle an
// indigo *fill* back onto path/current nodes to signal state.
describe('active-path contrast is carried by border + edge, not a fill tint (#485)', () => {
  const nodeCards = {
    default: THEME_GLASS.TREE_NODE_DEFAULT,
    onPath: THEME_GLASS.TREE_NODE_ON_PATH,
    current: THEME_GLASS.TREE_NODE_ACTIVE,
  };

  it('keeps all three node fills in the black (neutral) family — none is indigo-tinted', () => {
    for (const [name, card] of Object.entries(nodeCards)) {
      expect(card, `${name} fill should be black/neutral`).toMatch(/bg-neutral-9\d\d/);
      expect(card, `${name} must not carry an indigo fill`).not.toMatch(/bg-indigo/);
    }
  });

  it('signals path membership on the border: on-path and current get an indigo border, default does not', () => {
    expect(THEME_GLASS.TREE_NODE_ON_PATH).toMatch(/border-indigo/);
    expect(THEME_GLASS.TREE_NODE_ACTIVE).toMatch(/border-indigo/);
    expect(THEME_GLASS.TREE_NODE_DEFAULT).not.toMatch(/border-indigo/);
  });

  it('pushes off-path nodes back with reduced opacity, restoring them on hover', () => {
    // Dimming the whole off-path node (not the on-path/current ones) is what makes
    // the active path pop; hover brings a receded node back so it stays browsable.
    expect(THEME_GLASS.TREE_NODE_DEFAULT).toMatch(/(?<!hover:)opacity-\[?0?\.?[1-5]/);
    expect(THEME_GLASS.TREE_NODE_DEFAULT).toMatch(/hover:opacity-100/);
    expect(THEME_GLASS.TREE_NODE_ON_PATH).not.toMatch(/opacity-/);
    expect(THEME_GLASS.TREE_NODE_ACTIVE).not.toMatch(/opacity-/);
  });

  it('brightens the active connecting edge distinctly from an inactive one', () => {
    expect(THEME_GLASS.TREE_LINE_STROKE_ACTIVE).not.toBe(THEME_GLASS.TREE_LINE_STROKE_INACTIVE);
    // Active edge is a saturated, near-opaque indigo so the path's links read
    // against the tree ground; the inactive edge is a faint white.
    expect(THEME_GLASS.TREE_LINE_STROKE_ACTIVE).toMatch(/129,\s*140,\s*248/);
    const activeAlpha = Number(THEME_GLASS.TREE_LINE_STROKE_ACTIVE.match(/,\s*([\d.]+)\)\s*$/)?.[1]);
    expect(activeAlpha).toBeGreaterThanOrEqual(0.8);
  });
});
