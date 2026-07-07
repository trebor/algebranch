// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Pure, DOM-free helpers backing the global keyboard-shortcut system. Kept free
 * of React/DOM imports so they can be unit-tested in the (node-environment)
 * math-engine jest suite, mirroring the `feedbackUrl` util pattern.
 */

/** Tag names whose focus should suppress shortcut handling. */
export const IGNORED_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Minimal structural shape of an event target needed to decide suppression.
 * A live `HTMLElement` is structurally compatible (it has `tagName` and
 * `isContentEditable`), so the real handler can pass `event.target` directly.
 */
export interface ShortcutTarget {
  tagName?: string | null;
  isContentEditable?: boolean;
}

/**
 * Whether focus sits in an editable field — an input/textarea/select or a
 * contenteditable element. The shared guard behind every "don't swallow the
 * user's typing" check, so the keyboard shortcuts and the ⌘C/⌘V clipboard bridge
 * agree on what "editable" means.
 */
export const isEditableTarget = (target: ShortcutTarget | null | undefined): boolean => {
  if (!target) return false;
  const tag = target.tagName?.toUpperCase();
  if (tag && IGNORED_TAGS.has(tag)) return true;
  return target.isContentEditable === true;
};

/**
 * Returns `true` when a global keyboard shortcut should NOT fire. A shortcut is
 * ignored when a modal is open (so it can't act on the obscured app behind it),
 * or when focus is inside an editable field (input/textarea/select/
 * contenteditable) so we don't swallow normal typing.
 */
export const shouldIgnoreShortcut = (
  target: ShortcutTarget | null | undefined,
  modalOpen: boolean
): boolean => {
  if (modalOpen) return true;
  return isEditableTarget(target);
};

/**
 * Whether a bare ⌘C should copy the current equation instead of doing a native
 * text copy (#440). Fires only when the selection is *collapsed* — a real text
 * selection always wins so we never hijack an ordinary copy — and focus is not
 * in an editable field. ⌘C then universally means "the visible thing, as text".
 */
export const shouldIdleCopy = (
  target: ShortcutTarget | null | undefined,
  selectionCollapsed: boolean
): boolean => {
  if (!selectionCollapsed) return false;
  return !isEditableTarget(target);
};

/**
 * Whether a ⌘V should open the New Equation modal seeded from the clipboard
 * (#440), rather than being left to the browser. Only when focus is not in an
 * editable field — paste while typing is always the native behavior.
 */
export const shouldPasteOpen = (
  target: ShortcutTarget | null | undefined
): boolean => !isEditableTarget(target);

/** Modifier symbols on macOS (glued together, no separator). */
const MAC_MODIFIERS = { meta: '⌘', shift: '⇧', alt: '⌥' } as const;
/** Modifier words on other platforms (joined with `+`). */
const OTHER_MODIFIERS = { meta: 'Ctrl', shift: 'Shift', alt: 'Alt' } as const;

/** Friendly display glyphs/labels for non-printable or special keys. */
const KEY_DISPLAY: Record<string, string> = {
  arrowright: '→',
  arrowleft: '←',
  arrowup: '↑',
  arrowdown: '↓',
  escape: 'Esc',
  backspace: '⌫',
  delete: 'Del',
  ' ': 'Space',
};

/** The modifier/key fields needed to render a shortcut for display. */
export interface ShortcutKeyParts {
  key: string;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

/**
 * Formats a shortcut as a human-readable key combo. macOS uses glued modifier
 * symbols (`⌘⇧W`); other platforms use plus-joined words (`Ctrl+Shift+W`).
 * Single letters are upper-cased; arrows/escape/space map to friendly glyphs;
 * punctuation passes through unchanged.
 */
export const formatShortcut = (parts: ShortcutKeyParts, isMac: boolean): string => {
  const mods = isMac ? MAC_MODIFIERS : OTHER_MODIFIERS;
  const tokens: string[] = [];
  if (parts.meta) tokens.push(mods.meta);
  if (parts.shift) tokens.push(mods.shift);
  if (parts.alt) tokens.push(mods.alt);

  const lowered = parts.key.toLowerCase();
  const display = KEY_DISPLAY[lowered] ?? (lowered.length === 1 ? lowered.toUpperCase() : parts.key);
  tokens.push(display);

  return tokens.join(isMac ? '' : '+');
};
