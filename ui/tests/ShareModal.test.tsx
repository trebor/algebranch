// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import { ShareModal } from '@/components/ShareModal';
import {
  shareModalOpenAtom,
  settingsAtom,
  historyTreeAtom,
  currentNodeIdAtom,
  tabsAtom,
  activeTabIdAtom,
  DEFAULT_SETTINGS,
  serializeWorkspaceState,
} from '@/store/equation';
import { createShareLink } from '@/utils/shareLink';
import { ensureNodeIds, parseEquation } from 'math-engine';

vi.mock('@/utils/shareLink', () => ({
  createShareLink: vi.fn(),
  busyShareSummary: (limit: number | undefined) => `Busy limit: ${limit}`,
  nextUtcMidnight: () => 123456789,
  classifyLinkSize: () => ({ label: 'Compact', tone: 'ok' }),
  bandAdvice: () => null,
  LINK_NOT_COPIED_TOAST: "Not copied",
}));

vi.mock('@/store/equation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/equation')>();
  return {
    ...actual,
    serializeWorkspaceState: vi.fn().mockResolvedValue('MOCK_COMPRESSED'),
  };
});

const mockCreateShareLink = vi.mocked(createShareLink);
const mockSerializeWorkspaceState = vi.mocked(serializeWorkspaceState);

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

describe('ShareModal', () => {
  let writeText: ReturnType<typeof mockClipboard>;
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    writeText = mockClipboard();
    store = createStore();
    store.set(shareModalOpenAtom, true);
    store.set(settingsAtom, { ...DEFAULT_SETTINGS });
    const initialTree = {
      '0': { id: '0', equation: ensureNodeIds(parseEquation('x = 2')), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
    };
    store.set(currentNodeIdAtom, '0');
    store.set(historyTreeAtom, initialTree);
    store.set(tabsAtom, [{
      id: 'test-tab',
      name: 'Test Workspace',
      historyTree: initialTree,
      currentNodeId: '0',
      isModified: false,
    }]);
    store.set(activeTabIdAtom, 'test-tab');
    mockCreateShareLink.mockReset();
    mockCreateShareLink.mockResolvedValue({
      status: 'ok',
      url: 'https://algebranch.org/s#mockkey',
    });
    mockSerializeWorkspaceState.mockClear();
    mockSerializeWorkspaceState.mockResolvedValue('MOCK_COMPRESSED');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  afterEach(cleanup);

  const renderModal = () =>
    render(
      <Provider store={store}>
        <ShareModal />
      </Provider>,
    );

  it('renders modal with title and controls when open', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /^share$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /copy share link/i })).toBeTruthy();
  });

  it('allows changing share scope', async () => {
    renderModal();
    const derivationBtn = screen.getByRole('radio', { name: /derivation only/i });
    expect(derivationBtn.getAttribute('aria-checked')).toBe('false');
    await userEvent.click(derivationBtn);
    expect(derivationBtn.getAttribute('aria-checked')).toBe('true');
  });

  it('allows changing delivery method', async () => {
    renderModal();
    const offlineBtn = screen.getByRole('radio', { name: /works offline/i });
    expect(offlineBtn.getAttribute('aria-checked')).toBe('false');
    await userEvent.click(offlineBtn);
    expect(offlineBtn.getAttribute('aria-checked')).toBe('true');
  });

  it('starts collapsed by default, but exposes switches when expanded', async () => {
    renderModal();

    // Switches are hidden initially
    expect(screen.queryByRole('switch', { name: /toggle allow decimals option/i })).toBeNull();

    // Click to expand
    const toggle = screen.getByRole('switch', { name: /include settings in share link/i });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await userEvent.click(toggle);

    // Switches now exist
    const decimalSwitch = screen.getByRole('switch', { name: /toggle allow decimals option/i });
    expect(decimalSwitch.getAttribute('aria-checked')).toBe('false');

    // Toggle decimal switch
    await userEvent.click(decimalSwitch);
    expect(store.get(settingsAtom).allowEvaluateToDecimal).toBe(true);

    // Click to collapse again
    await userEvent.click(toggle);
    expect(screen.queryByRole('switch', { name: /toggle allow decimals option/i })).toBeNull();
  });

  it('disables classroom settings toggle when equation-only scope is selected', async () => {
    renderModal();

    // Select equation-only scope
    const equationBtn = screen.getByRole('radio', { name: /equation only/i });
    await userEvent.click(equationBtn);

    // The classroom settings toggle switch is not rendered and a message is displayed
    expect(screen.queryByRole('switch', { name: /include settings in share link/i })).toBeNull();
    expect(screen.getByText(/not supported for equation only/i)).toBeTruthy();

    // Switches remain hidden because the panel cannot be expanded
    expect(screen.queryByRole('switch', { name: /toggle allow decimals option/i })).toBeNull();
  });

  it('can opt-out of including settings in the share link', async () => {
    renderModal();

    // Master switch starts disabled (false) by default
    const includeSwitch = screen.getByRole('switch', { name: /include settings in share link/i });
    expect(includeSwitch.getAttribute('aria-checked')).toBe('false');

    // Toggle it ON to configure settings
    await userEvent.click(includeSwitch);
    expect(includeSwitch.getAttribute('aria-checked')).toBe('true');

    // Individual switches should be visible and not disabled
    const decimalSwitch = screen.getByRole('switch', { name: /toggle allow decimals option/i }) as HTMLButtonElement;
    expect(decimalSwitch.disabled).toBe(false);

    // Toggle it back OFF to opt-out
    await userEvent.click(includeSwitch);
    expect(includeSwitch.getAttribute('aria-checked')).toBe('false');

    // Individual switches collapse and disappear from the DOM
    expect(screen.queryByRole('switch', { name: /toggle allow decimals option/i })).toBeNull();

    // Call Copy Share Link to trigger serialization
    const copyBtn = screen.getByRole('button', { name: /copy share link/i });
    await userEvent.click(copyBtn);

    // Expect serializeWorkspaceState to have been called with undefined for settings (fifth parameter)
    expect(mockSerializeWorkspaceState).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'full',
      undefined
    );
  });

  it('disables and forces capability toggles if they are violated by equations', async () => {
    // Inject a step that used Evaluate to Decimal
    store.set(historyTreeAtom, {
      '0': { id: '0', equation: ensureNodeIds(parseEquation('x = 3/4')), parentId: null, childrenIds: ['1'], label: 'Initial', timestamp: 1 },
      '1': { id: '1', equation: ensureNodeIds(parseEquation('x = 0.75')), parentId: '0', childrenIds: [], label: 'Evaluate to Decimal', timestamp: 2 },
    });
    store.set(currentNodeIdAtom, '1');
    renderModal();

    // Toggle the master switch to true to expand classroom settings
    const includeSwitch = screen.getByRole('switch', { name: /include settings in share link/i });
    await userEvent.click(includeSwitch);

    // The decimals toggle is forced to true and disabled in UI
    const decimalSwitch = await screen.findByRole('switch', { name: /toggle allow decimals option/i }) as HTMLButtonElement;
    expect(decimalSwitch.getAttribute('aria-checked')).toBe('true');
    expect(decimalSwitch.disabled).toBe(true);
  });

  it('calls createShareLink and copies to clipboard on Copy Share Link click', async () => {
    renderModal();
    const copyBtn = screen.getByRole('button', { name: /copy share link/i });
    await userEvent.click(copyBtn);

    expect(mockCreateShareLink).toHaveBeenCalled();
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('https://algebranch.org/s#mockkey');
    });
    expect(screen.getByText(/link copied!/i)).toBeTruthy();
  });
});
