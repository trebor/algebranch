// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The in-app documentation modal (#514) shows a doc's body in place — the "modal
// feel" the Help launcher opens instead of a new tab — while syncing the URL to
// the crawlable `/<slug>` via the History API so the address stays shareable and
// Back closes it. These tests pin that contract: it renders the active doc from
// the injected `docs` map, pushes the doc URL on open, walks history back on
// close, and reconciles to a Back/Forward popstate. Bodies are injected as
// pre-rendered nodes, so a plain stand-in represents the real DocMarkdown output.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { DocModal } from '@/components/DocModal';
import { activeHelpDocAtom } from '@/store/equation';

const BODIES = {
  'user-guide': <p>USER GUIDE BODY TEXT</p>,
  scope: <p>SCOPE BODY TEXT</p>,
  features: <p>FEATURES BODY TEXT</p>,
  faq: <p>FAQ BODY TEXT</p>,
};

function renderModal(active: string | null) {
  const store = createStore();
  store.set(activeHelpDocAtom, active);
  const utils = render(
    <Provider store={store}>
      <DocModal docs={BODIES} />
    </Provider>,
  );
  return { store, ...utils };
}

describe('DocModal (#514)', () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
    vi.restoreAllMocks();
  });

  it('renders nothing when no doc is active', () => {
    renderModal(null);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the active doc body and titles it from the catalog', () => {
    renderModal('user-guide');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /user guide/i })).toBeTruthy();
    expect(screen.getByText('USER GUIDE BODY TEXT')).toBeTruthy();
    // Other docs' bodies stay unmounted.
    expect(screen.queryByText('SCOPE BODY TEXT')).toBeNull();
  });

  it('syncs the URL to the crawlable /<slug> on open', () => {
    renderModal('scope');
    expect(window.location.pathname).toBe('/scope');
  });

  it('walks history back on close so the URL returns and Back can reopen', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    renderModal('faq');
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('closes when a Back/Forward popstate lands on a non-doc URL', () => {
    const { store } = renderModal('user-guide');
    expect(screen.getByRole('dialog')).toBeTruthy();
    // Emulate the browser Back button returning to the app.
    act(() => {
      window.history.replaceState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    // The atom is the contract; the dialog node lingers only for AnimatePresence's
    // exit tween, which jsdom doesn't flush.
    expect(store.get(activeHelpDocAtom)).toBeNull();
  });
});
