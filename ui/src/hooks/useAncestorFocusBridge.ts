// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useSetAtom } from 'jotai';
import { announceNavAtom } from '../store/equation';

/**
 * Bridges the VoiceOver ancestor-containment quirk in the Interaction tree
 * (#270/#271). When keyboard focus moves to an element that CONTAINS the one you came
 * from — a parent term on ArrowUp/Escape, or a term you return to from its handle —
 * VoiceOver treats it as stepping OUT to a group and announces "group", staying silent
 * on the term's label. (Both roving focus and aria-activedescendant hit this; only the
 * read view escapes it, by dropping focus semantics entirely.)
 *
 * Returns an `onFocusCapture` handler for the tree container: it detects exactly that
 * case (the newly-focused element contains the previously-focused one) and pushes the
 * destination treeitem's OWN live aria-label — matching its current candidate/selected/
 * target state — into the assertive nav live region so it gets spoken. Normal sibling
 * and descendant landings are left alone; VoiceOver narrates those correctly on its own.
 */
export function useAncestorFocusBridge(): (e: React.FocusEvent) => void {
  const announceNav = useSetAtom(announceNavAtom);
  const prevRef = React.useRef<HTMLElement | null>(null);
  return React.useCallback(
    (e: React.FocusEvent) => {
      const target = e.target as HTMLElement;
      const prev = prevRef.current;
      if (
        prev &&
        target !== prev &&
        target !== e.currentTarget &&
        target.getAttribute('role') === 'treeitem' &&
        target.contains(prev)
      ) {
        const label = target.getAttribute('aria-label');
        if (label) announceNav(label);
      }
      prevRef.current = target;
    },
    [announceNav],
  );
}
