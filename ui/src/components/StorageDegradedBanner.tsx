// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { Database } from 'lucide-react';
import { isStoragePersistent } from '../utils/safeStorage';
import { THEME_GLASS } from '../constants/theme';

/**
 * One-time, dismissible heads-up shown when the browser denies persistent
 * storage — typically a privacy/blocking extension (NoScript, Brave Shields,
 * uBlock hard mode) or private-mode (#326). The app still works fully in
 * memory; this just sets expectations that history/tabs won't survive a reload,
 * while reassuring that exploring and share-via-URL are unaffected. It does not
 * nag the user to disable their protections — we adapt to the environment.
 *
 * Visibility is decided client-side after mount (storage can't be probed during
 * SSR without a hydration mismatch) and the dismissal is session-only, since
 * there's no persistent store to remember it in. Mirrors the focus/Escape
 * etiquette of the SharedWorkspaceBanner.
 */
export const StorageDegradedBanner = () => {
  const [open, setOpen] = React.useState(false);
  const dismissButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    // Storage availability is an external, client-only capability — probing it
    // at render would hydration-mismatch (SSR has no window), so reflecting it
    // into state must happen in this mount effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isStoragePersistent()) setOpen(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dismissButtonRef.current?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="storage-degraded-title"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-[100] animate-[fadeIn_0.3s_ease-out]"
    >
      <div className={`${THEME_GLASS.PANEL} p-5 flex flex-col gap-4`}>
        <div className="flex items-start gap-3">
          <Database size={20} className="mt-0.5 shrink-0 text-indigo-400" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <h3 id="storage-degraded-title" className={THEME_GLASS.BANNER_TITLE}>
              Your browser is blocking storage
            </h3>
            <p className={THEME_GLASS.BANNER_TEXT}>
              A privacy extension or private-browsing mode is stopping Algebranch
              from saving to this device, so your history and tabs won&apos;t be
              there after a reload. Everything else works normally — keep
              exploring, and your <strong>Share</strong> links still capture the
              full workspace.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <button
            ref={dismissButtonRef}
            onClick={() => setOpen(false)}
            className={`${THEME_GLASS.BUTTON_PRIMARY} px-4 py-2 text-xs font-semibold`}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
