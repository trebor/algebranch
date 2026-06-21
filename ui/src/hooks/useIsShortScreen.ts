// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { useSyncExternalStore } from 'react';

/**
 * The short-and-narrow viewport — mobile landscape and similar — where vertical
 * space is scarce. Mirrors the #218 header-compaction media query in
 * `globals.css` verbatim so chrome that compacts on short screens (the header,
 * and now the workspace tab strip, #247) all switch on together. CSS can't
 * import a TS constant, so the two copies must be kept in step by hand.
 */
export const SHORT_SCREEN_QUERY = '(max-height: 500px) and (max-width: 1024px)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(SHORT_SCREEN_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(SHORT_SCREEN_QUERY).matches;
}

// Server render: assume the roomy (non-short) viewport; the client reconciles on
// mount. Matches useBreakpoint's 'xl' SSR default so the full strip renders
// first, then collapses if the real viewport is short.
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Reactively tracks whether the viewport is short-and-narrow (#247), so a
 * component can mount the collapsed workspace switcher instead of the horizontal
 * tab strip. Re-renders whenever the viewport crosses the threshold in either
 * direction (e.g. device rotation), with no remount required.
 */
export function useIsShortScreen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
