// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtom } from 'jotai';
import { consentAtom } from '../store/consent';
import { THEME_GLASS } from '../constants/theme';
import Link from 'next/link';

export const ConsentBanner = () => {
  const [consent, setConsent] = useAtom(consentAtom);
  const acceptButtonRef = React.useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = React.useRef<HTMLElement | null>(null);

  // Non-blocking banner: the app stays usable, but move focus onto it when it
  // appears so keyboard / screen-reader users discover the consent choice. We
  // land on the Accept button — the conventional primary action — while Escape
  // (and dismissal) still imply Decline, so the privacy-safe choice is never
  // implied by walking away. Decline stays equally present right beside it. No
  // focus trap; tabbing out into the app is intentional. On dismiss, restore
  // focus to whatever held it before (e.g. a dialog the banner appeared over).
  React.useEffect(() => {
    if (consent !== 'unset') return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    acceptButtonRef.current?.focus();
    return () => {
      previouslyFocusedRef.current?.focus?.();
    };
  }, [consent]);

  if (consent !== 'unset') {
    return null;
  }

  const handleAccept = () => {
    setConsent('granted');
  };

  const handleDecline = () => {
    setConsent('denied');
  };

  // Escape implies Decline (the privacy-safe choice) and dismisses the banner —
  // never an implied Accept. Scoped to the banner via onKeyDown, so Escape only
  // declines while focus is within it; once focus moves into the app it doesn't.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleDecline();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      onKeyDown={handleKeyDown}
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-[100] animate-[fadeIn_0.3s_ease-out]"
    >
      <div className={`${THEME_GLASS.PANEL} p-5 flex flex-col gap-4`}>
        <div className="flex flex-col gap-1">
          <h3 id="cookie-consent-title" className={THEME_GLASS.BANNER_TITLE}>Cookie Consent</h3>
          <p className={THEME_GLASS.BANNER_TEXT}>
            Algebranch uses Google Analytics to collect anonymous usage data to improve our mathematical tools. 
            We never collect equation contents or personal data. Read our{' '}
            <Link href="/privacy" className={THEME_GLASS.LINK}>
              Privacy Policy
            </Link>{' '}
            for details.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={handleDecline}
            className={`${THEME_GLASS.BUTTON_SECONDARY} px-4 py-2 text-xs font-semibold`}
          >
            Decline
          </button>
          <button
            ref={acceptButtonRef}
            onClick={handleAccept}
            className={`${THEME_GLASS.BUTTON_PRIMARY} px-4 py-2 text-xs font-semibold`}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};
