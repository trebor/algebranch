// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * The short-and-narrow viewport — mobile landscape and similar — where vertical
 * space is scarce. Mirrors the #218 header-compaction media query in
 * `globals.css` verbatim so chrome that compacts on short screens (the header,
 * and now the workspace tab strip, #247) all switch on together. CSS can't
 * import a TS constant, so the two copies must be kept in step by hand.
 */
export const SHORT_SCREEN_QUERY = '(max-height: 500px) and (max-width: 1024px)';

/**
 * The *very* short viewport (#252): a lower height threshold, nested inside
 * SHORT_SCREEN_QUERY, at which the immersive hide-chrome mode engages
 * automatically rather than waiting for the explicit toggle. Most phones in
 * landscape fall here. `useImmersiveChrome` auto-hides on entry but respects a
 * manual reveal, so this only sets the default, never fights the user.
 */
export const VERY_SHORT_SCREEN_QUERY = '(max-height: 400px) and (max-width: 1024px)';

// Server render: assume the roomy (non-short) viewport; the client reconciles on
// mount. Matches useBreakpoint's 'xl' SSR default so the full strip renders
// first, then collapses if the real viewport is short.
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Reactively tracks whether the viewport currently matches `query`, re-rendering
 * whenever it crosses the threshold in either direction (e.g. device rotation)
 * with no remount required. Shared engine for the short-screen hooks below.
 */
function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = useCallback((): boolean => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Reactively tracks whether the viewport is short-and-narrow (#247), so a
 * component can mount the collapsed workspace switcher instead of the horizontal
 * tab strip. Re-renders whenever the viewport crosses the threshold in either
 * direction (e.g. device rotation), with no remount required.
 */
export function useIsShortScreen(): boolean {
  return useMediaQuery(SHORT_SCREEN_QUERY);
}

/**
 * Reactively tracks the very-short viewport (#252) that auto-engages immersive
 * hide-chrome mode. Always implies `useIsShortScreen()` (the query nests inside
 * it), so the two can be read together without contradiction.
 */
export function useIsVeryShortScreen(): boolean {
  return useMediaQuery(VERY_SHORT_SCREEN_QUERY);
}
