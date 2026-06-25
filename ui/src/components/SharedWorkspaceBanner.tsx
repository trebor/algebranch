// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { Layers } from 'lucide-react';
import {
  sharedWorkspaceBannerAtom,
  markSharedWorkspaceBannerDismissed,
} from '../store/sharedWorkspaceBanner';
import { consentAtom } from '../store/consent';
import { THEME_GLASS } from '../constants/theme';

/**
 * Recipient loop banner (#241). When the app opens a `?ws=` share link, this
 * acknowledges that the link restored someone's *full* derivation — the actual
 * magic of workspace-share — and invites the recipient to keep working on it or
 * share their own. It closes the viral loop by teaching the feature to the
 * person most primed to discover it. Non-blocking and dismissible; mirrors the
 * focus etiquette of the ConsentBanner so keyboard/SR users land on the action.
 */
export const SharedWorkspaceBanner = () => {
  const [open, setOpen] = useAtom(sharedWorkspaceBannerAtom);
  const consent = useAtomValue(consentAtom);
  // Latest consent, read inside the focus effect without re-triggering it: we
  // decide focus once when the banner opens, not again when consent resolves.
  const consentRef = React.useRef(consent);
  React.useEffect(() => {
    consentRef.current = consent;
  }, [consent]);
  const dismissButtonRef = React.useRef<HTMLButtonElement>(null);

  // On first run a ?ws= link can raise this banner *and* the cookie consent
  // banner together. Consent owns focus then — so we only pull focus here once
  // the consent choice is resolved (or was never pending). Avoids two banners
  // fighting over the focus ring on load.
  React.useEffect(() => {
    if (!open) return;
    if (consentRef.current === 'unset') return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dismissButtonRef.current?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  // Record the dismissal so future `?ws=` arrivals skip the banner (#263).
  const dismiss = () => {
    markSharedWorkspaceBannerDismissed();
    setOpen(false);
  };

  // Escape dismisses while focus is within the banner (scoped, no focus trap).
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      dismiss();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="shared-workspace-title"
      onKeyDown={handleKeyDown}
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-[100] animate-[fadeIn_0.3s_ease-out]"
    >
      <div className={`${THEME_GLASS.PANEL} p-5 flex flex-col gap-4`}>
        <div className="flex items-start gap-3">
          <Layers size={20} className="mt-0.5 shrink-0 text-indigo-400" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <h3 id="shared-workspace-title" className={THEME_GLASS.BANNER_TITLE}>
              A shared workspace was opened for you
            </h3>
            <p className={THEME_GLASS.BANNER_TEXT}>
              This link restored someone&apos;s full derivation and history tree — keep working on
              it right here. Built a worked solution of your own? Hit <strong>Share</strong> to
              hand the whole workspace to someone in one gesture.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <button
            ref={dismissButtonRef}
            onClick={dismiss}
            className={`${THEME_GLASS.BUTTON_PRIMARY} px-4 py-2 text-xs font-semibold`}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
