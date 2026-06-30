// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Single safe wrapper around `window.localStorage` for the whole app.
 *
 * Privacy/blocking extensions (NoScript, Brave Shields, uBlock Origin in hard
 * mode), Safari private mode, and LAN-over-HTTP all expose a `localStorage`
 * that throws `SecurityError`/`DOMException` on access — even reading the
 * property off `window` can throw. Touching it unguarded blanks the app during
 * hydration, exactly the failure #326 is about.
 *
 * Every read/write here is wrapped, and when the real store is unavailable we
 * degrade to a process-lived in-memory `Map` so within-session read-after-write
 * still works (tabs/settings written then re-read in the same session behave
 * normally; they just don't survive a reload). This replaces the previously
 * duplicated `safeLocalStorage` objects and ad-hoc try/catch blocks scattered
 * across the store and components.
 */

const memory = new Map<string, string>();

/**
 * Minimal structural type for the bits of Web Storage we touch. Avoids the
 * DOM-lib `Storage`/`window` globals so this module also type-checks in DOM-less
 * tool environments (e.g. the math-engine ts-jest run that imports `consent.ts`).
 */
type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** Resolve `localStorage`, or null if it's missing (SSR) or access throws. */
function getBackingStore(): StorageLike | null {
  try {
    const g = globalThis as {
      localStorage?: StorageLike;
      window?: { localStorage?: StorageLike };
    };
    // Prefer the standard global; fall back to `window.localStorage` for
    // environments that only define it on `window` (some test/runtime shims).
    const store = g.localStorage ?? g.window?.localStorage;
    if (store) return store;
  } catch {
    // Accessing the property itself threw (blocked extension / sandboxed frame).
  }
  return null;
}

export const safeStorage = {
  getItem(key: string): string | null {
    const store = getBackingStore();
    if (store) {
      try {
        return store.getItem(key);
      } catch (e) {
        console.warn('localStorage.getItem access denied:', e);
      }
    }
    return memory.has(key) ? (memory.get(key) ?? null) : null;
  },

  setItem(key: string, value: string): void {
    // Always mirror into memory so a same-session read succeeds even when the
    // persistent write is rejected.
    memory.set(key, value);
    const store = getBackingStore();
    if (store) {
      try {
        store.setItem(key, value);
      } catch (e) {
        console.warn('localStorage.setItem access denied:', e);
      }
    }
  },

  removeItem(key: string): void {
    memory.delete(key);
    const store = getBackingStore();
    if (store) {
      try {
        store.removeItem(key);
      } catch (e) {
        console.warn('localStorage.removeItem access denied:', e);
      }
    }
  },
};

/**
 * True only when a value can be written to and read back from the persistent
 * store — i.e. settings/history will actually survive a reload. Returns false
 * when storage is blocked, sandboxed, or absent (SSR). Drives the degraded-mode
 * banner and any "your history won't persist" messaging.
 */
export function isStoragePersistent(): boolean {
  const store = getBackingStore();
  if (!store) return false;
  const probeKey = '__algebranch_storage_probe__';
  try {
    store.setItem(probeKey, '1');
    const ok = store.getItem(probeKey) === '1';
    store.removeItem(probeKey);
    return ok;
  } catch {
    return false;
  }
}

/** Test-only: clear the in-memory fallback between cases. */
export function __resetMemoryStore(): void {
  memory.clear();
}
