// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import { useEffect } from 'react';
import { APP_VERSION } from '../constants/version';
import {
  createErrorReporter,
  initErrorBeacon,
  sendErrorSignature,
} from '../utils/errorBeacon';

/**
 * Mounts the first-party error beacon (#505 tranche B): listens for uncaught
 * errors and unhandled promise rejections, and posts a privacy-scrubbed
 * signature to `/api/errbeacon`. Renders nothing. All logic lives in
 * `utils/errorBeacon.ts`, where it is unit-tested; this component is only the
 * lifecycle glue.
 */
export function ErrorBeacon() {
  useEffect(
    () =>
      initErrorBeacon(
        window,
        createErrorReporter({
          send: sendErrorSignature,
          version: APP_VERSION,
          userAgent: navigator.userAgent,
        }),
      ),
    [],
  );
  return null;
}
