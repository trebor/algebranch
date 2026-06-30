// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { shouldRenderDebugOverlay } from '@/utils/debugOverlay';

describe('shouldRenderDebugOverlay', () => {
  it('renders in development so the error dump still aids local debugging', () => {
    expect(shouldRenderDebugOverlay('development', undefined)).toBe(true);
  });

  it('is suppressed in production so a blocked resource never paints a fullscreen error dump', () => {
    expect(shouldRenderDebugOverlay('production', undefined)).toBe(false);
  });

  it('can be explicitly opted back in within production for debugging', () => {
    expect(shouldRenderDebugOverlay('production', '1')).toBe(true);
  });

  it('ignores a non-"1" opt-in value in production', () => {
    expect(shouldRenderDebugOverlay('production', 'true')).toBe(false);
  });
});
