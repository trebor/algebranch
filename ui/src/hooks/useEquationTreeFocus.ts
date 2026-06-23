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
 * so a refocus is *armed* on the change and *fulfilled* once the first actionable
 * `[data-eq-node]` treeitem reappears — re-attempted whenever `candidatePathsKey`
 * changes.
 */
export function useEquationTreeFocus({
  containerRef,
  equationKey,
  candidatePathsKey,
  refocusNonce,
  selectionKey = null,
}: {
  /** Wrapper around the LHS/RHS node trees; scopes the first-term query. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Identity of the current equation; a change means a new tree to refocus. */
  equationKey: string;
  /** Changes when the candidate (actionable) set updates, signalling buttons may now exist. */
  candidatePathsKey: unknown;
  /** Bump to force a refocus even when focus was not previously in the tree. */
  refocusNonce: number;
  /**
   * The selected source path (or null). Selecting a source recomputes the
   * candidate set *without* changing the equation, so the focused term unmounts
   * and focus would drop to <body>. We arm a refocus when this becomes a
   * selection (null → a path) so the keyboard flow survives select→apply. A
   * deselect (path → null) does NOT arm — Escape deliberately releases focus to
   * the region container (#257).
   */
  selectionKey?: string | null;
}): {
  onFocusCapture: () => void;
  onBlurCapture: (e: React.FocusEvent) => void;
} {
  const focusWithinRef = React.useRef(false);
  const pendingRef = React.useRef(false);
  const prevKeyRef = React.useRef(equationKey);
  const prevNonceRef = React.useRef(refocusNonce);
  const prevSelectionRef = React.useRef(selectionKey);

  // Arm on equation change *only* if focus was in the tree; otherwise clear any
  // stale pending so a later candidate update can't grab focus out of the blue.
  React.useEffect(() => {
    if (equationKey !== prevKeyRef.current) {
      prevKeyRef.current = equationKey;
      pendingRef.current = focusWithinRef.current;
    }
  }, [equationKey]);

  // Arm when a source is newly selected (null → path) while focus was in the
  // tree. Only a *new* selection arms — a deselect must not yank focus back.
  React.useEffect(() => {
    if (selectionKey !== prevSelectionRef.current) {
      const becameSelected = !!selectionKey;
      prevSelectionRef.current = selectionKey;
      if (becameSelected && focusWithinRef.current) {
        pendingRef.current = true;
      }
    }
  }, [selectionKey]);

  // Explicit request (edit-modal submit) wins over the focus-within guard.
  // Defined after the change effect so it takes precedence when both fire.
  React.useEffect(() => {
    if (refocusNonce !== prevNonceRef.current) {
      prevNonceRef.current = refocusNonce;
      pendingRef.current = true;
    }
  }, [refocusNonce]);

  // Fulfill a pending refocus once an actionable term is present. Also keyed on
  // refocusNonce/selectionKey so a request lands even when the equation and
  // candidate set are otherwise unchanged (re-loading the active workspace; a
  // keyboard source selection).
  //
  // We key off the first actionable TERM — a treeitem carrying `aria-selected`
  // (#257) — rather than `[tabindex="0"]`. The roving controller promotes the
  // active item to `tabindex=0` one commit *after* the candidate set repopulates,
  // so a tabindex query would miss during that gap. Both settle on the same first
  // term, so focusing it directly is race-proof. Fall back to whatever the
  // controller has already made the active stop (a node hosting only a handle).
  //
  // The request stays *pending until focus actually rests inside the tree*: the
  // candidate set settles over several commits, and an applied transposition
  // re-parents the focused term as it changes sides — which blurs it to <body>
  // while it stays mounted. A one-shot refocus lands on the first commit but is
  // then blurred by a later re-parent. Re-landing focus after every commit (each
  // passive effect runs after that commit's DOM mutations) makes the final
  // position stick. Only a deliberate Tab-out clears a still-pending request
  // (handled in onBlurCapture).
  React.useEffect(() => {
    if (!pendingRef.current) return;
    const container = containerRef.current;
    // Focus already rests inside the tree → the request is satisfied.
    if (container && container.contains(document.activeElement)) {
      pendingRef.current = false;
      return;
    }
    const el =
      container?.querySelector<HTMLElement>('[data-eq-node][role="treeitem"][aria-selected]') ??
      container?.querySelector<HTMLElement>('[data-eq-node][role="treeitem"][tabindex="0"]');
    // Re-land focus but keep the request pending until a later run confirms it
    // stuck — a subsequent settling commit may re-parent and blur it again.
    if (el) el.focus();
  }, [candidatePathsKey, equationKey, refocusNonce, selectionKey, containerRef]);

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
      // The user deliberately tabbed out to other chrome — abandon any pending
      // refocus so a late settling commit can't yank focus back into the tree.
      focusWithinRef.current = false;
      pendingRef.current = false;
    },
    [containerRef],
  );

  return { onFocusCapture, onBlurCapture };
}
