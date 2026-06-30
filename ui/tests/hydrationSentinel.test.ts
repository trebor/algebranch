// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, beforeEach } from 'vitest';
import { STALL_OVERLAY_ID, markAppHydrated } from '@/utils/hydrationSentinel';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('markAppHydrated', () => {
  it('hides the CSS stall overlay so a successful load never shows it', () => {
    const overlay = document.createElement('div');
    overlay.id = STALL_OVERLAY_ID;
    document.body.appendChild(overlay);

    markAppHydrated();

    // `hidden` → UA `display: none`; .app-stall-overlay deliberately sets no
    // `display`, so the UA rule wins and the overlay is cancelled.
    expect(overlay.hasAttribute('hidden')).toBe(true);
  });

  it('is a no-op (no throw) when the overlay is absent', () => {
    expect(() => markAppHydrated()).not.toThrow();
  });
});
