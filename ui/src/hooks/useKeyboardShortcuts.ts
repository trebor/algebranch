// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { useEffect, useRef } from 'react';
import { shouldIgnoreShortcut } from '../utils/keyboardShortcuts';

/**
 * Describes a single keyboard shortcut binding.
 */
export interface ShortcutConfig {
  /** The key to match (lowercase), e.g. `'z'`, `'b'`, `'h'`, `'s'`. */
  key: string;
  /** When `true`, requires Cmd (Mac) **or** Ctrl (Windows/Linux). */
  meta?: boolean;
  /** When `true`, requires the Shift modifier. */
  shift?: boolean;
  /** When `true`, requires the Alt / Option modifier. */
  alt?: boolean;
  /** Callback executed when the shortcut fires. */
  action: () => void;
  /** Human-readable label (shown in the shortcuts cheat-sheet overlay). */
  description: string;
  /** Grouping heading for the cheat-sheet overlay (e.g. `'Workspaces'`). */
  category?: string;
  /**
   * Display override for the cheat-sheet, used when the literal modifier+key
   * formatting would mislead — e.g. `?` is matched as `Shift`+`?` but should
   * read simply as `?`. When set, the overlay shows this verbatim.
   */
  keyLabel?: string;
  /** When `true`, the binding works but is omitted from the cheat-sheet. */
  hidden?: boolean;
  /** Set to `false` to temporarily disable this shortcut. Defaults to `true`. */
  enabled?: boolean;
}

/** Options controlling the shortcut listener as a whole. */
export interface UseKeyboardShortcutsOptions {
  /**
   * When `true`, all shortcuts are suppressed — e.g. while a modal is open, so a
   * bare-key binding can't act on the app obscured behind the dialog.
   */
  disabled?: boolean;
}

/**
 * Registers global keyboard shortcuts via a single `keydown` listener on
 * `document`. Shortcuts are automatically ignored when focus is inside an
 * input, textarea, select, or contenteditable element, or when `disabled` is
 * set (see {@link UseKeyboardShortcutsOptions}).
 *
 * The hook stores the shortcuts array and options in refs so the listener
 * identity remains stable across re-renders — no effect teardown/setup churn.
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts([
 *   { key: 'z', meta: true,              action: undo,  description: 'Undo' },
 *   { key: 'z', meta: true, shift: true,  action: redo,  description: 'Redo' },
 *   { key: 'b', meta: true,              action: bold,  description: 'Bold' },
 * ], { disabled: isModalOpen });
 * ```
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutConfig[],
  options: UseKeyboardShortcutsOptions = {},
): void {
  // Keep mutable refs so the keydown handler always sees the latest shortcuts
  // and options without needing to re-register the listener.
  const shortcutsRef = useRef<ShortcutConfig[]>(shortcuts);
  const optionsRef = useRef<UseKeyboardShortcutsOptions>(options);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (shouldIgnoreShortcut(event.target as HTMLElement | null, optionsRef.current.disabled ?? false)) {
        return;
      }

      const pressedKey = event.key.toLowerCase();

      for (const shortcut of shortcutsRef.current) {
        // Skip disabled shortcuts.
        if (shortcut.enabled === false) continue;

        // --- Key match ---
        if (pressedKey !== shortcut.key.toLowerCase()) continue;

        // --- Modifier match ---
        const wantMeta = shortcut.meta ?? false;
        const wantShift = shortcut.shift ?? false;
        const wantAlt = shortcut.alt ?? false;

        const hasMeta = event.metaKey || event.ctrlKey;

        if (wantMeta !== hasMeta) continue;
        if (wantShift !== event.shiftKey) continue;
        if (wantAlt !== event.altKey) continue;

        // All conditions satisfied — fire the action.
        event.preventDefault();
        shortcut.action();
        return; // First match wins.
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // Stable — never re-registers.
}
