// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect } from 'vitest';
import { shouldRenderDebugOverlay, buildDebugOverlayScript } from '@/utils/debugOverlay';

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

describe('buildDebugOverlayScript', () => {
  const script = buildDebugOverlayScript();

  it('still reports genuine JS errors and unhandled rejections', () => {
    expect(script).toContain("addEventListener('error'");
    expect(script).toContain("addEventListener('unhandledrejection'");
  });

  it('never paints a takeover for a blocked resource (the gtag/font case)', () => {
    // A blocked third-party script/font is normal under privacy extensions and
    // must not produce a fullscreen "RESOURCE FAILED TO LOAD" dump.
    expect(script).not.toContain('RESOURCE FAILED TO LOAD');
  });

  it('bails out before building the overlay when the error is a resource load', () => {
    // Resource-load errors carry an element target with a tagName; the handler
    // must early-return on those, before the debug container is ever built.
    const onError = script.slice(
      script.indexOf("addEventListener('error'"),
      script.indexOf("addEventListener('unhandledrejection'"),
    );
    const guardIdx = onError.indexOf('event.target && event.target.tagName');
    const buildIdx = onError.indexOf('ensureContainer()');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(buildIdx).toBeGreaterThan(-1);
    // The target guard must come before the container is ever created.
    expect(guardIdx).toBeLessThan(buildIdx);
  });
});
