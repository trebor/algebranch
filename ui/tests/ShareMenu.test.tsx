// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareMenu, SHARE_HINT_STEP_THRESHOLD, SHARE_HINT_FLAG, classifyLinkSize, bandAdvice } from '@/components/ShareMenu';
import { encodeEqParam } from '@/utils/eqParam';
import { createShareLink } from '@/utils/shareLink';

// Short-link delivery is unit-tested in shareLink.test.ts with real crypto; here we
// mock `createShareLink` so we pin only the ShareMenu wiring — every primary row
// mints a short link (or, on failure, surfaces it and copies nothing), and the
// offline section copies the self-contained links.
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
    // Default: short link succeeds, returning the minted /s link.
    mockCreateShareLink.mockResolvedValue({
      status: 'ok',
      url: 'https://algebranch.org/s#deadbeefdeadbeefdeadbe',
    });
    // jsdom has no real matchMedia; treat motion as allowed unless a test opts in.
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
    // Default to online; the offline suite opts in per-test.
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
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

  const openMenu = () =>
    userEvent.click(screen.getByRole('button', { name: /more sharing options/i }));

  const openOffline = async () => {
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /work offline/i }));
  };

  // --- the Gestalt shift: short links lead (#481) ------------------------------

  it('the primary pill mints a SHORT link for the whole workspace', async () => {
    const getWs = vi.fn(() => 'COMPRESSED');
    renderMenu({ getCompressedWorkspace: getWs });

    await userEvent.click(screen.getByRole('button', { name: /share workspace/i }));

    expect(getWs).toHaveBeenCalledWith('full');
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('https://algebranch.org/s#deadbeefdeadbeefdeadbe'),
    );
  });

  it('the primary pill surfaces a failed mint in the menu instead of copying a long URL', async () => {
    mockCreateShareLink.mockResolvedValue({ status: 'error' });
    renderMenu({ getCompressedWorkspace: () => 'COMPRESSED' });

    await userEvent.click(screen.getByRole('button', { name: /share workspace/i }));

    // Nothing is copied — no silent ?ws= fallback — and the menu opens with the
    // failure surfaced and the offline links revealed.
    await waitFor(() => expect(screen.getByRole('note')).toBeTruthy());
    expect(screen.getByRole('note').textContent).toMatch(/couldn't create a short link/i);
    expect(screen.getByRole('menuitem', { name: /offline workspace/i })).toBeTruthy();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('the menu leads with three short-link scope rows: workspace, derivation, equation', async () => {
    renderMenu();
    expect(screen.queryByRole('menu')).toBeNull();
    await openMenu();

    const menu = screen.getByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    // First three rows are the primary short-link scopes, in this order.
    expect(items[0].textContent).toMatch(/whole workspace/i);
    expect(items[1].textContent).toMatch(/this derivation/i);
    expect(items[2].textContent).toMatch(/just the equation/i);
  });

  it('each primary row mints a short link for its own scope', async () => {
    const getWs = vi.fn((scope: string) => `payload-${scope}`);
    renderMenu({ getCompressedWorkspace: getWs });
    await openMenu();

    await userEvent.click(screen.getByRole('menuitem', { name: /whole workspace/i }));
    expect(getWs).toHaveBeenCalledWith('full');

    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /this derivation/i }));
    expect(getWs).toHaveBeenCalledWith('path');

    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /just the equation/i }));
    expect(getWs).toHaveBeenCalledWith('equation');

    // All three delivered a short link via createShareLink.
    expect(mockCreateShareLink).toHaveBeenCalledTimes(3);
  });

  it('a failed equation mint surfaces the failure too, copying nothing', async () => {
    mockCreateShareLink.mockResolvedValue({ status: 'error' });
    renderMenu({ equationString: 'x=1', getCompressedWorkspace: () => 'COMPRESSED' });
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /just the equation/i }));

    await waitFor(() =>
      expect(screen.getByRole('note').textContent).toMatch(/couldn't create a short link/i),
    );
    // No self-contained ?eq= silently copied — the offline equation row is offered instead.
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole('menuitem', { name: /offline equation/i })).toBeTruthy();
  });

  it('shows one chord per scope row, matching C E / C D / C W to equation / derivation / workspace', async () => {
    renderMenu();
    await openMenu();

    const caps = (name: RegExp) =>
      within(screen.getByRole('menuitem', { name }))
        .queryAllByText((_, el) => el?.tagName === 'KBD')
        .map((el) => el.textContent);

    expect(caps(/whole workspace/i)).toEqual(['C', 'W']);
    expect(caps(/this derivation/i)).toEqual(['C', 'D']);
    expect(caps(/just the equation/i)).toEqual(['C', 'E']);
  });

  it('shows no "Recommended" badge — every primary row is short, so the endorsement is moot', async () => {
    renderMenu();
    await openMenu();
    expect(screen.queryByText(/recommended/i)).toBeNull();
  });

  it('menu text carries no parentheses (plain copy, no jargon asides)', async () => {
    renderMenu();
    await openOffline(); // reveal every string, primary + offline
    const menu = screen.getByRole('menu');
    expect(menu.textContent).not.toMatch(/[()]/);
  });

  // --- the offline section (#481) ----------------------------------------------

  it('hides the self-contained links behind a collapsed "works offline" disclosure', async () => {
    renderMenu();
    await openMenu();
    // Collapsed by default: the ?ws= self-contained rows aren't present yet.
    expect(screen.queryByRole('menuitem', { name: /offline workspace/i })).toBeNull();

    await userEvent.click(screen.getByRole('menuitem', { name: /work offline/i }));
    // Expanded: the three self-contained variants appear.
    expect(screen.getByRole('menuitem', { name: /offline workspace/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /offline derivation/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /offline equation/i })).toBeTruthy();
  });

  it('the offline workspace row copies a self-contained ?ws= link (no short-link round-trip)', async () => {
    renderMenu({ getCompressedWorkspace: (scope: string) => `payload-${scope}` });
    await openOffline();
    await userEvent.click(screen.getByRole('menuitem', { name: /offline workspace/i }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('?ws=payload-full')),
    );
    expect(mockCreateShareLink).not.toHaveBeenCalled();
  });

  it('the offline equation row copies a self-contained ?eq= link', async () => {
    renderMenu({ equationString: 'x=1' });
    await openOffline();
    await userEvent.click(screen.getByRole('menuitem', { name: /offline equation/i }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`?eq=${encodeEqParam('x=1')}`)),
    );
  });

  // --- size badges retire to the offline section only (#439/#405 relocated) ----

  it('shows no size badge on the primary short-link rows', async () => {
    renderMenu({ getCompressedWorkspace: () => 'x'.repeat(20) });
    await openMenu();
    // The size band lived on the self-contained rows; short links are constant size,
    // so the primary rows carry no "Tiny/Compact/Large link" badge.
    await waitFor(() => expect(screen.getByRole('menu')).toBeTruthy());
    expect(screen.queryByText(/tiny link/i)).toBeNull();
  });

  it('shows the size band on the offline rows once expanded', async () => {
    renderMenu({ getCompressedWorkspace: () => 'x'.repeat(20) });
    await openOffline();
    await waitFor(() => expect(screen.getAllByText(/tiny link/i).length).toBeGreaterThan(0));
  });

  it('warns with de-jargoned advice on a large offline link', async () => {
    renderMenu({ getCompressedWorkspace: () => 'x'.repeat(3000) });
    await openOffline();
    const workspaceItem = screen.getByRole('menuitem', { name: /offline workspace/i });
    await waitFor(() => {
      const note = within(workspaceItem).getByRole('note');
      expect(note.textContent).toMatch(/trimmed/i);
      // No jargon: it points at "a smaller link", not "a narrower scope".
      expect(note.textContent).not.toMatch(/scope/i);
    });
  });

  // --- offline: short links need a connection (#481) ---------------------------

  describe('offline', () => {
    const goOffline = () =>
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    it('grays out (disables) the three primary short-link rows', async () => {
      goOffline();
      renderMenu();
      await openMenu();
      expect(screen.getByRole('menuitem', { name: /whole workspace/i })).toBeDisabled();
      expect(screen.getByRole('menuitem', { name: /this derivation/i })).toBeDisabled();
      expect(screen.getByRole('menuitem', { name: /just the equation/i })).toBeDisabled();
    });

    it('a disabled primary row mints nothing when clicked', async () => {
      goOffline();
      renderMenu();
      await openMenu();
      // Disabled <button> dispatches no click, so the short-link resolver never runs.
      fireEvent.click(screen.getByRole('menuitem', { name: /whole workspace/i }));
      expect(mockCreateShareLink).not.toHaveBeenCalled();
    });

    it('auto-expands the offline section and explains why the short links are grayed', async () => {
      goOffline();
      renderMenu();
      await openMenu();
      // The offline rows are visible without clicking the toggle first.
      expect(screen.getByRole('menuitem', { name: /offline workspace/i })).toBeTruthy();
      const note = screen.getByRole('note');
      expect(note.textContent).toMatch(/offline/i);
      expect(note.textContent).toMatch(/connection/i);
    });

    it('the offline links still copy self-contained URLs', async () => {
      goOffline();
      renderMenu({ getCompressedWorkspace: (scope: string) => `payload-${scope}` });
      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: /offline workspace/i }));
      await waitFor(() =>
        expect(writeText).toHaveBeenCalledWith(expect.stringContaining('?ws=payload-full')),
      );
      expect(mockCreateShareLink).not.toHaveBeenCalled();
    });

    it('the pill opens the menu instead of silently minting a fallback link', async () => {
      goOffline();
      renderMenu();
      expect(screen.queryByRole('menu')).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: /share workspace/i }));
      expect(screen.getByRole('menu')).toBeTruthy();
      expect(mockCreateShareLink).not.toHaveBeenCalled();
    });

    it('re-enables the primary rows once back online', async () => {
      renderMenu(); // online (default)
      await openMenu();
      expect(screen.getByRole('menuitem', { name: /whole workspace/i })).toBeEnabled();
    });
  });

  // --- footer trust line (#482) ------------------------------------------------

  it('shows a privacy reassurance line linking to the privacy policy', async () => {
    renderMenu();
    await openMenu();
    const link = screen.getByRole('link', { name: /how sharing works/i });
    expect(link.getAttribute('href')).toBe('/privacy');
  });

  // --- the right-moment hint pulse (unchanged) ---------------------------------

  it('pulses a one-time hint once the derivation has several real steps', () => {
    const { container } = renderMenu({ derivationStepCount: SHARE_HINT_STEP_THRESHOLD });
    expect(container.querySelector('[data-share-hint]')).not.toBeNull();
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

  // --- link-size helpers (still exported for the offline rows) ------------------

  describe('link-size characterization (#439)', () => {
    it('bands the length by real-world URL safety', () => {
      expect(classifyLinkSize(50).label).toBe('Tiny');
      expect(classifyLinkSize(1000).label).toBe('Compact');
      expect(classifyLinkSize(5000)).toEqual({ label: 'Large', tone: 'warn' });
    });
  });

  describe('large-link advice (#405, de-jargoned #481)', () => {
    it('explains the truncation risk only for the warn band', () => {
      expect(bandAdvice(50)).toBeNull();
      expect(bandAdvice(1000)).toBeNull();
      expect(bandAdvice(3000)).toMatch(/trimmed/i);
    });

    it('nudges to a smaller link in plain words, only when one exists below', () => {
      expect(bandAdvice(3000, { hasSmallerScope: true })).toMatch(/smaller link/i);
      const smallest = bandAdvice(3000, { hasSmallerScope: false });
      expect(smallest).toMatch(/trimmed/i);
      expect(smallest).not.toMatch(/smaller link/i);
    });
  });
});
