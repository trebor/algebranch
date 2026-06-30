// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Hydration stall fallback (#326 follow-up). The root layout renders a hidden,
 * full-screen help overlay (`#app-stall-overlay`) whose *reveal* is driven by a
 * pure-CSS delayed animation (see `.app-stall-overlay` in globals.css). The
 * reveal must be CSS, not JS: when a privacy extension injects a CSP that blocks
 * the script bundle, no JS runs at all — not even an inline watchdog — yet the
 * stylesheet still loads, so CSS is the only thing that can surface a message.
 *
 * JavaScript's only job here is the reverse: once React successfully hydrates it
 * calls `markAppHydrated()` to hide the overlay, so a healthy load never shows
 * it (and a slow-but-fine load that briefly tripped the CSS reveal is hidden
 * again). If JS is blocked, this never runs — which is exactly when we *want*
 * the overlay to stay.
 */

/** Id of the pre-rendered stall overlay in the root layout. */
export const STALL_OVERLAY_ID = 'app-stall-overlay';

/**
 * Cancel the CSS stall reveal now that the app is up. Sets the `hidden`
 * attribute, which the UA renders as `display: none` — and since
 * `.app-stall-overlay` deliberately never sets `display`, that UA rule wins.
 */
export function markAppHydrated(): void {
  try {
    document.getElementById(STALL_OVERLAY_ID)?.setAttribute('hidden', '');
  } catch {
    // SSR or a locked-down DOM — nothing to do.
  }
}
