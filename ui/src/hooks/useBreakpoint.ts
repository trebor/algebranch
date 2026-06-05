'use client';

import { useSyncExternalStore } from 'react';

/**
 * Tailwind-aligned breakpoint labels.
 * - sm: < 640px
 * - md: 640–767px
 * - lg: 768–1023px
 * - xl: >= 1024px
 */
export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';

/** Minimum-width thresholds (px) that define each breakpoint transition. */
const BREAKPOINTS = [
  { min: 1024, label: 'xl' as const },
  { min: 768, label: 'lg' as const },
  { min: 640, label: 'md' as const },
];

/**
 * Resolve the current breakpoint from a set of MediaQueryList objects.
 * Falls back to 'sm' when no query matches.
 */
function resolveBreakpoint(queries: MediaQueryList[]): Breakpoint {
  for (let i = 0; i < queries.length; i++) {
    if (queries[i].matches) return BREAKPOINTS[i].label;
  }
  return 'sm';
}

// ---------------------------------------------------------------------------
// Module-level singleton so every hook instance shares one set of listeners.
// ---------------------------------------------------------------------------

let queries: MediaQueryList[] | null = null;
let listeners: Set<() => void> = new Set();
let currentSnapshot: Breakpoint = 'xl'; // SSR default

/** Lazily initialise matchMedia queries and wire up change listeners. */
function ensureInitialised(): void {
  if (queries !== null) return;
  if (typeof window === 'undefined') return;

  queries = BREAKPOINTS.map((bp) =>
    window.matchMedia(`(min-width: ${bp.min}px)`)
  );

  // Set the initial snapshot from the real viewport.
  currentSnapshot = resolveBreakpoint(queries);

  const onChange = () => {
    const next = resolveBreakpoint(queries!);
    if (next !== currentSnapshot) {
      currentSnapshot = next;
      listeners.forEach((cb) => cb());
    }
  };

  queries.forEach((mql) => {
    // `addEventListener('change', …)` is the modern, spec-correct API.
    mql.addEventListener('change', onChange);
  });
}

/** Subscribe callback invoked by `useSyncExternalStore`. */
function subscribe(onStoreChange: () => void): () => void {
  ensureInitialised();
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/** Return the latest breakpoint value (client). */
function getSnapshot(): Breakpoint {
  ensureInitialised();
  return currentSnapshot;
}

/** Return the SSR-safe default ('xl' — we can't know the viewport). */
function getServerSnapshot(): Breakpoint {
  return 'xl';
}

// ---------------------------------------------------------------------------
// Public hooks
// ---------------------------------------------------------------------------

/**
 * Reactively tracks the current Tailwind-style breakpoint using
 * `matchMedia` listeners and `useSyncExternalStore` for full
 * concurrent-mode compatibility.
 *
 * @example
 * ```tsx
 * const bp = useBreakpoint();
 * // bp === 'sm' | 'md' | 'lg' | 'xl'
 * ```
 */
export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Returns `true` when the viewport is narrower than 1024 px (below `xl`).
 *
 * @example
 * ```tsx
 * const mobile = useIsMobile();
 * ```
 */
export function useIsMobile(): boolean {
  const bp = useBreakpoint();
  return bp !== 'xl';
}

/**
 * Returns `true` when the viewport is narrower than 768 px (below `lg`).
 *
 * @example
 * ```tsx
 * const phone = useIsPhone();
 * ```
 */
export function useIsPhone(): boolean {
  const bp = useBreakpoint();
  return bp === 'sm' || bp === 'md';
}
