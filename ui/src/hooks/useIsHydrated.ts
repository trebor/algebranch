// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { useSyncExternalStore } from 'react';

// A no-op store: the value never changes after the initial server→client
// transition, so there is nothing to subscribe to.
const emptySubscribe = () => () => {};

/**
 * Returns `false` during server render and the first (hydrating) client render,
 * then `true` once the component has hydrated on the client.
 *
 * Use this to gate client-only output (portals, `window`-dependent layout)
 * without a hydration mismatch. Replaces the
 * `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), [])`
 * pattern — `useSyncExternalStore` gives the same behavior with no
 * setState-in-effect.
 *
 * @example
 * ```tsx
 * const hydrated = useIsHydrated();
 * if (hydrated && typeof document !== 'undefined') return createPortal(...);
 * ```
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,  // client snapshot
    () => false, // server snapshot
  );
}
