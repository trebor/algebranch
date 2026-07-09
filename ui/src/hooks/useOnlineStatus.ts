// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { useSyncExternalStore } from 'react';

/**
 * Live network availability from `navigator.onLine`, kept in sync via the browser's
 * `online`/`offline` events (#481). `useSyncExternalStore` reads the value straight
 * from the browser on every render — no local state to drift, and a server snapshot
 * of `true` so SSR/first paint assumes a connection until the client says otherwise.
 *
 * Caveat worth knowing: `onLine === false` is a *reliable* "no network interface"
 * signal, but `true` only means an interface exists — not that a given server is
 * reachable. Callers should use `false` to hard-block server round-trips and treat
 * `true` as "probably online", still handling a request that fails anyway.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('online', onChange);
      window.addEventListener('offline', onChange);
      return () => {
        window.removeEventListener('online', onChange);
        window.removeEventListener('offline', onChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}
