// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getConsentFromStorage,
  saveConsentToStorage,
} from '@/utils/consent';
import { createStore } from 'jotai';
import { rawConsentAtom, consentAtom, hydrateConsentAtom } from '@/store/consent';

describe('consent utilities and store', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = '';
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('defaults getConsentFromStorage to denied when nothing is stored', () => {
    expect(getConsentFromStorage()).toBe('denied');
  });

  it('reads granted from storage if explicitly saved', () => {
    saveConsentToStorage('granted');
    expect(getConsentFromStorage()).toBe('granted');
  });

  it('rawConsentAtom defaults to denied', () => {
    const store = createStore();
    expect(store.get(rawConsentAtom)).toBe('denied');
  });

  it('hydrateConsentAtom sets state to granted if stored, denied otherwise', () => {
    const store = createStore();
    store.set(hydrateConsentAtom);
    expect(store.get(rawConsentAtom)).toBe('denied');

    saveConsentToStorage('granted');
    store.set(hydrateConsentAtom);
    expect(store.get(rawConsentAtom)).toBe('granted');
  });

  it('updating consentAtom saves to storage and updates gtag', () => {
    const store = createStore();
    const windowWithGtag = globalThis as unknown as { gtag?: ReturnType<typeof vi.fn> };
    windowWithGtag.gtag = vi.fn();

    store.set(consentAtom, 'granted');
    expect(localStorage.getItem('algebranch_consent')).toBe('granted');
    expect(windowWithGtag.gtag).toHaveBeenCalledWith('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });

    store.set(consentAtom, 'denied');
    expect(localStorage.getItem('algebranch_consent')).toBe('denied');
    expect(windowWithGtag.gtag).toHaveBeenCalledWith('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  });
});
