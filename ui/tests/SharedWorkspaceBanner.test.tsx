// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import { SharedWorkspaceBanner } from '@/components/SharedWorkspaceBanner';
import {
  sharedWorkspaceBannerAtom,
  sharedWorkspacePresetAtom,
  isSharedWorkspaceBannerDismissed,
} from '@/store/sharedWorkspaceBanner';

function renderWith(open: boolean, presetLabel: string | null = null) {
  const store = createStore();
  store.set(sharedWorkspaceBannerAtom, open);
  store.set(sharedWorkspacePresetAtom, presetLabel);
  const utils = render(
    <Provider store={store}>
      <SharedWorkspaceBanner />
    </Provider>,
  );
  return { store, ...utils };
}

describe('SharedWorkspaceBanner', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('stays hidden when no shared workspace was opened', () => {
    renderWith(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('acknowledges the shared workspace and teaches the feature', () => {
    renderWith(true);
    const banner = screen.getByRole('dialog');
    // The whole point: tell the recipient the link restored a full derivation.
    expect(banner.textContent).toMatch(/derivation|worked solution/i);
  });

  it('dismissing it lowers the banner atom', async () => {
    const { store } = renderWith(true);
    await userEvent.click(screen.getByRole('button', { name: /got it|dismiss/i }));
    expect(store.get(sharedWorkspaceBannerAtom)).toBe(false);
  });

  it('remembers the dismissal so future share links stay quiet (#263)', async () => {
    renderWith(true);
    expect(isSharedWorkspaceBannerDismissed()).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: /got it|dismiss/i }));
    expect(isSharedWorkspaceBannerDismissed()).toBe(true);
  });

  it('remembers the dismissal when closed via Escape (#263)', async () => {
    renderWith(true);
    await userEvent.keyboard('{Escape}');
    expect(isSharedWorkspaceBannerDismissed()).toBe(true);
  });

  it('Escape dismisses even after focus has left the banner (#484)', async () => {
    // The recipient clicks onto the canvas, moving focus out of the banner. A
    // global keydown listener means Escape still dismisses it from anywhere.
    const { store } = renderWith(true);
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).not.toBe(screen.queryByRole('button', { name: /got it/i }));
    await userEvent.keyboard('{Escape}');
    expect(store.get(sharedWorkspaceBannerAtom)).toBe(false);
  });

  it('takes focus when mounted', () => {
    renderWith(true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /got it/i }));
  });

  it('displays the preset label if presetLabel is set', () => {
    renderWith(true, 'Real numbers only');
    const banner = screen.getByRole('dialog');
    expect(banner.textContent).toContain('This link set: Real numbers only');
  });
});
