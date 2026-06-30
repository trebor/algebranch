// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import React from 'react';

/**
 * Static, JS-free fallback notice shown when the app can't come up — either
 * because scripts are fully blocked (NoScript / strict privacy mode, surfaced
 * via <noscript>) or because hydration stalled (the inline watchdog reveals it).
 *
 * Deliberately dependency-free: a Server Component with inline styles in the
 * brand colours and an `<a href>` reload, so it renders and "works" even when no
 * JavaScript runs and even if an external stylesheet was blocked. The reload is
 * a plain link (not an onClick button) for exactly that reason.
 */
export function AppUnavailableNotice() {
  return (
    <div
      role="alert"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
        background: '#0a0a0a',
        color: '#ededed',
        fontFamily: 'Arial, Helvetica, sans-serif',
        lineHeight: 1.5,
      }}
    >
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>
        Algebranch couldn&apos;t finish loading
      </h1>
      <p style={{ maxWidth: '34rem', margin: 0, opacity: 0.85 }}>
        It looks like a browser extension or privacy setting is blocking the
        scripts Algebranch needs to run. Allowing scripts for this site — for
        example in NoScript, uBlock Origin, Privacy Badger, or your browser&apos;s
        tracking-protection settings — and reloading usually fixes it.
      </p>
      <a
        href="."
        style={{
          marginTop: '0.5rem',
          padding: '0.6rem 1.25rem',
          fontSize: '1rem',
          fontWeight: 600,
          color: '#0a0a0a',
          background: '#ededed',
          borderRadius: '0.5rem',
          textDecoration: 'none',
        }}
      >
        Reload the page
      </a>
    </div>
  );
}
