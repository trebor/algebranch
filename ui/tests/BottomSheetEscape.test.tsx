// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { BottomSheet } from '@/components/BottomSheet';

/**
 * Escape closes the sheet — the standard modal affordance (#325). Inert on touch
 * devices (no Esc key), welcome on desktop/tablet with a keyboard. Escape is
 * otherwise free here: the only global handler merely cancels a pending leader.
 */
describe('BottomSheet — Escape to close (#325)', () => {
  afterEach(cleanup);

  it('calls onClose when Escape fires from within the sheet', async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet isOpen onClose={onClose} title="History">
        <p>content</p>
      </BottomSheet>,
    );
    await screen.findByText('content');
    fireEvent.keyDown(screen.getByText('content'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape fires from the document body', async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet isOpen onClose={onClose} title="History">
        <p>content</p>
      </BottomSheet>,
    );
    await screen.findByText('content');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does nothing on Escape when the sheet is closed', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet isOpen={false} onClose={onClose} title="History">
        <p>content</p>
      </BottomSheet>,
    );
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
