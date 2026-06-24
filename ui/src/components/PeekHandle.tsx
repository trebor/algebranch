// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { THEME_GLASS } from '../constants/theme';

/**
 * The always-reachable escape from immersive hide-chrome mode (#252). Thin tabs
 * hug the top and bottom edges; tapping either slides the hidden header +
 * BottomNav back in. Rendered only while immersive is active (page.tsx gates
 * this), so it never sits in the tab order when the chrome is already shown.
 *
 * Both tabs are real <button>s — keyboard-focusable and Enter/Space-activatable
 * — with the same accessible name, since either restores the same chrome.
 */
export function PeekHandle({ onExit }: { onExit: () => void }) {
  return (
    <>
      {/* Top tab — pull the header back down. */}
      <button
        onClick={onExit}
        aria-label="Show toolbars"
        className={`fixed top-1 left-1/2 -translate-x-1/2 z-[60] ${THEME_GLASS.PEEK_HANDLE}`}
      >
        <ChevronDown size={14} />
      </button>
      {/* Bottom tab — pull the nav back up; clears the home-indicator safe area. */}
      <button
        onClick={onExit}
        aria-label="Show toolbars"
        className={`fixed bottom-[calc(0.25rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[60] ${THEME_GLASS.PEEK_HANDLE}`}
      >
        <ChevronUp size={14} />
      </button>
    </>
  );
}
