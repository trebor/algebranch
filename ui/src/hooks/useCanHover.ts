// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(hover: hover)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  // No matchMedia (jsdom / very old WebView) → assume a hover-capable pointer.
  // Desktop-first is the safe default: it keeps the existing hover affordances
  // (Select-Term tooltip, handle chooser open-on-hover) rather than silently
  // switching every environment we can't probe into touch mode.
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia(QUERY).matches;
}

// Server render: assume hover-capable; the client reconciles on mount.
function getServerSnapshot(): boolean {
  return true;
}

/**
 * Reactive `(hover: hover)` — true when the primary pointer can hover (mouse,
 * trackpad, stylus with hover), false on touch-primary devices. Drives the
 * touch-vs-hover fork for node/handle affordances (#388): on a hover-capable
 * device the Select-Term tooltip follows the cursor and handle choosers open on
 * hover; on a touch device those reveals move to an explicit long-press (peek)
 * and tap instead, because a tap has no hover to key off.
 */
export function useCanHover(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
