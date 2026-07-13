// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Framework-agnostic core for the error beacon endpoint (#505 tranche B). The
// Next route file (`app/api/errbeacon/route.ts`) is thin glue that parses the
// body, calls in here with a concrete sink and limiter, and maps the returned
// `{ status }` onto a `Response`. The endpoint deliberately *stores nothing*: an
// accepted beacon becomes exactly one sink call (in production, `console.error`
// into Vercel logs) — no new storage, no retention decisions.
//
// Privacy: the client scrubs URLs before sending, but this endpoint is open, so
// the same scrub runs again here — the "equation content never lands in our
// logs" guarantee must hold for hand-crafted POSTs too, not just our client.

import { scrubUrlText, MAX_SIGNATURE_FIELD_CHARS } from '@/utils/errorBeacon';

/**
 * Per-instance accept cap per minute. A launch-day incident is diagnosable from
 * a handful of identical lines; past this rate more lines add noise and log
 * volume, not signal. Client-side caps make honest traffic stay far below this —
 * the limiter mainly bounds abuse and error storms.
 */
export const ERRBEACON_MAX_PER_MINUTE = 20;

export interface RateLimiter {
  /** Record one attempt: `true` to proceed, `false` when the window is spent. */
  tryAccept(): boolean;
}

/**
 * Fixed-window counter — per server instance, in memory. Serverless instances
 * each get their own window, so the effective global cap scales with (bounded)
 * instance count; that coarseness is fine for a log-volume guard. `now` is
 * injectable for tests.
 */
export function createFixedWindowLimiter(
  limit: number,
  windowMs: number,
  now: () => number = Date.now,
): RateLimiter {
  let windowStart = now();
  let count = 0;
  return {
    tryAccept() {
      const t = now();
      if (t - windowStart >= windowMs) {
        windowStart = t;
        count = 0;
      }
      if (count >= limit) return false;
      count++;
      return true;
    },
  };
}

/** Result of a beacon post — the route wrapper maps it onto a `Response`. */
export type ErrbeaconResult =
  | { status: 202 }
  | { status: 400 | 429; body: { error: string } };

function optionalField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Validate, re-scrub, truncate, and sink one error signature. Flow: shape-check →
 * rate limit → sink. Validation runs first so junk never spends the limit; the
 * limiter runs before the sink so a drained window costs no log line. Only
 * `message` is required — a beacon with less context still beats silence.
 */
export function reportErrorBeacon(
  input: unknown,
  sink: (line: string) => void,
  limiter: RateLimiter,
): ErrbeaconResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { status: 400, body: { error: 'Expected a JSON object body.' } };
  }
  const { message, topFrame, version, uaFamily } = input as Record<string, unknown>;
  if (typeof message !== 'string' || message.length === 0) {
    return { status: 400, body: { error: 'Missing message.' } };
  }

  if (!limiter.tryAccept()) {
    return { status: 429, body: { error: 'Too many error reports.' } };
  }

  const clean = (value: string) =>
    scrubUrlText(value).slice(0, MAX_SIGNATURE_FIELD_CHARS);
  sink(
    `errbeacon ${JSON.stringify({
      message: clean(message),
      topFrame: clean(optionalField(topFrame)),
      version: optionalField(version).slice(0, 40),
      uaFamily: optionalField(uaFamily).slice(0, 40),
    })}`,
  );
  return { status: 202 };
}
