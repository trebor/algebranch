// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * The canonical keyboard-shortcut catalog (#514). The single source of truth for
 * "what keys does Algebranch respond to", shared by every surface that documents
 * or dispatches a shortcut:
 *   - the in-app `ShortcutsOverlay` cheat-sheet (the `K` overlay),
 *   - the `/shortcuts` on-domain reference page (crawlable, zero-hydration),
 *   - the live key handler in `app/page.tsx`, which attaches an `action` to each
 *     entry by `id` (see `SHORTCUT_ACTION_IDS`).
 *
 * Every catalog entry carries the *matching* fields the handler consumes (key,
 * modifiers, leader) **and** the *display* fields the cheat-sheet and page render
 * (description, category, keyLabel, hidden). Because the live bindings are built
 * as `catalog entry + action`, the documentation and the behavior can never
 * drift — there is one list, and `page.tsx` must supply an action for each `id`
 * (enforced at compile time by the `Record<ShortcutId, …>` action map).
 *
 * This mirrors the `/input-format` precedent (#507): a serializable catalog that
 * the reference page and the app both read, so a published binding is always a
 * binding the app actually has.
 */
import type { ShortcutConfig } from '../hooks/useKeyboardShortcuts';

/**
 * Stable identifier for every binding in the catalog. `page.tsx` keys its action
 * map on this union, so adding an entry here forces a matching action there (and
 * removing an action for a still-listed id is a type error) — the compile-time
 * half of the no-drift guarantee.
 */
export type ShortcutId =
  | 'cycle-zoom'
  | 'undo'
  | 'redo'
  | 'redo-ctrl-y'
  | 'toggle-workspace'
  | 'toggle-library'
  | 'toggle-history'
  | 'clear-selection'
  | 'swap-sides'
  | 'toggle-graph'
  | 'toggle-read-view'
  | 'text-size-larger'
  | 'text-size-smaller'
  | 'copy-equation-text'
  | 'paste-new-equation'
  | 'share-equation-link'
  | 'share-derivation-link'
  | 'share-workspace-link'
  | 'new-workspace'
  | 'close-workspace'
  | 'close-workspace-delete'
  | 'next-workspace'
  | 'prev-workspace'
  | 'help'
  | 'shortcuts-overlay'
  | 'about'
  | 'feedback'
  | 'equals-menu'
  | 'add-both-sides'
  | 'add-both-sides-bare'
  | 'sub-both-sides'
  | 'mul-both-sides'
  | 'mul-both-sides-bare'
  | 'div-both-sides'
  | 'power-both-sides'
  | 'root-both-sides'
  | 'settings'
  | 'settings-meta';

/**
 * A catalog entry: every {@link ShortcutConfig} field except the runtime
 * `action` (supplied by `page.tsx` per `id`) and with `id` required and narrowed
 * to {@link ShortcutId}.
 */
export type ShortcutCatalogEntry = Omit<ShortcutConfig, 'action' | 'id'> & {
  id: ShortcutId;
};

/**
 * The catalog, in declaration order. Order is meaningful for display: the
 * cheat-sheet and `/shortcuts` page group by category preserving first-seen
 * order, so entries read in the sequence below. (The live handler matches by
 * key+modifiers, so order is not correctness-critical there.)
 */
export const SHORTCUT_CATALOG: ShortcutCatalogEntry[] = [
  { id: 'cycle-zoom', key: 'z', description: 'Cycle history tree zoom level', category: 'History' },
  { id: 'undo', key: 'z', meta: true, description: 'Undo step', category: 'History' },
  { id: 'redo', key: 'z', meta: true, shift: true, description: 'Redo step', category: 'History' },
  // Ctrl+Y redo alias; hidden so the cheat-sheet shows the single canonical row.
  { id: 'redo-ctrl-y', key: 'y', meta: true, description: 'Redo step (Ctrl+Y)', category: 'History', hidden: true },
  { id: 'toggle-workspace', key: 'w', description: 'Toggle Workspace panel', category: 'Panels' },
  { id: 'toggle-library', key: 'l', description: 'Toggle Equation Library', category: 'Panels' },
  { id: 'toggle-history', key: 'h', description: 'Toggle History Sidebar', category: 'Panels' },
  { id: 'clear-selection', key: 'escape', description: 'Clear selection', category: 'Equation' },
  { id: 'swap-sides', key: 's', description: 'Swap equation sides', category: 'Equation' },
  { id: 'toggle-graph', key: 'g', description: 'Toggle variable relationship graph size', category: 'Equation' },
  { id: 'toggle-read-view', key: 'x', description: 'Toggle Read view', category: 'Accessibility' },
  { id: 'text-size-larger', key: 't', description: 'Larger interface text', category: 'Accessibility' },
  { id: 'text-size-smaller', key: 't', shift: true, description: 'Smaller interface text', category: 'Accessibility' },
  // ⌘C / ⌘V are handled by useClipboardBridge (native copy/paste events), not the
  // keydown handler — displayOnly rows document them in the cheat-sheet without
  // ever reaching the live handler (which would preventDefault and hijack copy).
  { id: 'copy-equation-text', key: 'c', meta: true, description: 'Copy equation as text', category: 'Copy & Share', displayOnly: true },
  { id: 'paste-new-equation', key: 'v', meta: true, description: 'New equation from clipboard', category: 'Copy & Share', displayOnly: true },
  // Copy/share family under the `C` leader (#239, #481): C E / C D / C W each copy
  // a short link for one Share-menu scope. Leader keys are bare, so native ⌘C is
  // untouched.
  { id: 'share-equation-link', leader: 'c', key: 'e', description: 'Copy equation link', category: 'Copy & Share' },
  { id: 'share-derivation-link', leader: 'c', key: 'd', description: 'Copy derivation link', category: 'Copy & Share' },
  { id: 'share-workspace-link', leader: 'c', key: 'w', description: 'Copy workspace link', category: 'Copy & Share' },
  { id: 'new-workspace', key: 'n', description: 'New workspace', category: 'Workspaces' },
  // Cmd/Ctrl+Backspace (Delete is a hidden alias below). The modifier keeps an
  // idle Backspace from closing workspaces by accident.
  { id: 'close-workspace', key: 'backspace', meta: true, description: 'Close workspace', category: 'Workspaces' },
  { id: 'close-workspace-delete', key: 'delete', meta: true, description: 'Close workspace', category: 'Workspaces', hidden: true },
  // Bare `]` / `[` (editor convention) dodges the browser/OS tab-switch hijacks.
  { id: 'next-workspace', key: ']', description: 'Next workspace', category: 'Workspaces' },
  { id: 'prev-workspace', key: '[', description: 'Previous workspace', category: 'Workspaces' },
  // `?` is Shift+`/` on the keyboards we target; keyLabel shows the plain glyph.
  { id: 'help', key: '?', shift: true, description: 'Help', category: 'Help', keyLabel: '?' },
  // `id` also lets the overlay footer look up its own reopen key; bare `k` formats
  // to the `K` keycap like every other letter, so no keyLabel is needed.
  { id: 'shortcuts-overlay', key: 'k', description: 'Show keyboard shortcuts', category: 'Help' },
  { id: 'about', key: 'a', description: 'About Algebranch', category: 'Help' },
  { id: 'feedback', key: 'f', description: 'Send feedback', category: 'Help' },
  // Open the global equals menu (apply an operation to both sides) — same as
  // clicking the = sign.
  { id: 'equals-menu', key: '=', description: 'Apply an operation to both sides', category: 'Equation', keyLabel: '=' },
  // Direct hotkeys into each equals operation's input panel (#322). `+` and `*`
  // sit behind Shift on US main rows but are bare on numpads, so each gets a
  // hidden bare alias. keyLabel shows the literal key you press, not the
  // operation glyph (`+` not `＋`, `*` not `×`).
  { id: 'add-both-sides', key: '+', shift: true, description: 'Add to both sides', category: 'Both sides', keyLabel: '+' },
  { id: 'add-both-sides-bare', key: '+', description: 'Add to both sides', category: 'Both sides', hidden: true },
  { id: 'sub-both-sides', key: '-', description: 'Subtract from both sides', category: 'Both sides', keyLabel: '-' },
  { id: 'mul-both-sides', key: '*', shift: true, description: 'Multiply both sides', category: 'Both sides', keyLabel: '*' },
  { id: 'mul-both-sides-bare', key: '*', description: 'Multiply both sides', category: 'Both sides', hidden: true },
  { id: 'div-both-sides', key: '/', description: 'Divide both sides', category: 'Both sides', keyLabel: '/' },
  { id: 'power-both-sides', key: 'p', description: 'Raise both sides to a power', category: 'Both sides' },
  { id: 'root-both-sides', key: 'r', description: 'Take a root of both sides', category: 'Both sides' },
  // Settings on bare `,`, echoing the universal ⌘, convention; ⌘, is a hidden
  // alias for muscle memory.
  { id: 'settings', key: ',', description: 'Settings', category: 'Help', keyLabel: ',' },
  { id: 'settings-meta', key: ',', meta: true, description: 'Settings', category: 'Help', hidden: true },
];

/** Every id in the catalog, as a set, for validating the action map covers it. */
export const SHORTCUT_ACTION_IDS: ShortcutId[] = SHORTCUT_CATALOG.map((entry) => entry.id);

export interface ShortcutCategoryGroup<T> {
  category: string;
  items: T[];
}

const UNCATEGORIZED = 'Other';

/**
 * Groups (non-hidden) entries by category, preserving first-seen order so both
 * the overlay and the `/shortcuts` page read in declaration order. Generic over
 * the entry shape so it serves both catalog entries and live `ShortcutConfig`
 * bindings (which are catalog entries plus an `action`).
 */
export function groupShortcutsByCategory<
  T extends { category?: string; hidden?: boolean },
>(entries: T[]): ShortcutCategoryGroup<T>[] {
  const groups: ShortcutCategoryGroup<T>[] = [];
  entries.forEach((entry) => {
    if (entry.hidden) return;
    const category = entry.category ?? UNCATEGORIZED;
    const existing = groups.find((g) => g.category === category);
    if (existing) {
      existing.items.push(entry);
    } else {
      groups.push({ category, items: [entry] });
    }
  });
  return groups;
}
