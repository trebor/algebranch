// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { useEffect } from 'react';
import { markAppHydrated } from '../utils/hydrationSentinel';

/**
 * Cancels the root layout's CSS-delayed stall overlay on hydration (#501
 * follow-up). The overlay is rendered on every route to catch a CSP-blocked
 * bundle, but it must be stood down the instant JS confirms it is running.
 * Mounting this in the layout — rather than relying on the main app page — means
 * every route (/, /privacy, /link-format, …) hides it once React hydrates. The
 * main page also calls `markAppHydrated()` after its own init; this is the
 * idempotent, route-agnostic safety net.
 */
export function HydrationSentinel(): null {
  useEffect(() => {
    markAppHydrated();
  }, []);
  return null;
}
