// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { useEffect, useRef } from 'react';
import { shouldIgnoreShortcut } from '../utils/keyboardShortcuts';

/**
 * Describes a single keyboard shortcut binding.
 */
export interface ShortcutConfig {
  /**
   * The key to match (lowercase), e.g. `'z'`, `'b'`, `'h'`, `'s'`. When
   * {@link ShortcutConfig.leader} is set this is the *second* key of the
   * sequence (e.g. `leader: 'c', key: 'd'` for "C then D").
   */
  key: string;
  /**
   * Leader key for a two-step sequence (Vim/GitHub-style). When set, the
   * binding fires only when the bare leader key is pressed, followed by
   * {@link ShortcutConfig.key} within {@link LEADER_TIMEOUT_MS}. Sequence keys
   * are matched bare — modifiers never arm or complete a sequence, so native
   * combos like ⌘C are untouched.
   */
  leader?: string;
  /** When `true`, requires Cmd (Mac) **or** Ctrl (Windows/Linux). */
  meta?: boolean;
  /** When `true`, requires the Shift modifier. */
  shift?: boolean;
  /** When `true`, requires the Alt / Option modifier. */
  alt?: boolean;
  /**
   * Stable identifier for referencing one specific binding from the UI — e.g. the
   * shortcuts overlay's footer looking up its own reopen key so the hint stays in
   * sync with the binding instead of hardcoding the letter. Optional; most
   * bindings never need it.
   */
  id?: string;
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

/** How long a pressed leader key stays "armed" awaiting its second key. */
export const LEADER_TIMEOUT_MS = 1500;

/** Options controlling the shortcut listener as a whole. */
export interface UseKeyboardShortcutsOptions {
  /**
   * When `true`, all shortcuts are suppressed — e.g. while a modal is open, so a
   * bare-key binding can't act on the app obscured behind the dialog.
   */
  disabled?: boolean;
  /**
   * Notified whenever the armed leader key changes — the leader's lowercase
   * letter while a sequence is pending, then `null` when it completes, aborts,
   * or times out. Lets the UI surface a hint (e.g. "C …").
   */
  onPendingLeader?: (leader: string | null) => void;
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

  // Pending leader state for two-step sequences. Refs (not state) so the stable
  // listener always sees the latest without re-registering.
  const pendingLeaderRef = useRef<string | null>(null);
  const leaderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearPendingLeader = () => {
      if (leaderTimerRef.current) {
        clearTimeout(leaderTimerRef.current);
        leaderTimerRef.current = null;
      }
      if (pendingLeaderRef.current !== null) {
        pendingLeaderRef.current = null;
        optionsRef.current.onPendingLeader?.(null);
      }
    };

    function handleKeyDown(event: KeyboardEvent): void {
      if (shouldIgnoreShortcut(event.target as HTMLElement | null, optionsRef.current.disabled ?? false)) {
        return;
      }

      const pressedKey = event.key.toLowerCase();
      const hasMeta = event.metaKey || event.ctrlKey;
      const isBare = !hasMeta && !event.shiftKey && !event.altKey;

      // --- Complete (or abort) a pending leader sequence ---
      if (pendingLeaderRef.current) {
        const leader = pendingLeaderRef.current;
        clearPendingLeader();
        if (pressedKey === 'escape') {
          // Escape cancels the armed leader without doing anything else.
          event.preventDefault();
          return;
        }
        if (isBare) {
          const seq = shortcutsRef.current.find(
            (s) =>
              s.enabled !== false &&
              s.leader?.toLowerCase() === leader &&
              s.key.toLowerCase() === pressedKey,
          );
          if (seq) {
            event.preventDefault();
            seq.action();
            return;
          }
        }
        // No matching sequence — fall through and treat this key as a fresh
        // press (so e.g. an unrelated bare key still does its own thing).
      }

      // --- Single-chord match ---
      for (const shortcut of shortcutsRef.current) {
        if (shortcut.enabled === false) continue;
        if (shortcut.leader) continue; // sequence bindings handled below

        if (pressedKey !== shortcut.key.toLowerCase()) continue;

        const wantMeta = shortcut.meta ?? false;
        const wantShift = shortcut.shift ?? false;
        const wantAlt = shortcut.alt ?? false;

        if (wantMeta !== hasMeta) continue;
        if (wantShift !== event.shiftKey) continue;
        if (wantAlt !== event.altKey) continue;

        event.preventDefault();
        shortcut.action();
        return; // First match wins.
      }

      // --- Arm a leader, if this bare key starts any sequence ---
      if (isBare) {
        const isLeader = shortcutsRef.current.some(
          (s) => s.enabled !== false && s.leader?.toLowerCase() === pressedKey,
        );
        if (isLeader) {
          event.preventDefault();
          pendingLeaderRef.current = pressedKey;
          optionsRef.current.onPendingLeader?.(pressedKey);
          leaderTimerRef.current = setTimeout(clearPendingLeader, LEADER_TIMEOUT_MS);
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearPendingLeader();
    };
  }, []); // Stable — never re-registers.
}
