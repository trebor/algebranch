import { THEME_GLASS } from '@/constants/theme';

/**
 * Visual state of a history-tree step node. A node can satisfy several of these
 * at once — the current (cursor) node is always on the active path — so the
 * priority below, not mere membership, decides its look.
 *
 * - `isOnPath`: the node lies on the active derivation path from the root to the
 *   cursor (#305). Highlighting the whole path makes the working column read as a
 *   connected whole, unmistakable against inactive branches.
 */
export interface TreeNodeState {
  isLoopHighlight: boolean;
  isCurrent: boolean;
  isOnPath: boolean;
}

/**
 * Resolve a node's card + badge style tokens in priority order:
 * loop-highlight > current > on-active-path > default. The on-path style is
 * deliberately subtler than the current node's so the cursor stays the focal
 * point while its ancestry still stands out from other branches.
 */
export function treeNodeStyle(state: TreeNodeState): { card: string; badge: string } {
  if (state.isLoopHighlight) {
    return { card: THEME_GLASS.TREE_NODE_LOOP, badge: THEME_GLASS.TREE_NODE_BADGE_LOOP };
  }
  if (state.isCurrent) {
    return { card: THEME_GLASS.TREE_NODE_ACTIVE, badge: THEME_GLASS.TREE_NODE_BADGE_ACTIVE };
  }
  if (state.isOnPath) {
    return { card: THEME_GLASS.TREE_NODE_ON_PATH, badge: THEME_GLASS.TREE_NODE_BADGE_ON_PATH };
  }
  return { card: THEME_GLASS.TREE_NODE_DEFAULT, badge: THEME_GLASS.TREE_NODE_BADGE_DEFAULT };
}
