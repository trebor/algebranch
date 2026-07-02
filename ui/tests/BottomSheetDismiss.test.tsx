// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { BottomSheet } from '@/components/BottomSheet';
import { SHORT_SCREEN_QUERY } from '@/hooks/useIsShortScreen';

/**
 * Dismissal must be consistent across every sheet and mode (#325): the header
 * never closes on click (that surprised on the titled sheets but not History),
 * the sheet takes focus on open so Escape works without a prior click, and the
 * drag handle is the one reliable swipe grip everywhere — including fullscreen,
 * and including History, which has no title bar to grab.
 */
function installMatchMedia(short: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === SHORT_SCREEN_QUERY ? short : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
    onchange: null,
  })) as unknown as typeof window.matchMedia;
}

const sheetEl = () => document.querySelector('.backdrop-blur-2xl') as HTMLElement;

describe('BottomSheet dismissal consistency (#325)', () => {
  let original: typeof window.matchMedia;
  beforeEach(() => {
    original = window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = original;
    cleanup();
  });

  it('moves focus into the sheet on open (so Escape needs no prior click)', async () => {
    render(
      <BottomSheet isOpen onClose={() => {}} title="History">
        <p>content</p>
      </BottomSheet>,
    );
    await screen.findByText('content');
    // Focus lands asynchronously (rAF → mounted → focus effect, BottomSheet.tsx),
    // so poll for it rather than sampling one frame — a single sync assert races
    // the rAF→focus chain and flakes on loaded CI runners (#359).
    await waitFor(() => expect(document.activeElement).toBe(sheetEl()));
  });

  it('does not close when the title bar is clicked', async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet isOpen onClose={onClose} title="History">
        <p>content</p>
      </BottomSheet>,
    );
    fireEvent.click(await screen.findByText('History'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps a draggable grab handle in fullscreen (alongside the close button)', async () => {
    installMatchMedia(true);
    render(
      <BottomSheet isOpen onClose={() => {}} title="History">
        <p>content</p>
      </BottomSheet>,
    );
    await screen.findByText('content');
    // The close button and the grab handle both exist in fullscreen.
    expect(screen.getByRole('button', { name: /close/i })).toBeTruthy();
    expect(sheetEl().querySelector('.cursor-grab')).not.toBeNull();
  });
});
