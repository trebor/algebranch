// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Framework-agnostic core for the share API (#480). The Next route files
// (`app/api/share/route.ts` and `app/api/share/[id]/route.ts`) are thin glue that
// parse the request, call in here with a concrete {@link ShareStore}, and map the
// returned `{ status, body }` onto a `Response`. Keeping the logic here — with the
// store injected — lets every branch be unit-tested without Next's request
// plumbing or a live Cloudflare namespace.
//
// The store is zero-knowledge, so the guards here are deliberately content-blind:
// we validate the id *shape* and cap the payload *size*, but never inspect or
// require any structure of the ciphertext beyond "a non-empty string".

import { SHARE_ID_PATTERN } from '@/utils/shareCrypto';
import type { ShareStore } from './shareStore';

/**
 * Hard cap on stored ciphertext, in bytes. Guards the bill (no TTL — links are
 * forever) and bounds a single KV value. 64 KB comfortably holds a compressed,
 * encrypted workspace far past the interop point where `?ws=` links break, which
 * is the whole reason short links exist.
 */
export const MAX_CIPHERTEXT_BYTES = 64 * 1024;

/** Result of a create request — the route wrapper maps it onto `Response.json`. */
export type CreateShareResult =
  | { status: 200; body: { id: string } }
  | { status: 400 | 409 | 413 | 500; body: { error: string } };

/** Result of a read request — 200 carries the opaque ciphertext, errors an `error`. */
export type ReadShareResult =
  | { status: 200; body: { ciphertext: string } }
  | { status: 400 | 404 | 500; body: { error: string } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate and persist a create request. The client derives `id` from its key and
 * encrypts locally, so the server only ever sees `{ id, ciphertext }` — never the
 * key. Flow: shape-check id → size-cap ciphertext → store-if-absent.
 *
 * A `409` is the collision signal: the id is already taken by a *different* key,
 * and overwriting would break that live link. The caller (client) must regenerate
 * its key — which yields a fresh id — and retry; the server never overwrites.
 */
export async function createShare(input: unknown, store: ShareStore): Promise<CreateShareResult> {
  if (!isRecord(input)) {
    return { status: 400, body: { error: 'Expected a JSON object body.' } };
  }

  const { id, ciphertext } = input;

  if (typeof id !== 'string' || !SHARE_ID_PATTERN.test(id)) {
    return { status: 400, body: { error: 'Malformed id.' } };
  }
  if (typeof ciphertext !== 'string' || ciphertext.length === 0) {
    return { status: 400, body: { error: 'Missing ciphertext.' } };
  }
  if (new TextEncoder().encode(ciphertext).length > MAX_CIPHERTEXT_BYTES) {
    return { status: 413, body: { error: 'Payload too large.' } };
  }

  const stored = await store.put(id, ciphertext);
  if (!stored) {
    return { status: 409, body: { error: 'Id already exists.' } };
  }
  return { status: 200, body: { id } };
}

/**
 * Fetch the ciphertext stored under `id`. Shape-check the id first — a malformed id
 * can never have been stored, so we reject it (400) without a pointless store hit —
 * then read: the ciphertext on a hit (200), or 404 on a miss. The store is
 * zero-knowledge, so we return the ciphertext verbatim and never inspect it.
 */
export async function readShare(id: string, store: ShareStore): Promise<ReadShareResult> {
  if (!SHARE_ID_PATTERN.test(id)) {
    return { status: 400, body: { error: 'Malformed id.' } };
  }
  const ciphertext = await store.get(id);
  if (ciphertext === null) {
    return { status: 404, body: { error: 'Not found.' } };
  }
  return { status: 200, body: { ciphertext } };
}
