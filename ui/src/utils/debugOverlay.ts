// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Gate for the inline global error-dump overlay injected by the root layout.
 *
 * That overlay catches `window` errors and *resource-load failures* and paints
 * a fullscreen red stack dump over the whole app. It was useful for diagnosing
 * blank mobile screens, but in production it turns graceful degradation into a
 * scary broken screen: a privacy/blocking extension (NoScript, uBlock, Brave
 * Shields) that blocks a script or font triggers a "RESOURCE FAILED TO LOAD"
 * dump covering the app (#326). So suppress it in production by default, while
 * keeping it on in development and behind an explicit opt-in for production
 * debugging (`NEXT_PUBLIC_DEBUG_OVERLAY=1`).
 */
export function shouldRenderDebugOverlay(
  nodeEnv: string | undefined,
  optIn: string | undefined,
): boolean {
  if (nodeEnv !== 'production') return true;
  return optIn === '1';
}
