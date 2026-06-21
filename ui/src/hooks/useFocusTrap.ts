// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface FocusTrapOptions {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Element to focus when the dialog opens. Defaults to the first focusable
   * descendant. Use this when a specific control (e.g. a text input) should
   * receive focus rather than the first tab stop.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Accessibility hook for modal dialogs. While `isOpen`, it:
 *  - moves focus into the dialog,
 *  - keeps Tab / Shift+Tab cycling within the dialog (focus trap),
 *  - calls `onClose` on Escape,
 *  - locks body scroll, and
 *  - restores focus to the previously-focused element on close.
 *
 * Attach the returned ref to the dialog container. Pair it with
 * `role="dialog"`, `aria-modal="true"`, and an accessible name on that element.
 *
 * `onClose` is read through a ref so that changing its identity across renders
 * does not re-run the effect (which would prematurely restore focus).
 */
export function useFocusTrap<T extends HTMLElement>({
  isOpen,
  onClose,
  initialFocusRef,
}: FocusTrapOptions) {
  const containerRef = useRef<T>(null);

  // Keep the latest onClose in a ref so the trap effect can stay keyed on
  // `isOpen` alone — re-running it on every onClose identity change would
  // prematurely restore focus while the dialog is still open.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );

    // Move focus into the dialog: a caller-specified element, else the first
    // focusable descendant, else the container itself.
    const initial = getFocusable();
    (initialFocusRef?.current ?? initial[0] ?? container).focus();

    // Listen at the document level (not the container) so the trap still works
    // when focus has been pushed outside the dialog — e.g. a transient overlay
    // stole focus and released it to the body. A container-scoped listener
    // would go deaf the moment focus left the dialog.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Act only when the Escape originated from within this dialog (or from
        // the body). If it came from a separate on-screen surface — e.g. a
        // non-modal banner layered over this dialog — let that surface handle
        // its own Escape instead of closing this one underneath it.
        //
        // We key off e.target (where the event originated), NOT
        // document.activeElement: a handler running earlier in the same event
        // (e.g. that banner dismissing and restoring focus into this dialog)
        // can move activeElement mid-flight, which would otherwise make us
        // close spuriously. This is also robust against a global Escape handler
        // that calls preventDefault, so we can't rely on defaultPrevented.
        const target = e.target as Node | null;
        if (
          container.contains(target) ||
          target === document.body ||
          target === null
        ) {
          e.preventDefault();
          onCloseRef.current();
        }
        return;
      }
      if (e.key !== 'Tab') return;

      const items = getFocusable();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (!container.contains(active)) {
        // Focus is outside the dialog. Only recapture when it landed on nothing
        // (body/null) so we don't yank focus from a legitimately separate,
        // non-modal surface that's still on screen.
        if (active === document.body || active === null) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
        return;
      }

      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen, initialFocusRef]);

  return containerRef;
}
