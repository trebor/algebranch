// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { BottomNav } from '@/components/BottomNav';
import { activeBottomSheetAtom, type BottomSheetType } from '@/store/equation';

/**
 * The fixed BottomNav is `z-55` while the bottom sheets render at `z-50`, so an
 * open sheet is painted *under* the nav (#325). Rather than fight that with a
 * per-sheet bottom-padding allowance, the nav slides itself out of the way
 * whenever any sheet is open — reclaiming the band and removing the overlap.
 */
function renderNav(sheet: BottomSheetType) {
  const store = createStore();
  store.set(activeBottomSheetAtom, sheet);
  const utils = render(
    <Provider store={store}>
      <BottomNav />
    </Provider>,
  );
  return { store, nav: utils.container.querySelector('nav.app-bottom-nav') as HTMLElement, ...utils };
}

describe('BottomNav — hide while a sheet is open (#325)', () => {
  afterEach(cleanup);

  it('sits in place (not translated) when no sheet is open', () => {
    const { nav } = renderNav(null);
    expect(nav.className).not.toContain('translate-y-full');
    expect(nav.className).not.toContain('pointer-events-none');
  });

  it('slides out and drops pointer events when a sheet is open', () => {
    const { nav } = renderNav('history');
    expect(nav.className).toContain('translate-y-full');
    expect(nav.className).toContain('pointer-events-none');
  });

  it('hides for every sheet kind, not just history', () => {
    for (const kind of ['workspace', 'library', 'history'] as const) {
      const { nav } = renderNav(kind);
      expect(nav.className).toContain('translate-y-full');
      cleanup();
    }
  });
});
