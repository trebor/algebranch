// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

// Server render: assume motion is allowed; the client reconciles on mount.
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Reactive `prefers-reduced-motion`. Unlike framer-motion's own
 * `useReducedMotion` (which reads the setting once at mount and never updates —
 * see its `// TODO` in v12.40), this re-renders whenever the OS setting flips,
 * in BOTH directions, so turning the preference back off restores motion
 * without a page reload (#145).
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
