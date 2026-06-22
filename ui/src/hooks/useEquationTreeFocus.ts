// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import React from 'react';

/**
 * Keyboard-focus management for the equation tree (#231).
 *
 * When the active equation changes, a keyboard/screen-reader user who was
 * operating inside the tree (selecting a term, applying a transform) would
 * otherwise have focus dropped to `<body>` as their node unmounts — forcing
 * them to Tab all the way back in for the next move. This hook moves focus to
 * the first actionable ("green") term so the flow continues and a screen reader
 * announces where they landed.
 *
 * Two deliberate guards keep it from yanking a mouse user or jumping the page on
 * first paint:
 *  - It only refocuses on an equation change if focus was *already* inside the
 *    tree (`onFocusCapture`/`onBlurCapture` track this). A passive page load or
 *    a mouse-driven change leaves focus alone.
 *  - An explicit `refocusNonce` bump forces a refocus regardless of prior focus
 *    location — used for the edit-modal submit, where focus sits in the modal.
 *
 * The actionable nodes appear asynchronously (the math scan that computes the
 * candidate set runs after the equation commits, and is cleared mid-transition),
 * so a refocus is *armed* on the change and *fulfilled* once the first
 * `[data-eq-node]` button with `tabindex="0"` reappears — re-attempted whenever
 * `candidatePathsKey` changes.
 */
export function useEquationTreeFocus({
  containerRef,
  equationKey,
  candidatePathsKey,
  refocusNonce,
}: {
  /** Wrapper around the LHS/RHS node trees; scopes the first-term query. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Identity of the current equation; a change means a new tree to refocus. */
  equationKey: string;
  /** Changes when the candidate (actionable) set updates, signalling buttons may now exist. */
  candidatePathsKey: unknown;
  /** Bump to force a refocus even when focus was not previously in the tree. */
  refocusNonce: number;
}): {
  onFocusCapture: () => void;
  onBlurCapture: (e: React.FocusEvent) => void;
} {
  const focusWithinRef = React.useRef(false);
  const pendingRef = React.useRef(false);
  const prevKeyRef = React.useRef(equationKey);
  const prevNonceRef = React.useRef(refocusNonce);

  // Arm on equation change *only* if focus was in the tree; otherwise clear any
  // stale pending so a later candidate update can't grab focus out of the blue.
  React.useEffect(() => {
    if (equationKey !== prevKeyRef.current) {
      prevKeyRef.current = equationKey;
      pendingRef.current = focusWithinRef.current;
    }
  }, [equationKey]);

  // Explicit request (edit-modal submit) wins over the focus-within guard.
  // Defined after the change effect so it takes precedence when both fire.
  React.useEffect(() => {
    if (refocusNonce !== prevNonceRef.current) {
      prevNonceRef.current = refocusNonce;
      pendingRef.current = true;
    }
  }, [refocusNonce]);

  // Fulfill a pending refocus once an actionable term is present. Also keyed on
  // refocusNonce so an explicit request lands focus immediately even when the
  // equation and candidate set are unchanged (e.g. re-loading the already-active
  // workspace), where neither other dep would change to re-run this.
  React.useEffect(() => {
    if (!pendingRef.current) return;
    const el = containerRef.current?.querySelector<HTMLElement>('[data-eq-node][tabindex="0"]');
    if (el) {
      el.focus();
      pendingRef.current = false;
    }
  }, [candidatePathsKey, equationKey, refocusNonce, containerRef]);

  const onFocusCapture = React.useCallback(() => {
    focusWithinRef.current = true;
  }, []);

  const onBlurCapture = React.useCallback(
    (e: React.FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      // Focus moved within the tree, or the blur is from a node unmounting
      // (relatedTarget null) mid-transition — keep the "in tree" flag so the
      // pending refocus still fires.
      if (next === null) return;
      if (containerRef.current?.contains(next)) return;
      // The user deliberately tabbed out to other chrome.
      focusWithinRef.current = false;
    },
    [containerRef],
  );

  return { onFocusCapture, onBlurCapture };
}
