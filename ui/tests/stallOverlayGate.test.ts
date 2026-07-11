// @vitest-environment node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The stall overlay is a PRODUCTION safety net — it catches a CSP/extension
// blocking the deployed bundle so the app never hydrates. In dev, Next compiles
// each route on first visit, making hydration artificially slow and tripping the
// 6s CSS reveal as a false positive (worst on heavier client routes like
// /privacy). So gate it to production, with an explicit dev opt-in for previewing
// it — the inverse of the debug overlay's gate.
import { describe, it, expect } from 'vitest';
import { shouldRenderStallOverlay } from '@/utils/hydrationSentinel';

describe('shouldRenderStallOverlay (#501)', () => {
  it('renders in production regardless of the opt-in', () => {
    expect(shouldRenderStallOverlay('production', undefined)).toBe(true);
    expect(shouldRenderStallOverlay('production', '1')).toBe(true);
  });

  it('is suppressed in development by default (kills the dev false-positive flash)', () => {
    expect(shouldRenderStallOverlay('development', undefined)).toBe(false);
    expect(shouldRenderStallOverlay('test', undefined)).toBe(false);
    expect(shouldRenderStallOverlay(undefined, undefined)).toBe(false);
  });

  it('allows an explicit dev opt-in to preview it', () => {
    expect(shouldRenderStallOverlay('development', '1')).toBe(true);
  });
});
