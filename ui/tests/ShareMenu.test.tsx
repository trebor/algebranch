// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareMenu, SHARE_HINT_STEP_THRESHOLD, SHARE_HINT_FLAG, classifyLinkSize, bandAdvice } from '@/components/ShareMenu';
import { encodeEqParam } from '@/utils/eqParam';
import { createShareLink } from '@/utils/shareLink';

// The short-link create round-trip (encrypt → POST → build link) is unit-tested in
// shareLink.test.ts with real crypto; here we mock it to pin only the ShareMenu
// wiring — copy the returned link on success, fall back to `?ws=` on failure.
vi.mock('@/utils/shareLink', () => ({ createShareLink: vi.fn() }));
const mockCreateShareLink = vi.mocked(createShareLink);

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
    mockCreateShareLink.mockReset();
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

  it('the short-link item copies the returned /s#key link (#480)', async () => {
    mockCreateShareLink.mockResolvedValue({
      status: 'ok',
      url: 'https://algebranch.org/s#deadbeefdeadbeefdeadbe',
    });
    renderMenu({ getCompressedWorkspace: () => 'COMPRESSED' });

    await userEvent.click(screen.getByRole('button', { name: /more sharing options/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /short link/i }));

    expect(mockCreateShareLink).toHaveBeenCalledWith('COMPRESSED', expect.any(String));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('https://algebranch.org/s#deadbeefdeadbeefdeadbe'),
    );
  });

  it('the short-link item falls back to a ?ws= link when creation fails (#480)', async () => {
    mockCreateShareLink.mockResolvedValue({ status: 'error' });
    renderMenu({ getCompressedWorkspace: () => 'COMPRESSED' });

    await userEvent.click(screen.getByRole('button', { name: /more sharing options/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /short link/i }));

    // Sharing never dead-ends: on failure the self-contained workspace link is copied.
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

    it('the menu leads with the short link, then lists workspace, derivation, and equation (largest → smallest)', async () => {
      renderScoped();
      await openMenu();
      const menu = screen.getByRole('menu');
      const items = within(menu).getAllByRole('menuitem');
      expect(items.length).toBeGreaterThanOrEqual(4);
      // Short link (#480) is the recommended headline, above the self-contained
      // `?ws=` scopes ordered largest → smallest.
      expect(items[0].textContent).toMatch(/short link/i);
      expect(items[1].textContent).toMatch(/workspace/i);
      expect(items[2].textContent).toMatch(/derivation/i);
      expect(items[3].textContent).toMatch(/equation/i);
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

  // Large-link advice (#405): beyond the amber "Large link" badge, the menu
  // explains *why* a large link is risky and points at the smaller scopes
  // already listed below — so the warning is actionable, not just a color.
  describe('large-link advice (#405)', () => {
    it('bandAdvice explains the truncation risk only for the warn band', () => {
      expect(bandAdvice(50)).toBeNull();
      expect(bandAdvice(1000)).toBeNull();
      expect(bandAdvice(3000)).toMatch(/trimmed/i);
    });

    it('nudges to a narrower scope only when one exists below', () => {
      expect(bandAdvice(3000, { hasSmallerScope: true })).toMatch(/narrower scope/i);
      // The smallest scope (equation) has nothing below it → risk sentence only.
      const smallest = bandAdvice(3000, { hasSmallerScope: false });
      expect(smallest).toMatch(/trimmed/i);
      expect(smallest).not.toMatch(/narrower scope/i);
    });

    it('renders the advice inside the specific large item card, not floating above', async () => {
      // Same payload for full + path → both those links are large.
      renderMenu({ getCompressedWorkspace: () => 'x'.repeat(3000) });
      await userEvent.click(screen.getByRole('button', { name: /more sharing options/i }));

      const workspaceItem = screen.getByRole('menuitem', { name: /share workspace/i });
      await waitFor(() => {
        // The note lives *inside* the workspace card (containment), not as a
        // menu-level sibling floating above the options.
        const note = within(workspaceItem).getByRole('note');
        expect(note.textContent).toMatch(/trimmed/i);
        expect(note.textContent).toMatch(/narrower scope/i);
      });
    });

    it('a large single derivation warns on its own row even when nothing else is', async () => {
      // Full tiny, path large: emulate a long single derivation path.
      const getCompressedWorkspace = (scope: 'full' | 'path') =>
        scope === 'path' ? 'x'.repeat(3000) : 'SMALL';
      renderMenu({ getCompressedWorkspace });
      await userEvent.click(screen.getByRole('button', { name: /more sharing options/i }));

      const derivationItem = screen.getByRole('menuitem', { name: /share derivation/i });
      const workspaceItem = screen.getByRole('menuitem', { name: /share workspace/i });
      await waitFor(() => expect(within(derivationItem).getByRole('note')).toBeTruthy());
      expect(within(workspaceItem).queryByRole('note')).toBeNull();
    });

    it('shows no advice note when every link is small', async () => {
      renderMenu({ getCompressedWorkspace: () => 'COMPRESSED' });
      await userEvent.click(screen.getByRole('button', { name: /more sharing options/i }));
      // Let the async size computation settle, then assert no note appeared.
      await waitFor(() => expect(screen.getAllByText(/tiny link/i).length).toBeGreaterThan(0));
      expect(screen.queryByRole('note')).toBeNull();
    });
  });
});
