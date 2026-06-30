// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { safeStorage, isStoragePersistent, __resetMemoryStore } from '@/utils/safeStorage';

/**
 * Swap window.localStorage for a stand-in for the duration of a test. Passing a
 * thrower simulates a privacy/blocking extension (NoScript, Brave shields,
 * Safari private mode) that denies storage access via SecurityError.
 */
function withLocalStorage(impl: Storage | null, run: () => void) {
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get: () => {
      if (impl === null) throw new DOMException('denied', 'SecurityError');
      return impl;
    },
  });
  try {
    run();
  } finally {
    if (original) Object.defineProperty(window, 'localStorage', original);
  }
}

function throwingStorage(): Storage {
  const thrower = () => {
    throw new DOMException('denied', 'SecurityError');
  };
  return {
    get length(): number {
      return thrower();
    },
    clear: thrower,
    getItem: thrower,
    key: thrower,
    removeItem: thrower,
    setItem: thrower,
  } as unknown as Storage;
}

beforeEach(() => {
  __resetMemoryStore();
  window.localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('safeStorage with working localStorage', () => {
  it('round-trips through the real backing store', () => {
    safeStorage.setItem('k', 'v');
    expect(safeStorage.getItem('k')).toBe('v');
    expect(window.localStorage.getItem('k')).toBe('v');
    safeStorage.removeItem('k');
    expect(safeStorage.getItem('k')).toBeNull();
  });
});

describe('safeStorage when storage access throws (blocking extension)', () => {
  it('never lets the throw escape', () => {
    withLocalStorage(throwingStorage(), () => {
      expect(() => safeStorage.setItem('k', 'v')).not.toThrow();
      expect(() => safeStorage.getItem('k')).not.toThrow();
      expect(() => safeStorage.removeItem('k')).not.toThrow();
    });
  });

  it('degrades to an in-memory store so read-after-write still works this session', () => {
    withLocalStorage(throwingStorage(), () => {
      safeStorage.setItem('tab', 'x^2-9=0');
      expect(safeStorage.getItem('tab')).toBe('x^2-9=0');
      safeStorage.removeItem('tab');
      expect(safeStorage.getItem('tab')).toBeNull();
    });
  });
});

describe('isStoragePersistent capability probe', () => {
  it('returns true when localStorage works', () => {
    expect(isStoragePersistent()).toBe(true);
  });

  it('returns false when the localStorage getter throws', () => {
    withLocalStorage(null, () => {
      expect(isStoragePersistent()).toBe(false);
    });
  });

  it('returns false when storage methods throw', () => {
    withLocalStorage(throwingStorage(), () => {
      expect(isStoragePersistent()).toBe(false);
    });
  });
});
