// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import { appHydratedAtom, currentTabNameAtom } from '../store/equation';
import { formatDocumentTitle } from '../utils/documentTitle';

// Run synchronously after DOM mutations (before paint) on the client so the
// title is corrected in the same frame. Falls back to useEffect on the server
// to avoid the SSR useLayoutEffect warning.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

/**
 * Keeps the browser-tab title in sync with the active workspace name (#449), as
 * `"<workspace> — Algebranch"`.
 *
 * Two subtleties this handles:
 *  - **Hydration gate:** until the mount-once localStorage load restores the
 *    real tabs, the store still holds the fallback "Sample Workspace". We leave
 *    the SSR title (bare `Algebranch`, from `app/layout.tsx`) untouched until
 *    then, so the placeholder never flashes in the tab.
 *  - **React re-assertion:** Next/React own the static `<title>` from layout
 *    metadata and re-write `document.title` back to it on *later* commits —
 *    including commits in the layout subtree that never re-render this page, so
 *    a render-time re-assert can't catch them. Instead we install a
 *    MutationObserver on `<head>` and re-apply our title whenever anything
 *    overwrites it. The guard (`!== desired`) makes our own write a no-op, so
 *    there's no feedback loop.
 */
export function useDocumentTitle(): void {
  const hydrated = useAtomValue(appHydratedAtom);
  const workspaceName = useAtomValue(currentTabNameAtom);
  const desired = hydrated ? formatDocumentTitle(workspaceName) : null;

  useIsomorphicLayoutEffect(() => {
    if (desired == null) return;

    const apply = () => {
      if (document.title !== desired) document.title = desired;
    };
    apply();

    // Re-apply whenever React swaps the <title> text or node back to the
    // metadata value. Observing <head> (not just the current <title> node)
    // catches full node replacement too.
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [desired]);
}
