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

  if (consent !== 'unset') {
    return null;
  }

  const handleAccept = () => {
    setConsent('granted');
  };

  const handleDecline = () => {
    setConsent('denied');
  };

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-[100] animate-[fadeIn_0.3s_ease-out]">
      <div className={`${THEME_GLASS.PANEL} p-5 flex flex-col gap-4`}>
        <div className="flex flex-col gap-1">
          <h3 className={THEME_GLASS.BANNER_TITLE}>Cookie Consent</h3>
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
