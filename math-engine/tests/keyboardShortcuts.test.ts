// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import {
  shouldIgnoreShortcut,
  formatShortcut,
  ShortcutTarget,
} from '../../ui/src/utils/keyboardShortcuts';

describe('shouldIgnoreShortcut', () => {
  const div: ShortcutTarget = { tagName: 'DIV', isContentEditable: false };

  it('suppresses every shortcut while a modal is open, regardless of target', () => {
    expect(shouldIgnoreShortcut(div, true)).toBe(true);
    expect(shouldIgnoreShortcut(null, true)).toBe(true);
  });

  it('does not suppress on a non-editable target when no modal is open', () => {
    expect(shouldIgnoreShortcut(div, false)).toBe(false);
    expect(shouldIgnoreShortcut({ tagName: 'BUTTON' }, false)).toBe(false);
  });

  it('treats a null/undefined target as not-ignored (no modal)', () => {
    expect(shouldIgnoreShortcut(null, false)).toBe(false);
    expect(shouldIgnoreShortcut(undefined, false)).toBe(false);
  });

  it('suppresses while focus is in an editable field', () => {
    expect(shouldIgnoreShortcut({ tagName: 'INPUT' }, false)).toBe(true);
    expect(shouldIgnoreShortcut({ tagName: 'TEXTAREA' }, false)).toBe(true);
    expect(shouldIgnoreShortcut({ tagName: 'SELECT' }, false)).toBe(true);
  });

  it('suppresses on a contenteditable element even with a non-form tag', () => {
    expect(shouldIgnoreShortcut({ tagName: 'DIV', isContentEditable: true }, false)).toBe(true);
  });

  it('matches tag names case-insensitively (defensive against lowercase input)', () => {
    expect(shouldIgnoreShortcut({ tagName: 'input' }, false)).toBe(true);
  });
});

describe('formatShortcut', () => {
  it('renders Mac modifiers as glued symbols', () => {
    expect(formatShortcut({ key: 'w', meta: true, shift: true }, true)).toBe('⌘⇧W');
    expect(formatShortcut({ key: 'z', meta: true }, true)).toBe('⌘Z');
  });

  it('renders non-Mac modifiers as plus-joined words', () => {
    expect(formatShortcut({ key: 'w', meta: true, shift: true }, false)).toBe('Ctrl+Shift+W');
    expect(formatShortcut({ key: 'z', meta: true }, false)).toBe('Ctrl+Z');
  });

  it('orders modifiers meta → shift → alt', () => {
    expect(formatShortcut({ key: 'a', meta: true, shift: true, alt: true }, false)).toBe(
      'Ctrl+Shift+Alt+A'
    );
  });

  it('uppercases single-letter bare keys', () => {
    expect(formatShortcut({ key: 'n' }, true)).toBe('N');
    expect(formatShortcut({ key: 'g' }, false)).toBe('G');
  });

  it('maps special keys to friendly glyphs/labels', () => {
    expect(formatShortcut({ key: 'arrowright' }, true)).toBe('→');
    expect(formatShortcut({ key: 'arrowleft' }, false)).toBe('←');
    expect(formatShortcut({ key: 'escape' }, false)).toBe('Esc');
    expect(formatShortcut({ key: 'backspace' }, true)).toBe('⌫');
    expect(formatShortcut({ key: 'delete' }, false)).toBe('Del');
    expect(formatShortcut({ key: 'backspace', meta: true }, true)).toBe('⌘⌫');
    expect(formatShortcut({ key: 'backspace', meta: true }, false)).toBe('Ctrl+⌫');
  });

  it('passes punctuation keys through unchanged', () => {
    expect(formatShortcut({ key: ']' }, true)).toBe(']');
    expect(formatShortcut({ key: '[' }, false)).toBe('[');
    expect(formatShortcut({ key: '?' }, false)).toBe('?');
  });
});
