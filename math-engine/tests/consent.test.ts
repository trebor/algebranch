// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import {
  getConsentFromStorage,
  saveConsentToStorage,
  updateGtagConsent,
  clearGaCookies,
} from '../../ui/src/utils/consent';

declare let document: {
  cookie: string;
};

interface MockLocalStorage {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
  clear: jest.Mock;
  length: number;
  key: jest.Mock;
}

interface MockWindow {
  localStorage: MockLocalStorage;
  gtag?: jest.Mock;
  location: {
    hostname: string;
  };
}

describe('Consent Utility', () => {
  let localStorageMock: Record<string, string> = {};
  let cookiesMock: string[] = [];
  let mockWindow: MockWindow;

  beforeAll(() => {
    localStorageMock = {};
    mockWindow = {
      localStorage: {
        getItem: jest.fn((key: string) => localStorageMock[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          localStorageMock[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete localStorageMock[key];
        }),
        clear: jest.fn(() => {
          localStorageMock = {};
        }),
        length: 0,
        key: jest.fn(),
      },
      location: {
        hostname: 'algebranch.org',
      },
    };
    (global as Record<string, unknown>).window = mockWindow;

    // Mock document
    (global as Record<string, unknown>).document = {
      get cookie() {
        return cookiesMock.join('; ');
      },
      set cookie(val: string) {
        const parts = val.split(';');
        const cookieKV = parts[0].trim();
        const eqIdx = cookieKV.indexOf('=');
        const name = eqIdx > -1 ? cookieKV.substring(0, eqIdx) : cookieKV;
        const value = eqIdx > -1 ? cookieKV.substring(eqIdx + 1) : '';

        if (val.includes('expires=Thu, 01 Jan 1970')) {
          cookiesMock = cookiesMock.filter(c => !c.startsWith(name + '='));
        } else {
          cookiesMock = cookiesMock.filter(c => !c.startsWith(name + '='));
          cookiesMock.push(`${name}=${value}`);
        }
      }
    } as unknown as { cookie: string };
  });

  afterAll(() => {
    delete (global as Record<string, unknown>).window;
    delete (global as Record<string, unknown>).document;
  });

  beforeEach(() => {
    localStorageMock = {};
    cookiesMock = [];
    jest.clearAllMocks();
    const g = global as Record<string, unknown>;
    if (g.window) {
      (g.window as unknown as MockWindow).gtag = undefined;
    }
  });

  describe('getConsentFromStorage', () => {
    it('returns unset when storage is empty', () => {
      expect(getConsentFromStorage()).toBe('unset');
    });

    it('returns granted when storage has granted', () => {
      localStorageMock['algebranch_consent'] = 'granted';
      expect(getConsentFromStorage()).toBe('granted');
    });

    it('returns denied when storage has denied', () => {
      localStorageMock['algebranch_consent'] = 'denied';
      expect(getConsentFromStorage()).toBe('denied');
    });

    it('returns unset when storage has invalid value', () => {
      localStorageMock['algebranch_consent'] = 'invalid';
      expect(getConsentFromStorage()).toBe('unset');
    });
  });

  describe('saveConsentToStorage', () => {
    it('saves value to storage', () => {
      saveConsentToStorage('granted');
      expect(localStorageMock['algebranch_consent']).toBe('granted');
      const win = (global as Record<string, unknown>).window as unknown as MockWindow;
      expect(win.localStorage.setItem).toHaveBeenCalledWith('algebranch_consent', 'granted');
    });
  });

  describe('updateGtagConsent', () => {
    it('does not crash if window.gtag is missing', () => {
      const win = (global as Record<string, unknown>).window as unknown as MockWindow;
      delete win.gtag;
      expect(() => updateGtagConsent('granted')).not.toThrow();
    });

    it('calls window.gtag when defined', () => {
      const gtagMock = jest.fn();
      const win = (global as Record<string, unknown>).window as unknown as MockWindow;
      win.gtag = gtagMock;

      updateGtagConsent('granted');
      expect(gtagMock).toHaveBeenCalledWith('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
      });
    });
  });

  describe('clearGaCookies', () => {
    it('removes GA cookies from document.cookie', () => {
      document.cookie = '_ga=GA1.2.12345.67890';
      document.cookie = '_ga_T3ST=GS1.2.1.0';
      document.cookie = 'other_cookie=value';

      expect(document.cookie).toContain('_ga');
      expect(document.cookie).toContain('_ga_T3ST');
      expect(document.cookie).toContain('other_cookie');

      clearGaCookies();

      expect(document.cookie).not.toContain('_ga');
      expect(document.cookie).not.toContain('_ga_T3ST');
      expect(document.cookie).toContain('other_cookie');
    });
  });
});
