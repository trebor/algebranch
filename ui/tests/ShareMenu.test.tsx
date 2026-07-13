// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultStore } from 'jotai';
import { ShareMenu, SHARE_HINT_STEP_THRESHOLD, SHARE_HINT_FLAG, classifyLinkSize, bandAdvice, formatUtcDayReset, busyShareNote, busyShareSummary, liveBusyFailure } from '@/components/ShareMenu';
import { encodeEqParam } from '@/utils/eqParam';
import { createShareLink } from '@/utils/shareLink';
import { toastAtom } from '@/store/equation';

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
    getDefaultStore().set(toastAtom, null);
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

  it('a drained write budget (busy) names the limit and reset, steering to offline links (#505)', async () => {
    mockCreateShareLink.mockResolvedValue({ status: 'busy', dailyLimit: 5000 });
    renderMenu({ getCompressedWorkspace: () => 'COMPRESSED' });

    await userEvent.click(screen.getByRole('button', { name: /share workspace/i }));

    // Same conscious-pick shape as other failures — nothing silently copied, the
    // offline links revealed — but the note gives real numbers, not "broken":
    // the daily limit the server named and roughly when it resets.
    await waitFor(() => expect(screen.getByRole('note')).toBeTruthy());
    const note = screen.getByRole('note').textContent ?? '';
    expect(note).toMatch(/today's limit of 5,000/i);
    expect(note).toMatch(/more in about/i);
    expect(note).not.toMatch(/couldn't create/i);
    expect(screen.getByRole('menuitem', { name: /offline workspace/i })).toBeTruthy();
    expect(writeText).not.toHaveBeenCalled();
  });

  // --- failure toasts (#505): the in-menu note explains, the red toast alerts ---

  it('a failed mint also fires a red toast, since the in-menu note alone is easy to miss', async () => {
    mockCreateShareLink.mockResolvedValue({ status: 'error' });
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /share workspace/i }));

    await waitFor(() => expect(getDefaultStore().get(toastAtom)).not.toBeNull());
    const toast = getDefaultStore().get(toastAtom);
    expect(toast?.type).toBe('error');
    expect(toast?.message).toMatch(/short link not copied/i);
  });

  it('a busy mint fires the same short toast — the note carries the numbers', async () => {
    mockCreateShareLink.mockResolvedValue({ status: 'busy', dailyLimit: 5000 });
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /share workspace/i }));

    await waitFor(() => expect(getDefaultStore().get(toastAtom)).not.toBeNull());
    const toast = getDefaultStore().get(toastAtom);
    expect(toast?.type).toBe('error');
    expect(toast?.message).toMatch(/short link not copied/i);
    expect(toast?.message).not.toMatch(/5,000/); // detail lives in the menu note
  });

  it('a clipboard failure after a successful mint is no longer silent (red toast)', async () => {
    // writeText rejects and jsdom has no execCommand fallback → safeCopyText false.
    writeText.mockRejectedValue(new Error('denied'));
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /share workspace/i }));

    await waitFor(() => expect(getDefaultStore().get(toastAtom)).not.toBeNull());
    const toast = getDefaultStore().get(toastAtom);
    expect(toast?.type).toBe('error');
    expect(toast?.message).toMatch(/wasn't copied/i);
  });

  it('a clipboard failure on an offline self-contained link gets the same toast', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    renderMenu();
    await openOffline();
    await userEvent.click(screen.getByRole('menuitem', { name: /offline workspace link/i }));

    await waitFor(() => expect(getDefaultStore().get(toastAtom)).not.toBeNull());
    const toast = getDefaultStore().get(toastAtom);
    expect(toast?.type).toBe('error');
    expect(toast?.message).toMatch(/wasn't copied/i);
  });

  it('a successful share fires no error toast', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /share workspace/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(getDefaultStore().get(toastAtom)).toBeNull();
  });

  // --- budget-exhausted mode mirrors offline (#505): same cause, same shape ----

  describe('budget-exhausted mode', () => {
    // Discover the drained budget the only way the client can: a busy mint.
    const discoverBusy = async () => {
      mockCreateShareLink.mockResolvedValue({ status: 'busy', dailyLimit: 5000 });
      renderMenu();
      await userEvent.click(screen.getByRole('button', { name: /share workspace/i }));
      await waitFor(() => expect(screen.getByRole('note')).toBeTruthy());
    };

    it('grays out (disables) the three primary short-link rows, like offline', async () => {
      await discoverBusy();
      expect(screen.getByRole('menuitem', { name: /whole workspace/i })).toBeDisabled();
      expect(screen.getByRole('menuitem', { name: /this derivation/i })).toBeDisabled();
      expect(screen.getByRole('menuitem', { name: /just the equation/i })).toBeDisabled();
      // The offline rows stay available — they're the whole point of the steer.
      expect(screen.getByRole('menuitem', { name: /offline workspace link/i })).toBeEnabled();
    });

    it('persists across menu close/reopen — the budget stays drained until UTC midnight', async () => {
      await discoverBusy();
      await userEvent.keyboard('{Escape}');
      await openMenu();
      expect(screen.getByRole('note').textContent).toMatch(/today's limit/i);
      expect(screen.getByRole('menuitem', { name: /whole workspace/i })).toBeDisabled();
    });

    it('the pill stops re-attempting: it opens the menu instead of minting again', async () => {
      await discoverBusy();
      await userEvent.keyboard('{Escape}');
      expect(mockCreateShareLink).toHaveBeenCalledTimes(1);

      await userEvent.click(screen.getByRole('button', { name: /share workspace/i }));
      expect(mockCreateShareLink).toHaveBeenCalledTimes(1); // no second POST
      expect(screen.getByRole('note').textContent).toMatch(/today's limit/i);
    });

    it('the pill swaps to an hourglass, the sibling of the offline wifi-off glyph', async () => {
      const { container } = renderMenu();
      mockCreateShareLink.mockResolvedValue({ status: 'busy', dailyLimit: 5000 });
      expect(container.querySelector('.lucide-hourglass')).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: /share workspace/i }));
      await waitFor(() => expect(container.querySelector('.lucide-hourglass')).not.toBeNull());
    });

    it('a plain error does NOT gray the rows — a blip is retryable, a drained day is not', async () => {
      mockCreateShareLink.mockResolvedValue({ status: 'error' });
      renderMenu();
      await userEvent.click(screen.getByRole('button', { name: /share workspace/i }));
      await waitFor(() => expect(screen.getByRole('note')).toBeTruthy());
      expect(screen.getByRole('menuitem', { name: /whole workspace/i })).toBeEnabled();
    });

    it('liveBusyFailure expires a stale busy at its reset instant', () => {
      const busy = { kind: 'busy', dailyLimit: 5000, resetsAt: 1000 } as const;
      expect(liveBusyFailure(busy, 999)).toBe(busy);
      expect(liveBusyFailure(busy, 1000)).toBeNull();
      expect(liveBusyFailure({ kind: 'error' }, 0)).toBeNull();
      expect(liveBusyFailure(null, 0)).toBeNull();
    });
  });

  // The countdown + note copy are pure and clock-injected — pin them directly.

  describe('formatUtcDayReset', () => {
    it.each([
      ['2026-07-13T21:30:00Z', '2 hours 30 minutes'],
      ['2026-07-13T22:00:00Z', '2 hours'],
      ['2026-07-13T23:15:00Z', '45 minutes'],
      ['2026-07-13T23:59:30Z', '1 minute'],
      ['2026-07-13T23:00:30Z', '1 hour'], // 59m30s rounds up, never promises early
      ['2026-07-13T00:00:00Z', '24 hours'], // day just rolled over
    ])('%s → "%s"', (now, expected) => {
      expect(formatUtcDayReset(new Date(now))).toBe(expected);
    });
  });

  describe('busyShareNote', () => {
    const now = new Date('2026-07-13T21:30:00Z');

    it('names the limit with thousands separators and the time to reset', () => {
      const note = busyShareNote(5000, now);
      expect(note).toMatch(/today's limit of 5,000/i);
      expect(note).toMatch(/2 hours 30 minutes/);
      expect(note).toMatch(/use a link that works offline below/i);
    });

    it('still gives the reset time when the server named no limit', () => {
      const note = busyShareNote(undefined, now);
      expect(note).not.toMatch(/limit of/i);
      expect(note).toMatch(/2 hours 30 minutes/);
      expect(note).toMatch(/use a link that works offline below/i);
    });

    it('exposes the summary without the menu-specific steering, for the chord toast', () => {
      const summary = busyShareSummary(5000, now);
      expect(summary).toMatch(/today's limit of 5,000/i);
      expect(summary).toMatch(/2 hours 30 minutes/);
      expect(summary).not.toMatch(/below/i);
    });
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
