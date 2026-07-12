// @vitest-environment node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The keyboard-shortcut catalog (#514) is the single source of truth the in-app
// cheat-sheet, the `/shortcuts` reference page, and the live key handler all read.
// Like the /input-format reference (#507), it must never document a binding the
// app cannot render or dispatch. These tests pin the catalog's integrity so a
// malformed or duplicated entry fails CI rather than silently misleading a user.
import { describe, it, expect } from 'vitest';
import {
  SHORTCUT_CATALOG,
  SHORTCUT_ACTION_IDS,
  groupShortcutsByCategory,
} from '@/constants/shortcutCatalog';
import { formatShortcut, formatShortcutStatic } from '@/utils/keyboardShortcuts';

describe('shortcut catalog (#514)', () => {
  it('every entry has a unique, stable id', () => {
    const ids = SHORTCUT_CATALOG.map((s) => s.id);
    expect(new Set(ids).size, `duplicate ids: ${ids}`).toBe(ids.length);
    // SHORTCUT_ACTION_IDS is what page.tsx keys its action map on — it must be
    // exactly the catalog ids, or the app would document a binding it never wires.
    expect(SHORTCUT_ACTION_IDS).toEqual(ids);
  });

  it('every entry carries a description and a category', () => {
    for (const s of SHORTCUT_CATALOG) {
      expect(s.description.trim(), s.id).not.toBe('');
      expect((s.category ?? '').trim(), s.id).not.toBe('');
    }
  });

  it('every entry renders a non-empty keycap on both surfaces', () => {
    for (const s of SHORTCUT_CATALOG) {
      // keyLabel wins when set (e.g. `?`, `=`), matching what both surfaces show.
      const overlayCap = s.keyLabel ?? formatShortcut(s, false);
      const pageCap = s.keyLabel ?? formatShortcutStatic(s);
      expect(overlayCap.trim(), s.id).not.toBe('');
      expect(pageCap.trim(), s.id).not.toBe('');
    }
  });

  it('renders the meta modifier as Ctrl/Cmd on the static page', () => {
    const undo = SHORTCUT_CATALOG.find((s) => s.id === 'undo')!;
    expect(formatShortcutStatic(undo)).toBe('Ctrl/Cmd + Z');
    const redo = SHORTCUT_CATALOG.find((s) => s.id === 'redo')!;
    expect(formatShortcutStatic(redo)).toBe('Ctrl/Cmd + Shift + Z');
  });

  it('groups visible entries by category, dropping hidden ones and preserving order', () => {
    const groups = groupShortcutsByCategory(SHORTCUT_CATALOG);
    const flattened = groups.flatMap((g) => g.items);
    // No hidden entry (e.g. the Ctrl+Y redo alias, the bare `+`/`*` aliases) leaks
    // into the rendered surfaces.
    expect(flattened.some((s) => s.hidden)).toBe(false);
    expect(flattened.some((s) => s.id === 'redo-ctrl-y')).toBe(false);
    expect(flattened.some((s) => s.id === 'add-both-sides-bare')).toBe(false);
    // The canonical visible rows survive.
    expect(flattened.some((s) => s.id === 'undo')).toBe(true);
    expect(flattened.some((s) => s.id === 'add-both-sides')).toBe(true);
    // Category headings read in declaration order (History first, Both sides late).
    const categories = groups.map((g) => g.category);
    expect(categories[0]).toBe('History');
    expect(new Set(categories).size).toBe(categories.length);
  });

  it('marks ⌘C / ⌘V as display-only so they never reach the live handler', () => {
    for (const id of ['copy-equation-text', 'paste-new-equation'] as const) {
      const entry = SHORTCUT_CATALOG.find((s) => s.id === id)!;
      expect(entry.displayOnly, id).toBe(true);
    }
  });
});
