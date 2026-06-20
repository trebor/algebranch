// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useSetAtom } from 'jotai';
import { hydrateConsentAtom } from '../store/consent';
import { ConsentBanner } from './ConsentBanner';

export const ConsentManager = () => {
  const hydrateConsent = useSetAtom(hydrateConsentAtom);
  const [isHydrated, setIsHydrated] = React.useState(false);

  React.useEffect(() => {
    hydrateConsent();
    const timer = setTimeout(() => {
      setIsHydrated(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [hydrateConsent]);

  if (!isHydrated) {
    return null;
  }

  return <ConsentBanner />;
};
