// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useSetAtom } from 'jotai';
import { rightSidebarOpenAtom } from '../store/equation';
import { THEME_GLASS } from '../constants/theme';

/**
 * Keyboard "fast lane" skip links (#257, PR A).
 *
 * Rendered first inside <main> so they are the very first Tab stop. Each stays
 * visually hidden (`sr-only`) until focused, then surfaces as a pill and jumps
 * focus to the matching landmark region — letting a keyboard-only or
 * screen-reader user bypass the chrome between regions (WCAG 2.4.1).
 *
 * We move focus explicitly rather than relying on `href="#id"` fragment
 * navigation: the targets carry `tabIndex={-1}` and explicit `.focus()` is the
 * portable way to land focus (and works under jsdom, where fragment nav is a
 * no-op). The history region lives in the right sidebar, which is collapsed by
 * default on desktop (opacity/width-0, *not* display:none) — so we open it on
 * the way in so the user actually sees where they landed.
 */
export const SkipLinks: React.FC = () => {
  const setRightSidebarOpen = useSetAtom(rightSidebarOpenAtom);

  const jumpTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    if (id === 'history-region') setRightSidebarOpen(true);
    target.focus();
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <>
      <a href="#equation-region" className={THEME_GLASS.SKIP_LINK} onClick={(e) => jumpTo(e, 'equation-region')}>
        Skip to equation
      </a>
      <a href="#history-region" className={THEME_GLASS.SKIP_LINK} onClick={(e) => jumpTo(e, 'history-region')}>
        Skip to history
      </a>
    </>
  );
};
