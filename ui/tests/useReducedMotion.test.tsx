import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Controllable matchMedia stand-in: jsdom ships none, so we install a fake whose
 * `.matches` we can flip and whose `change` listeners we can fire — modelling the
 * OS Reduce Motion toggle.
 */
function installMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  const mql = {
    get matches() {
      return matches;
    },
    media: '(prefers-reduced-motion: reduce)',
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

describe('useReducedMotion', () => {
  let original: typeof window.matchMedia;
  beforeEach(() => {
    original = window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it('reflects the initial preference', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('reacts when the preference flips on and back off without a remount', () => {
    const ctrl = installMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => ctrl.set(true));
    expect(result.current).toBe(true);

    // The regression we are fixing: turning Reduce Motion back off must restore
    // motion live, not require a page reload.
    act(() => ctrl.set(false));
    expect(result.current).toBe(false);
  });
});
