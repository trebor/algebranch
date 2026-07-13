// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { ErrorFallback } from '../components/ErrorFallback';
import { reportBoundaryError } from '../utils/errorBeacon';

/**
 * Segment-level error boundary for the app route. Catches render/hydration
 * errors below the root layout and shows the shared non-blank fallback instead
 * of a blank screen (#326).
 */
export default function Error({
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

  return <ErrorFallback onRetry={() => unstable_retry()} />;
}
