// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { atom } from 'jotai';
import {
  ConsentState,
  getConsentFromStorage,
  saveConsentToStorage,
  updateGtagConsent,
  clearGaCookies,
} from '../utils/consent';

export const rawConsentAtom = atom<ConsentState>('unset');

export const consentAtom = atom(
  (get) => get(rawConsentAtom),
  (get, set, update: ConsentState | ((prev: ConsentState) => ConsentState)) => {
    const prev = get(rawConsentAtom);
    const next = typeof update === 'function' ? update(prev) : update;
    set(rawConsentAtom, next);
    saveConsentToStorage(next);

    if (next === 'granted') {
      updateGtagConsent('granted');
    } else if (next === 'denied') {
      updateGtagConsent('denied');
      clearGaCookies();
    }
  }
);

export const hydrateConsentAtom = atom(
  null,
  (get, set) => {
    const saved = getConsentFromStorage();
    if (saved === 'granted' || saved === 'denied') {
      set(rawConsentAtom, saved);
      if (saved === 'granted') {
        updateGtagConsent('granted');
      } else if (saved === 'denied') {
        clearGaCookies();
      }
    }
  }
);
