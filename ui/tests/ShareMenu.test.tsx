// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareMenu, SHARE_HINT_STEP_THRESHOLD, SHARE_HINT_FLAG, classifyLinkSize } from '@/components/ShareMenu';
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

    // Hovering the pill pre-computes the link sizes, so getWs may be called more
    // than once; the headline behavior is that the click copies the full ?ws= link.
    expect(getWs).toHaveBeenCalledWith('full');
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('?ws=COMPRESSED')),
    );
  });

  it('the caret opens a menu with workspace, derivation, and equation items', async () => {
    renderMenu();
    expect(screen.queryByRole('menu')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /more sharing options/i }));

    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /workspace/i })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: /derivation/i })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: /equation/i })).toBeTruthy();
  });

  it('shows the C-then-P chord on the derivation row and no chord on the equation row (#440)', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more sharing options/i }));

    const derivationItem = screen.getByRole('menuitem', { name: /derivation/i });
    const derivationCaps = within(derivationItem)
      .queryAllByText((_, el) => el?.tagName === 'KBD')
      .map((el) => el.textContent);
    expect(derivationCaps).toEqual(['C', 'P']);

    // The C L chord is retired to menu-only, so the equation row shows no keycap.
    const equationItem = screen.getByRole('menuitem', { name: /equation/i });
    const equationCaps = within(equationItem).queryAllByText((_, el) => el?.tagName === 'KBD');
    expect(equationCaps).toHaveLength(0);
  });

  it('menu item descriptions name what each link restores', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /more sharing options/i }));

    expect(screen.getByText(/all branches and steps/i)).toBeTruthy();
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

  // Share scope (#439): three separate menu items — workspace (full tree),
  // derivation (path only), equation — ordered largest → smallest link.
  // No segmented control; each item is independently clickable.
  describe('share scope (#439)', () => {
    const renderScoped = () => {
      const getCompressedWorkspace = vi.fn(async (scope: 'full' | 'path') => `payload-${scope}`);
      renderMenu({
        getCompressedWorkspace,
        derivationStepCount: 3,
      });
      return getCompressedWorkspace;
    };
    const openMenu = () =>
      userEvent.click(screen.getByRole('button', { name: /more sharing options/i }));

    it('the menu lists workspace, derivation, and equation items (largest → smallest)', async () => {
      renderScoped();
      await openMenu();
      const menu = screen.getByRole('menu');
      const items = within(menu).getAllByRole('menuitem');
      expect(items.length).toBeGreaterThanOrEqual(3);
      expect(items[0].textContent).toMatch(/workspace/i);
      expect(items[1].textContent).toMatch(/derivation/i);
      expect(items[2].textContent).toMatch(/equation/i);
    });

    it('the workspace item shares the full tree', async () => {
      const getCompressedWorkspace = renderScoped();
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /share workspace/i }));

      await waitFor(() => expect(writeText).toHaveBeenCalled());
      expect(getCompressedWorkspace).toHaveBeenCalledWith('full');
      expect(writeText.mock.calls[0][0]).toContain('payload-full');
    });

    it('the derivation item shares the path payload', async () => {
      const getCompressedWorkspace = renderScoped();
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /share derivation/i }));

      await waitFor(() => expect(writeText).toHaveBeenCalled());
      expect(getCompressedWorkspace).toHaveBeenCalledWith('path');
      expect(writeText.mock.calls[0][0]).toContain('payload-path');
    });

    it('the derivation description shows the step count', async () => {
      renderScoped(); // derivationStepCount=3
      await openMenu();
      const menu = screen.getByRole('menu');
      expect(menu.textContent).toMatch(/3 step/);
    });

    it('the primary pill shares the full workspace by default', async () => {
      const getCompressedWorkspace = renderScoped();
      await userEvent.click(screen.getByRole('button', { name: /share workspace link/i }));
      await waitFor(() => expect(writeText).toHaveBeenCalled());
      expect(getCompressedWorkspace).toHaveBeenCalledWith('full');
    });
  });

  // Link-size characterization (#439): the menu advises whether a link pastes
  // cleanly ("Tiny / Compact / Large"), computed from the real URL length —
  // a raw char count alone doesn't tell the user the consequence.
  describe('link-size characterization (#439)', () => {
    it('bands the length by real-world URL safety', () => {
      expect(classifyLinkSize(50).label).toBe('Tiny');
      expect(classifyLinkSize(1000).label).toBe('Compact');
      expect(classifyLinkSize(5000)).toEqual({ label: 'Large', tone: 'warn' });
    });

    it('shows a qualitative band on the menu items, not just a number', async () => {
      renderMenu({ getCompressedWorkspace: () => 'x'.repeat(20) });
      await userEvent.click(screen.getByRole('button', { name: /more sharing options/i }));
      await waitFor(() => expect(screen.getAllByText(/tiny link/i).length).toBeGreaterThan(0));
    });

    it('warns when a link is large enough to risk truncation', async () => {
      renderMenu({ getCompressedWorkspace: () => 'x'.repeat(3000) });
      await userEvent.click(screen.getByRole('button', { name: /more sharing options/i }));
      await waitFor(() => expect(screen.getAllByText(/large link/i).length).toBeGreaterThan(0));
    });
  });
});
