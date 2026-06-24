import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useIsShortScreen,
  useIsVeryShortScreen,
  SHORT_SCREEN_QUERY,
  VERY_SHORT_SCREEN_QUERY,
} from '@/hooks/useIsShortScreen';

/**
 * Controllable matchMedia stand-in: jsdom ships none, so we install a fake whose
 * `.matches` we can flip and whose `change` listeners we can fire — modelling a
 * device rotating into / out of the short-and-narrow (landscape) viewport that
 * collapses the tab strip (#247).
 */
function installMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  const mql = {
    get matches() {
      return matches;
    },
    media: SHORT_SCREEN_QUERY,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    addListener: (cb: () => void) => listeners.add(cb),
    removeListener: (cb: () => void) => listeners.delete(cb),
    dispatchEvent: () => true,
    onchange: null,
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return {
    set(value: boolean) {
      matches = value;
      listeners.forEach((cb) => cb());
    },
  };
}

describe('useIsShortScreen', () => {
  let original: typeof window.matchMedia;
  beforeEach(() => {
    original = window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it('mirrors the #218 short-screen media query', () => {
    expect(SHORT_SCREEN_QUERY).toBe('(max-height: 500px) and (max-width: 1024px)');
  });

  it('reflects the initial viewport', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useIsShortScreen());
    expect(result.current).toBe(true);
  });

  it('reacts when the viewport crosses the threshold in both directions', () => {
    const ctrl = installMatchMedia(false);
    const { result } = renderHook(() => useIsShortScreen());
    expect(result.current).toBe(false);

    act(() => ctrl.set(true));
    expect(result.current).toBe(true);

    act(() => ctrl.set(false));
    expect(result.current).toBe(false);
  });
});

describe('useIsVeryShortScreen (#252 auto-hide)', () => {
  let original: typeof window.matchMedia;
  beforeEach(() => {
    original = window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it('keys off a lower height threshold than the short-screen query', () => {
    expect(VERY_SHORT_SCREEN_QUERY).toBe('(max-height: 400px) and (max-width: 1024px)');
  });

  it('reflects and reacts to the very-short viewport', () => {
    const ctrl = installMatchMedia(false);
    const { result } = renderHook(() => useIsVeryShortScreen());
    expect(result.current).toBe(false);

    act(() => ctrl.set(true));
    expect(result.current).toBe(true);
  });
});
