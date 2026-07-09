// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// GET /api/share/[id] — read a short link's ciphertext (#480). Thin glue over the
// tested, framework-agnostic core in `shareApi.ts`: pull the id from the path, hand
// it to `readShare` with the Cloudflare KV store, and map the result onto a Response.
// The store is zero-knowledge — the response body is the opaque ciphertext, which
// the browser decrypts client-side with the fragment key the server never sees.

import type { NextRequest } from 'next/server';
import { cloudflareKvStoreFromEnv } from '@/server/share/cloudflareKvStore';
import { readShare } from '@/server/share/shareApi';

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<'/api/share/[id]'>,
): Promise<Response> {
  const { id } = await ctx.params;

  try {
    const store = cloudflareKvStoreFromEnv();
    const result = await readShare(id, store);
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    // Misconfigured env or a KV transport failure — log server-side, stay opaque
    // to the client so we never leak store internals.
    console.error('GET /api/share/[id] failed:', err);
    return Response.json({ error: 'Share store unavailable.' }, { status: 500 });
  }
}
