// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Client half of the first-party feedback submit (#519): POST an in-app report
// to `/api/feedback` — the path that needs no GitHub account, so the audiences
// the growth push targets (teachers, students, parents, #461) can actually reach
// us. Kept free of React so it can be unit-tested with an injected fetch, exactly
// like the share-link client (`createShareLink`).

import type { FeedbackPayload } from './feedbackUrl';

/** The minimal fetch surface this module needs — mirrors the share client. */
type PostFetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json?: () => Promise<unknown> }>;

/**
 * Outcome of an in-app submit.
 * - `{ ok: true }`  → stored; the modal shows its inline thank-you.
 * - `rateLimited`   → 429: the per-instance limiter or the daily write budget is
 *                     spent. `dailyLimit` is the cap the server named, when it did
 *                     (a per-deploy dial, so learned, never assumed). The modal
 *                     nudges the user to the GitHub route instead.
 * - otherwise       → a plain failure (bad status or network error); the modal
 *                     offers a retry / the GitHub route.
 */
export type SubmitFeedbackResult =
  | { ok: true }
  | { ok: false; rateLimited: boolean; dailyLimit?: number };

/** Pull the `dailyLimit` a 429 body names, or undefined on any malformed shape. */
async function readDailyLimit(res: { json?: () => Promise<unknown> }): Promise<number | undefined> {
  try {
    const body = await res.json?.();
    if (typeof body === 'object' && body !== null && 'dailyLimit' in body) {
      const limit = (body as { dailyLimit: unknown }).dailyLimit;
      if (typeof limit === 'number') return limit;
    }
  } catch {
    // Malformed/absent body — the outcome stands without a named limit.
  }
  return undefined;
}

export async function submitFeedback(
  payload: FeedbackPayload,
  fetchImpl: PostFetchLike = fetch,
): Promise<SubmitFeedbackResult> {
  try {
    const res = await fetchImpl('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    if (res.status === 429) {
      return { ok: false, rateLimited: true, dailyLimit: await readDailyLimit(res) };
    }
    return { ok: false, rateLimited: false };
  } catch {
    return { ok: false, rateLimited: false };
  }
}
