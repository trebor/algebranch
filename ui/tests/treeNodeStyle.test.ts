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
