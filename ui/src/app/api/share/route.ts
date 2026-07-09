// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// POST /api/share — create a short link (#480). Thin glue over the tested,
// framework-agnostic core in `shareApi.ts`: parse the JSON body, hand it to
// `createShare` with the Cloudflare KV store, and map the result onto a Response.
// Same-origin only by design — the browser calls this route, which then talks to
// Cloudflare server-to-server, so the KV token never reaches the client and there
// is no CORS surface (the #480 zero-knowledge guardrail).

import type { NextRequest } from 'next/server';
import { cloudflareKvStoreFromEnv } from '@/server/share/cloudflareKvStore';
import { createShare } from '@/server/share/shareApi';

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  try {
    const store = cloudflareKvStoreFromEnv();
    const result = await createShare(body, store);
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    // Misconfigured env or a KV transport failure — log server-side, stay opaque
    // to the client so we never leak store internals.
    console.error('POST /api/share failed:', err);
    return Response.json({ error: 'Share store unavailable.' }, { status: 500 });
  }
}
