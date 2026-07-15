// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { safeStorage } from './safeStorage';

export type ConsentState = 'unset' | 'granted' | 'denied';

const STORAGE_KEY = 'algebranch_consent';

interface WindowWithGtag {
  dataLayer?: unknown[];
  gtag?: (command: string, action: string, params: Record<string, unknown>) => void;
}

const getWindow = (): WindowWithGtag | undefined => {
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as Record<string, unknown>;
    if (g.window) {
      return g.window as WindowWithGtag;
    }
  }
  return undefined;
};

export const getConsentFromStorage = (): ConsentState => {
  const val = safeStorage.getItem(STORAGE_KEY);
  if (val === 'granted' || val === 'denied') {
    return val;
  }
  return 'unset';
};

export const saveConsentToStorage = (state: ConsentState): void => {
  safeStorage.setItem(STORAGE_KEY, state);
};

export const updateGtagConsent = (state: 'granted' | 'denied'): void => {
  const win = getWindow();
  if (win) {
    win.dataLayer = win.dataLayer || [];
    if (!win.gtag) {
      win.gtag = function () {
        // eslint-disable-next-line prefer-rest-params
        win.dataLayer?.push(arguments);
      };
    }
    win.gtag('consent', 'update', {
      analytics_storage: state,
      ad_storage: state,
      ad_user_data: state,
      ad_personalization: state,
    });
  }
};

export const clearGaCookies = (): void => {
  if (typeof globalThis === 'undefined') return;
  const g = globalThis as Record<string, unknown>;
  const doc = g.document as Record<string, unknown> | undefined;
  const win = g.window as Record<string, unknown> | undefined;
  
  if (!doc) return;

  try {
    const cookiesStr = (doc.cookie as string || '');
    const cookies = cookiesStr.split(';');
    
    const hostname = win && win.location ? (win.location as Record<string, unknown>).hostname as string : '';
    const domains: string[] = [''];
    if (hostname) {
      domains.push(`domain=${hostname}`);
      const domainParts = hostname.split('.');
      if (domainParts.length >= 2) {
        const rootDomain = domainParts.slice(-2).join('.');
        domains.push(`domain=.${rootDomain}`);
        domains.push(`domain=${rootDomain}`);
      }
    }

    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      const eqIdx = cookie.indexOf('=');
      const name = eqIdx > -1 ? cookie.substring(0, eqIdx) : cookie;

      if (name === '_ga' || name.startsWith('_ga_') || name === '_gid' || name.startsWith('_gat_')) {
        domains.forEach((domainStr) => {
          const domainOption = domainStr ? `; ${domainStr}` : '';
          doc.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domainOption}`;
          doc.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${domainOption}`;
        });
      }
    }
  } catch (e) {
    console.warn('Failed to clear GA cookies:', e);
  }
};
