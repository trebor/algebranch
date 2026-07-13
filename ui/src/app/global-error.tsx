// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { ErrorFallback } from '../components/ErrorFallback';
import { reportBoundaryError } from '../utils/errorBeacon';

/**
 * Root-level error boundary. Replaces the root layout when an error escapes it
 * (e.g. a throw during hydration), so even a failure in the layout itself shows
 * the shared non-blank fallback rather than a white screen (#326). It must
 * provide its own <html>/<body> since it stands in for the root layout.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
    // Boundary-caught errors never reach the window 'error' listener, so the
    // beacon (#505) must be fed from here too.
    reportBoundaryError(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <title>Algebranch hit a snag</title>
        <ErrorFallback onRetry={() => unstable_retry()} />
      </body>
    </html>
  );
}
