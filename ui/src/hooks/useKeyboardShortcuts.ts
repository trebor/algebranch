'use client';

import { useEffect, useRef } from 'react';

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
  /** Human-readable label (for a future shortcut-help overlay). */
  description: string;
  /** Set to `false` to temporarily disable this shortcut. Defaults to `true`. */
  enabled?: boolean;
}

/** Tag names whose focus should suppress shortcut handling. */
const IGNORED_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Returns `true` when the currently focused element is an editable field
 * (input, textarea, select, or contenteditable) so we don't swallow
 * normal typing.
 */
function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  if (IGNORED_TAGS.has(target.tagName)) return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * Registers global keyboard shortcuts via a single `keydown` listener on
 * `document`. Shortcuts are automatically ignored when focus is inside an
 * input, textarea, select, or contenteditable element.
 *
 * The hook stores the shortcuts array in a ref so the listener identity
 * remains stable across re-renders — no effect teardown/setup churn.
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts([
 *   { key: 'z', meta: true,              action: undo,  description: 'Undo' },
 *   { key: 'z', meta: true, shift: true,  action: redo,  description: 'Redo' },
 *   { key: 'b', meta: true,              action: bold,  description: 'Bold' },
 * ]);
 * ```
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]): void {
  // Keep a mutable ref so the keydown handler always sees the latest
  // shortcuts without needing to re-register the listener.
  const shortcutsRef = useRef<ShortcutConfig[]>(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (isEditableTarget(event)) return;

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
