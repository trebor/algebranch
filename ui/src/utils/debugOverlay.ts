// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * Gate for the inline global error-dump overlay injected by the root layout.
 *
 * The overlay surfaces uncaught JS errors as an on-screen dump, useful for
 * diagnosing blank mobile screens where there's no devtools. But it's a
 * debugging aid only, so it's suppressed in production by default — kept on in
 * development and behind an explicit opt-in (`NEXT_PUBLIC_DEBUG_OVERLAY=1`) for
 * production debugging.
 */
export function shouldRenderDebugOverlay(
  nodeEnv: string | undefined,
  optIn: string | undefined,
): boolean {
  if (nodeEnv !== 'production') return true;
  return optIn === '1';
}

/**
 * Build the inline debug-overlay script. It reports genuine uncaught JS errors
 * and unhandled promise rejections, but deliberately **ignores resource-load
 * failures** (a `<script>`/`<link>`/`<img>` that didn't load): under privacy
 * extensions and ad blockers, third-party resources like Google Tag Manager or
 * web fonts are blocked as a matter of course (#326). Those are non-fatal and
 * expected, so they must never paint a "resource failed" takeover over a working
 * app. The handler early-returns on any error carrying an element target,
 * before the overlay container is ever created.
 */
export function buildDebugOverlayScript(): string {
  return `
    function ensureContainer() {
      var c = document.getElementById('mobile-debug-container');
      if (!c) {
        c = document.createElement('div');
        c.id = 'mobile-debug-container';
        c.style.position = 'fixed';
        c.style.top = '0';
        c.style.left = '0';
        c.style.right = '0';
        c.style.bottom = '0';
        c.style.zIndex = '999999';
        c.style.backgroundColor = 'rgba(0,0,0,0.95)';
        c.style.color = '#ff6b6b';
        c.style.padding = '20px';
        c.style.fontFamily = 'monospace';
        c.style.overflow = 'auto';
        c.style.fontSize = '12px';
        c.style.whiteSpace = 'pre-wrap';
        document.body.appendChild(c);
      }
      var d = document.createElement('div');
      d.style.borderBottom = '1px solid #333';
      d.style.paddingBottom = '10px';
      d.style.marginBottom = '10px';
      c.appendChild(d);
      return d;
    }

    window.addEventListener('error', function(event) {
      // Ignore blocked/failed resource loads (scripts, fonts, images) — these
      // are expected under privacy extensions and are not app errors.
      if (event.target && event.target.tagName) return;
      var d = ensureContainer();
      d.innerText = 'ERROR: ' + event.message + '\\nSource: ' + event.filename + ':' + event.lineno + ':' + event.colno + '\\nStack: ' + (event.error ? event.error.stack : 'N/A');
    }, true);

    window.addEventListener('unhandledrejection', function(event) {
      var d = ensureContainer();
      d.innerText = 'UNHANDLED REJECTION: ' + event.reason + '\\nStack: ' + (event.reason && event.reason.stack ? event.reason.stack : 'N/A');
    });
  `;
}
