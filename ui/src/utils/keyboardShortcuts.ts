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
  if (!target) return false;
  const tag = target.tagName?.toUpperCase();
  if (tag && IGNORED_TAGS.has(tag)) return true;
  if (target.isContentEditable) return true;
  return false;
};

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
