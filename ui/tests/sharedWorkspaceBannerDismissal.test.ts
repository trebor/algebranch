// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SHARED_WORKSPACE_BANNER_DISMISSED_KEY,
  isSharedWorkspaceBannerDismissed,
  markSharedWorkspaceBannerDismissed,
} from '@/store/sharedWorkspaceBanner';

describe('shared workspace banner dismissal persistence (#263)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reports not-dismissed on a fresh device', () => {
    expect(isSharedWorkspaceBannerDismissed()).toBe(false);
  });

  it('persists the dismissal so later share links stay quiet', () => {
    markSharedWorkspaceBannerDismissed();
    expect(localStorage.getItem(SHARED_WORKSPACE_BANNER_DISMISSED_KEY)).toBe('true');
    expect(isSharedWorkspaceBannerDismissed()).toBe(true);
  });
});
