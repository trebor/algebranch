// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { useEffect, useRef } from 'react';
import { shouldIdleCopy, shouldPasteOpen } from '../utils/keyboardShortcuts';

/**
 * Callbacks + state the ⌘C / ⌘V bridge needs, kept as a plain object so the hook
 * stays decoupled from app state and is unit-testable.
 */
export interface ClipboardBridgeOptions {
  /**
   * The current equation as Unicode text, or `null` when there's nothing to copy.
   * Read lazily on each ⌘C so the bridge always sees the live equation without
   * re-registering listeners.
   */
  getEquationUnicode: () => string | null;
  /** Fired after a successful idle ⌘C copy (e.g. toast + analytics). */
  onIdleCopy: () => void;
  /** Fired with the pasted text when ⌘V should open the New Equation modal. */
  onPaste: (text: string) => void;
  /** When `true`, the bridge is inert — e.g. while a modal is open. */
  disabled?: boolean;
}

/**
 * Wires app-aware ⌘C / ⌘V by intercepting the native `copy` / `paste` events on
 * `document` (#440) — not keydown, so a real text selection copies normally and
 * only an *idle* ⌘C is repurposed.
 *
 * - **copy**: with a collapsed selection and non-editable focus, write the current
 *   equation's Unicode to the clipboard (mirrors the history-card copy default).
 *   Never emits a URL — ⌘C always means "the visible thing, as text".
 * - **paste**: with non-editable focus and non-blank clipboard text, open the New
 *   Equation modal seeded from it. Paste while typing stays native.
 *
 * Options live in a ref so the listeners register once and never churn.
 */
export function useClipboardBridge(options: ClipboardBridgeOptions): void {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      const opts = optionsRef.current;
      if (opts.disabled) return;
      const collapsed = window.getSelection()?.isCollapsed ?? true;
      if (!shouldIdleCopy(event.target as HTMLElement | null, collapsed)) return;
      const text = opts.getEquationUnicode();
      if (!text) return;
      event.preventDefault();
      event.clipboardData?.setData('text/plain', text);
      opts.onIdleCopy();
    };

    const handlePaste = (event: ClipboardEvent) => {
      const opts = optionsRef.current;
      if (opts.disabled) return;
      if (!shouldPasteOpen(event.target as HTMLElement | null)) return;
      const text = event.clipboardData?.getData('text') ?? '';
      if (!text.trim()) return;
      event.preventDefault();
      opts.onPaste(text);
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
    };
  }, []); // Stable — reads live options via the ref.
}
