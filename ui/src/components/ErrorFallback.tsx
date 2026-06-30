// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';

/**
 * Last-resort, non-blank fallback rendered by the app's error boundaries
 * (`error.tsx` / `global-error.tsx`) when a render or hydration error escapes —
 * including the kind a privacy/blocking extension can cause by denying storage
 * or blocking a script (#326).
 *
 * Deliberately self-contained: it relies on **no** app chrome, store, web font,
 * or external stylesheet (all of which an extension may have blocked), styling
 * everything with inline styles in the brand colours from `globals.css`. The
 * goal is simply that the user never sees a white screen and always has a way
 * forward.
 */
export function ErrorFallback({ onRetry }: { onRetry: () => void }) {
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
        Algebranch hit a snag
      </h1>
      <p style={{ maxWidth: '34rem', margin: 0, opacity: 0.85 }}>
        Something stopped the app from loading correctly. A privacy or
        script-blocking browser extension can sometimes cause this by blocking
        storage or scripts the app needs. Try again — and if it keeps happening,
        allowing this site in your extension usually fixes it.
      </p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          marginTop: '0.5rem',
          padding: '0.6rem 1.25rem',
          fontSize: '1rem',
          fontWeight: 600,
          color: '#0a0a0a',
          background: '#ededed',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}
