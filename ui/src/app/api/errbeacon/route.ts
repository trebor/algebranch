// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// POST /api/errbeacon — first-party client error beacon (#505 tranche B). Thin
// glue over the tested, framework-agnostic core in `errbeaconApi.ts`: parse the
// JSON body, hand it to `reportErrorBeacon` with a `console.error` sink (which
// lands in Vercel logs — the beacon stores nothing), and map the result onto a
// Response. The limiter is module-level, so its window spans requests handled by
// this server instance.

import type { NextRequest } from 'next/server';
import {
  reportErrorBeacon,
  createFixedWindowLimiter,
  ERRBEACON_MAX_PER_MINUTE,
} from '@/server/errbeacon/errbeaconApi';

const limiter = createFixedWindowLimiter(ERRBEACON_MAX_PER_MINUTE, 60_000);

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const result = reportErrorBeacon(body, (line) => console.error(line), limiter);
  if (result.status === 202) {
    return new Response(null, { status: 202 });
  }
  return Response.json(result.body, { status: result.status });
}
