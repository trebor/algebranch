// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

// The recipient landing for first-party zero-knowledge short links (#480):
// `algebranch.org/s#<key>`. A thin shell over `loadSharePayload` — it resolves the
// fragment key to the decrypted workspace payload entirely client-side (the key in
// `#…` never reaches the server), hands the payload to the main app via the
// sessionStorage handoff, and navigates to `/`, where the existing `?ws=` loader
// picks it up. On any failure it shows the recipient a plain message and a way back
// rather than a blank screen.

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { THEME_GLASS } from '../../constants/theme';
import { loadSharePayload, stashPendingShare } from '../../utils/shareLink';

type State = { phase: 'resolving' } | { phase: 'error'; message: string };

const MESSAGES: Record<'malformed' | 'not-found' | 'corrupt' | 'error', string> = {
  malformed: 'This share link is incomplete or mistyped — its key is not valid.',
  'not-found': "This shared workspace couldn't be found. The link may be mistyped or incomplete.",
  corrupt: "This shared workspace couldn't be decrypted — the link may be corrupted.",
  error: "Couldn't reach the share service. Check your connection and try again.",
};

export default function SharePage() {
  const router = useRouter();
  const [state, setState] = React.useState<State>({ phase: 'resolving' });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await loadSharePayload(window.location.hash);
      if (cancelled) return;
      if (result.status === 'ok') {
        // Hand the compressed payload to `/`'s loader out-of-band (not via the URL),
        // then replace history so Back doesn't return to this transient page.
        stashPendingShare(result.payload);
        router.replace('/');
        return;
      }
      setState({ phase: 'error', message: MESSAGES[result.status] });
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className={`${THEME_GLASS.PANEL} max-w-md w-full p-8 flex flex-col items-center gap-5 text-center`}>
        {state.phase === 'resolving' ? (
          <>
            <div
              className="w-8 h-8 rounded-full border-2 border-white/20 border-t-indigo-400 animate-spin"
              aria-hidden="true"
            />
            <p className={`text-sm ${THEME_GLASS.TEXT_BODY}`} role="status">
              Opening shared workspace…
            </p>
          </>
        ) : (
          <>
            <h1 className={`text-lg font-bold ${THEME_GLASS.TEXT_HEADING}`}>
              This link couldn&apos;t be opened
            </h1>
            <p className={`text-sm ${THEME_GLASS.TEXT_MUTED}`}>{state.message}</p>
            <Link
              href="/"
              className={`text-sm font-semibold ${THEME_GLASS.TEXT_ACCENT} no-underline`}
            >
              Go to Algebranch
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
