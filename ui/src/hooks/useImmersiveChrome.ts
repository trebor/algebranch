// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { useAtom } from 'jotai';
import { useEffect, useRef } from 'react';
import { immersiveAtom } from '../store/equation';

/**
 * Owns the immersive hide-chrome state (#252) — the mode that lets the header
 * and BottomNav retreat on tight landscape viewports so nearly the full height
 * goes to expression manipulation.
 *
 * Responsibilities:
 * - Derives `active` = the transient `immersiveAtom` AND the short-screen gate,
 *   so immersive mode can only engage on the viewport it's meant for (#218's
 *   `(max-height:500px) and (max-width:1024px)` breakpoint, passed in via
 *   `useIsShortScreen()`).
 * - Drives the spatial effect by writing a `data-immersive` attribute on the
 *   document root (mirrors ChromeScaleProvider's `--chrome-scale` pattern); the
 *   `:root[data-immersive]` rules in globals.css collapse the chrome height vars
 *   and slide the bars away.
 * - Auto-hides on entering the *very*-short zone (#252): crossing below the
 *   lower height threshold engages immersive on its own, but only on the rising
 *   edge — a manual peek-reveal afterwards sticks (we never re-force it while the
 *   viewport stays very-short), so the auto-hide sets the default without
 *   fighting the user. It re-arms once the viewport leaves and re-enters.
 * - Resets `immersive` to false the moment the viewport leaves short-screen
 *   (rotate to portrait / resize to desktop), so the user is never stranded with
 *   hidden chrome and no stale flag lingers.
 */
export function useImmersiveChrome(isShortScreen: boolean, isVeryShortScreen = false) {
  const [immersive, setImmersive] = useAtom(immersiveAtom);
  const active = immersive && isShortScreen;

  // Auto-hide on the rising edge of the very-short zone only. Tracking the
  // previous value means a later manual reveal isn't clobbered by re-renders;
  // the default re-applies only after the viewport leaves and re-enters.
  const wasVeryShortRef = useRef(false);
  useEffect(() => {
    if (isVeryShortScreen && !wasVeryShortRef.current) setImmersive(true);
    wasVeryShortRef.current = isVeryShortScreen;
  }, [isVeryShortScreen, setImmersive]);

  // Reset-on-leave: when the gate drops, bring the chrome back and clear the
  // transient flag. Guarded on `immersive` so it only fires the one transition.
  useEffect(() => {
    if (!isShortScreen && immersive) setImmersive(false);
  }, [isShortScreen, immersive, setImmersive]);

  // Reflect the active state onto the document root so CSS can react. Cleaned up
  // on unmount so a teardown never leaves the attribute behind.
  useEffect(() => {
    const root = document.documentElement;
    if (active) root.setAttribute('data-immersive', '');
    else root.removeAttribute('data-immersive');
    return () => root.removeAttribute('data-immersive');
  }, [active]);

  return { active, immersive, setImmersive };
}
