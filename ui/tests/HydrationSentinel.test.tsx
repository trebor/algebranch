// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Regression for the stall overlay leaking onto secondary routes (#501 follow-up).
// The root layout renders the CSS-delayed "couldn't finish loading" overlay on
// EVERY route, but only the main app page used to cancel it — so /privacy and
// /link-format revealed the overlay at 6s over correct content. HydrationSentinel
// lives in the layout and cancels it on mount, so any route that hydrates hides it.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { HydrationSentinel } from '@/components/HydrationSentinel';
import { STALL_OVERLAY_ID } from '@/utils/hydrationSentinel';

afterEach(() => {
  cleanup();
  document.getElementById(STALL_OVERLAY_ID)?.remove();
});

describe('HydrationSentinel (#501)', () => {
  it('cancels the CSS stall overlay once mounted', () => {
    const overlay = document.createElement('div');
    overlay.id = STALL_OVERLAY_ID;
    document.body.appendChild(overlay);

    expect(overlay.hasAttribute('hidden')).toBe(false);
    render(<HydrationSentinel />);
    expect(overlay.hasAttribute('hidden')).toBe(true);
  });

  it('renders nothing itself', () => {
    const { container } = render(<HydrationSentinel />);
    expect(container.childElementCount).toBe(0);
  });
});
