// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareMenu, SHARE_HINT_STEP_THRESHOLD, SHARE_HINT_FLAG } from '@/components/ShareMenu';
import { encodeEqParam } from '@/utils/eqParam';

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

// useReducedMotion reads window.matchMedia; default jsdom has none → motion allowed.
function setReducedMotion(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: reduce,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

describe('ShareMenu', () => {
  let writeText: ReturnType<typeof mockClipboard>;

  beforeEach(() => {
    writeText = mockClipboard();
    localStorage.clear();
    // jsdom has no real matchMedia; treat motion as allowed unless a test opts in.
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  });
  afterEach(cleanup);

  const renderMenu = (props: Partial<React.ComponentProps<typeof ShareMenu>> = {}) =>
    render(
      <ShareMenu
        equationString="x=1"
        getCompressedWorkspace={() => 'COMPRESSED'}
        {...props}
      />,
    );

  it('primary click copies the WORKSPACE link (the headline action)', async () => {
    const getWs = vi.fn(() => 'COMPRESSED');
    renderMenu({ getCompressedWorkspace: getWs });

    await userEvent.click(screen.getByRole('button', { name: /share workspace/i }));

    expect(getWs).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('?ws=COMPRESSED')),
    );
  });

  it('the caret opens a menu offering both share scopes', async () => {
    renderMenu();
    expect(screen.queryByRole('menu')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /more sharing options/i }));

    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /workspace/i })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: /equation/i })).toBeTruthy();
  });

  it('each menu row sells what the link restores (subtitles)', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more sharing options/i }));

    expect(screen.getByText(/full derivation and history/i)).toBeTruthy();
    expect(screen.getByText(/just the starting equation/i)).toBeTruthy();
  });

  it('the equation menu row copies an ?eq= link', async () => {
    renderMenu({ equationString: 'x=1' });
    await userEvent.click(screen.getByRole('button', { name: /more sharing options/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /equation/i }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining(`?eq=${encodeEqParam('x=1')}`),
      ),
    );
  });

  it('pulses a one-time hint once the derivation has several real steps', () => {
    const { container } = renderMenu({ derivationStepCount: SHARE_HINT_STEP_THRESHOLD });
    expect(container.querySelector('[data-share-hint]')).not.toBeNull();
    // Firing the hint records the one-time flag so it never repeats.
    expect(localStorage.getItem(SHARE_HINT_FLAG)).toBe('true');
  });

  it('does not pulse before the derivation is substantial', () => {
    const { container } = renderMenu({ derivationStepCount: SHARE_HINT_STEP_THRESHOLD - 1 });
    expect(container.querySelector('[data-share-hint]')).toBeNull();
  });

  it('does not pulse again once the one-time flag is set', () => {
    localStorage.setItem(SHARE_HINT_FLAG, 'true');
    const { container } = renderMenu({ derivationStepCount: SHARE_HINT_STEP_THRESHOLD + 5 });
    expect(container.querySelector('[data-share-hint]')).toBeNull();
  });

  it('suppresses the pulse under prefers-reduced-motion', () => {
    setReducedMotion(true);
    const { container } = renderMenu({ derivationStepCount: SHARE_HINT_STEP_THRESHOLD + 5 });
    expect(container.querySelector('[data-share-hint]')).toBeNull();
  });
});
