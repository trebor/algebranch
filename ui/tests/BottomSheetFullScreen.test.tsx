// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { BottomSheet, resolveSheetMode } from '@/components/BottomSheet';
import { SHORT_SCREEN_QUERY } from '@/hooks/useIsShortScreen';

/**
 * Below the short-screen breakpoint (mobile landscape) the draggable bottom-sheet
 * metaphor is dishonest — a drag handle advertises a resize that can't help when
 * there's no useful partial state — so the sheet switches to a full-screen panel
 * with an explicit close control (#325).
 */

describe('resolveSheetMode (#325)', () => {
  it('is a snap sheet on a roomy viewport', () => {
    expect(resolveSheetMode(false, false)).toBe('snap');
  });
  it('is fit-content on a roomy viewport when fitContent is set', () => {
    expect(resolveSheetMode(false, true)).toBe('fit');
  });
  it('is full-screen on a short viewport regardless of fitContent', () => {
    expect(resolveSheetMode(true, false)).toBe('fullscreen');
    expect(resolveSheetMode(true, true)).toBe('fullscreen');
  });
});

/** matchMedia stand-in whose short-screen match we can pin. */
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

describe('BottomSheet — full-screen variant (#325)', () => {
  let original: typeof window.matchMedia;
  beforeEach(() => {
    original = window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = original;
    cleanup();
  });

  it('renders an explicit close control and drops the rounded top on a short viewport', async () => {
    installMatchMedia(true);
    render(
      <BottomSheet isOpen onClose={() => {}} title="History">
        <p>content</p>
      </BottomSheet>,
    );
    const close = await screen.findByRole('button', { name: /close/i });
    expect(close).toBeTruthy();
    const panel = close.closest('.rounded-t-2xl');
    expect(panel).toBeNull();
  });

  it('keeps the draggable handle (no dedicated close button) on a roomy viewport', async () => {
    installMatchMedia(false);
    render(
      <BottomSheet isOpen onClose={() => {}} title="History">
        <p>content</p>
      </BottomSheet>,
    );
    // Title is present, but there is no separate close button in snap mode.
    await screen.findByText('History');
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull();
  });
});
