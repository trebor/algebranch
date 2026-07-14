// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// /api/feedback (#519). Thin glue over the tested, framework-agnostic core in
// `feedbackApi.ts`:
//   POST — create a report. Same-origin only by design: the browser calls this
//   route, which then talks to Cloudflare server-to-server, so the KV token
//   never reaches the client. No account required — this is the whole point,
//   the path for the audiences (teachers, students, parents) who don't have one.
//   GET  — the admin read, gated behind a bearer token (`FEEDBACK_ADMIN_TOKEN`).
//   With no token configured it fails closed (401), so a misconfigured deploy
//   exposes no feedback.

import type { NextRequest } from 'next/server';
import { cloudflareKvFeedbackStoreFromEnv } from '@/server/feedback/cloudflareKvFeedbackStore';
import { cloudflareKvFeedbackBudgetFromEnv } from '@/server/share/cloudflareKvWriteBudget';
import {
  reportFeedback,
  readFeedback,
  feedbackAdminAuthorized,
  createFixedWindowLimiter,
  FEEDBACK_MAX_PER_MINUTE,
} from '@/server/feedback/feedbackApi';

// Module-level limiter: its window spans requests handled by this server
// instance (the cheap in-memory shield in front of the KV write budget).
const limiter = createFixedWindowLimiter(FEEDBACK_MAX_PER_MINUTE, 60_000);

/** How many recent reports the admin read returns per request. */
const ADMIN_READ_LIMIT = 200;

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  try {
    const store = cloudflareKvFeedbackStoreFromEnv();
    const budget = cloudflareKvFeedbackBudgetFromEnv();
    const result = await reportFeedback(body, store, budget, limiter);
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    // Misconfigured env or a KV transport failure — log server-side, stay opaque
    // to the client so we never leak store internals.
    console.error('POST /api/feedback failed:', err);
    return Response.json({ error: 'Feedback store unavailable.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  if (!feedbackAdminAuthorized(request.headers.get('authorization'), process.env.FEEDBACK_ADMIN_TOKEN)) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const store = cloudflareKvFeedbackStoreFromEnv();
    const entries = await readFeedback(store, ADMIN_READ_LIMIT);
    return Response.json({ entries });
  } catch (err) {
    console.error('GET /api/feedback failed:', err);
    return Response.json({ error: 'Feedback store unavailable.' }, { status: 500 });
  }
}
