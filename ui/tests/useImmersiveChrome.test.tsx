// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import React from 'react';
import { useImmersiveChrome } from '@/hooks/useImmersiveChrome';
import { immersiveAtom } from '@/store/equation';

// The immersive hide-chrome state (#252) lets the header + BottomNav retreat on
// tight landscape viewports so nearly the full height goes to the expression.
// This hook owns the transient `immersiveAtom`, the derived "active" gate
// (immersive AND short-screen), the `data-immersive` root attribute that drives
// the CSS, and the reset-on-leave safety so the user is never stranded with
// hidden chrome on a viewport that no longer warrants it.

function wrapperFor(store: ReturnType<typeof createStore>) {
  const StoreWrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  StoreWrapper.displayName = 'StoreWrapper';
  return StoreWrapper;
}

describe('useImmersiveChrome (#252)', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-immersive');
  });

  it('is inactive by default, with no root attribute', () => {
    const store = createStore();
    const { result } = renderHook(() => useImmersiveChrome(true), {
      wrapper: wrapperFor(store),
    });
    expect(result.current.active).toBe(false);
    expect(document.documentElement.hasAttribute('data-immersive')).toBe(false);
  });

  it('activates only when immersive AND short-screen, and toggles the root attribute', () => {
    const store = createStore();
    const { result } = renderHook(() => useImmersiveChrome(true), {
      wrapper: wrapperFor(store),
    });

    act(() => result.current.setImmersive(true));
    expect(result.current.active).toBe(true);
    expect(document.documentElement.hasAttribute('data-immersive')).toBe(true);

    act(() => result.current.setImmersive(false));
    expect(result.current.active).toBe(false);
    expect(document.documentElement.hasAttribute('data-immersive')).toBe(false);
  });

  it('stays inactive when immersive is requested but the viewport is not short', () => {
    const store = createStore();
    // Immersive flag set, but short-screen is false → never engages.
    store.set(immersiveAtom, true);
    const { result } = renderHook(() => useImmersiveChrome(false), {
      wrapper: wrapperFor(store),
    });
    expect(result.current.active).toBe(false);
    expect(document.documentElement.hasAttribute('data-immersive')).toBe(false);
  });

  it('auto-engages immersive when the viewport enters the very-short zone (#252 auto-hide)', () => {
    const store = createStore();
    const { result, rerender } = renderHook(
      ({ short, veryShort }) => useImmersiveChrome(short, veryShort),
      { wrapper: wrapperFor(store), initialProps: { short: true, veryShort: false } },
    );
    expect(result.current.active).toBe(false);

    // Cross below the auto-hide height threshold → chrome retreats on its own.
    rerender({ short: true, veryShort: true });
    expect(store.get(immersiveAtom)).toBe(true);
    expect(result.current.active).toBe(true);
  });

  it('auto-engages immersive on initial mount already inside the very-short zone', () => {
    const store = createStore();
    const { result } = renderHook(() => useImmersiveChrome(true, true), {
      wrapper: wrapperFor(store),
    });
    expect(store.get(immersiveAtom)).toBe(true);
    expect(result.current.active).toBe(true);
  });

  it('respects a manual reveal — does not re-hide while still in the very-short zone', () => {
    const store = createStore();
    const { result, rerender } = renderHook(
      ({ short, veryShort }) => useImmersiveChrome(short, veryShort),
      { wrapper: wrapperFor(store), initialProps: { short: true, veryShort: true } },
    );
    expect(store.get(immersiveAtom)).toBe(true);

    // User pulls the chrome back via a peek tab.
    act(() => result.current.setImmersive(false));
    expect(store.get(immersiveAtom)).toBe(false);

    // A re-render while still very-short must NOT fight that override.
    rerender({ short: true, veryShort: true });
    expect(store.get(immersiveAtom)).toBe(false);
  });

  it('re-arms auto-hide after the viewport leaves and re-enters the very-short zone', () => {
    const store = createStore();
    const { result, rerender } = renderHook(
      ({ short, veryShort }) => useImmersiveChrome(short, veryShort),
      { wrapper: wrapperFor(store), initialProps: { short: true, veryShort: true } },
    );
    expect(store.get(immersiveAtom)).toBe(true);

    act(() => result.current.setImmersive(false)); // manual reveal
    rerender({ short: true, veryShort: false }); // grow past the auto threshold (still short)
    expect(store.get(immersiveAtom)).toBe(false);

    rerender({ short: true, veryShort: true }); // shrink back → re-arm
    expect(store.get(immersiveAtom)).toBe(true);
  });

  it('resets immersive to false when the viewport leaves short-screen (never strands the user)', () => {
    const store = createStore();
    const { result, rerender } = renderHook(
      ({ short }) => useImmersiveChrome(short),
      { wrapper: wrapperFor(store), initialProps: { short: true } },
    );

    act(() => result.current.setImmersive(true));
    expect(store.get(immersiveAtom)).toBe(true);
    expect(document.documentElement.hasAttribute('data-immersive')).toBe(true);

    // Rotate to portrait / resize to desktop: the gate drops, the chrome must
    // come back, and the transient flag must reset so nothing lingers.
    rerender({ short: false });
    expect(store.get(immersiveAtom)).toBe(false);
    expect(result.current.active).toBe(false);
    expect(document.documentElement.hasAttribute('data-immersive')).toBe(false);
  });
});
