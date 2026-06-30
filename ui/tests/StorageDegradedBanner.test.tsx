// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';

const isStoragePersistent = vi.fn();
vi.mock('@/utils/safeStorage', () => ({
  isStoragePersistent: () => isStoragePersistent(),
}));

import { StorageDegradedBanner } from '@/components/StorageDegradedBanner';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('StorageDegradedBanner', () => {
  it('stays hidden when storage works normally', () => {
    isStoragePersistent.mockReturnValue(true);
    render(<StorageDegradedBanner />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('appears when storage is blocked and explains the limitation', async () => {
    isStoragePersistent.mockReturnValue(false);
    render(<StorageDegradedBanner />);
    const banner = await screen.findByRole('dialog');
    // Names the cause and the concrete consequence, without nagging.
    expect(banner.textContent).toMatch(/extension/i);
    expect(banner.textContent).toMatch(/save|persist|history/i);
    expect(banner.textContent).not.toMatch(/disable/i);
  });

  it('can be dismissed', async () => {
    isStoragePersistent.mockReturnValue(false);
    render(<StorageDegradedBanner />);
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: /got it|dismiss/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('dismisses on Escape', async () => {
    isStoragePersistent.mockReturnValue(false);
    render(<StorageDegradedBanner />);
    const banner = await screen.findByRole('dialog');
    banner.focus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    isStoragePersistent.mockReturnValue(false);
    const { container } = render(<StorageDegradedBanner />);
    await screen.findByRole('dialog');
    expect(await axe(container)).toHaveNoViolations();
  });
});
