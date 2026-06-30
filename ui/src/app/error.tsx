// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { ErrorFallback } from '../components/ErrorFallback';

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
  }, [error]);

  return <ErrorFallback onRetry={() => unstable_retry()} />;
}
