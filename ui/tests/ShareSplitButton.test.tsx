// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import Home from '@/app/page';
import {
  rawTabsAtom,
  rawActiveTabIdAtom,
  type WorkspaceTab,
  shareModalOpenAtom,
} from '@/store/equation';
import { createShareLink } from '@/utils/shareLink';
import { parseEquation } from 'math-engine-client';

vi.mock('@/utils/shareLink', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/shareLink')>();
  return {
    ...actual,
    createShareLink: vi.fn(),
    busyShareSummary: (limit: number | undefined) => `Busy limit: ${limit}`,
    nextUtcMidnight: () => 123456789,
    classifyLinkSize: () => ({ label: 'Compact', tone: 'ok' }),
    bandAdvice: () => null,
    LINK_NOT_COPIED_TOAST: 'Not copied',
  };
});

vi.mock('@/store/equation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/equation')>();
  return {
    ...actual,
    serializeWorkspaceState: vi.fn().mockResolvedValue('MOCK_COMPRESSED'),
  };
});

const mockCreateShareLink = vi.mocked(createShareLink);

function makeStore() {
  const store = createStore();
  const tab: WorkspaceTab = {
    id: 'a',
    name: 'Workspace 1',
    historyTree: {
      '0': { id: '0', equation: parseEquation('x+1=3'), parentId: null, childrenIds: [], label: 'Initial', timestamp: 1 },
    },
    currentNodeId: '0',
    isCustomNamed: true,
    timestamp: 1,
  };
  store.set(rawTabsAtom, [tab]);
  store.set(rawActiveTabIdAtom, 'a');
  return store;
}

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

describe('Header Share Split-Button', () => {
  let writeText: ReturnType<typeof mockClipboard>;

  beforeEach(() => {
    writeText = mockClipboard();
    vi.clearAllMocks();
    mockCreateShareLink.mockResolvedValue({
      status: 'ok',
      url: 'https://algebranch.org/s/test1234#key5678',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders both primary copy button and caret dropdown launcher', async () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <Home />
      </Provider>
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const primaryBtn = screen.getByRole('button', { name: /share workspace/i });
    const caretBtn = screen.getByRole('button', { name: /more sharing options/i });

    expect(primaryBtn).toBeTruthy();
    expect(caretBtn).toBeTruthy();
  });

  it('clicking the caret button opens the Share modal', async () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <Home />
      </Provider>
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const caretBtn = screen.getByRole('button', { name: /more sharing options/i });
    await userEvent.click(caretBtn);

    expect(store.get(shareModalOpenAtom)).toBe(true);
  });

  it('clicking the primary share button copies the workspace short link and flashes copied', async () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <Home />
      </Provider>
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const primaryBtn = screen.getByRole('button', { name: /share workspace/i });
    await userEvent.click(primaryBtn);

    expect(mockCreateShareLink).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith('https://algebranch.org/s/test1234#key5678');
    expect(within(primaryBtn).getByText('Copied')).toBeTruthy();
  });

  it('shows loading state, disables button, and ignores duplicate clicks while creating link', async () => {
    let resolveSharePromise!: (val: { status: 'ok'; url: string }) => void;
    mockCreateShareLink.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSharePromise = resolve;
        })
    );

    const store = makeStore();
    render(
      <Provider store={store}>
        <Home />
      </Provider>
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const primaryBtn = screen.getByRole('button', { name: /share workspace/i });

    // Initial idle state
    expect(primaryBtn).not.toBeDisabled();
    expect(primaryBtn.getAttribute('aria-busy')).toBe('false');

    // Trigger click
    await userEvent.click(primaryBtn);

    // In flight loading state
    expect(mockCreateShareLink).toHaveBeenCalledTimes(1);
    expect(primaryBtn).toBeDisabled();
    expect(primaryBtn.getAttribute('aria-busy')).toBe('true');
    expect(within(primaryBtn).getByText(/creating/i)).toBeTruthy();

    // Attempt second click while disabled/busy
    await userEvent.click(primaryBtn);
    expect(mockCreateShareLink).toHaveBeenCalledTimes(1);

    // Resolve creation
    await act(async () => {
      resolveSharePromise({
        status: 'ok',
        url: 'https://algebranch.org/s/test1234#key5678',
      });
    });

    // Completed state
    expect(primaryBtn).not.toBeDisabled();
    expect(primaryBtn.getAttribute('aria-busy')).toBe('false');
    expect(within(primaryBtn).getByText('Copied')).toBeTruthy();
  });
});
