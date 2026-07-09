// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import { describe, it, expect, vi } from 'vitest';
import {
  CloudflareKvStore,
  cloudflareKvStoreFromEnv,
} from '@/server/share/cloudflareKvStore';

// Build a fetch stub that returns a queue of scripted Responses, and records
// every call so tests can assert URL / method / headers / body. Server-to-server
// only — the browser never touches Cloudflare (see #480 same-origin guardrail).
function scriptedFetch(responses: Response[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error('scriptedFetch: no response queued');
    return next;
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const CONFIG = {
  accountId: 'acct123',
  namespaceId: 'ns456',
  apiToken: 'secret-token',
} as const;

const BASE =
  'https://api.cloudflare.com/client/v4/accounts/acct123/storage/kv/namespaces/ns456';

describe('CloudflareKvStore.get', () => {
  it('returns the ciphertext body on a 200', async () => {
    const { impl, calls } = scriptedFetch([
      new Response('cipher-blob', { status: 200 }),
    ]);
    const store = new CloudflareKvStore({ ...CONFIG, fetchImpl: impl });

    expect(await store.get('abc')).toBe('cipher-blob');
    expect(calls[0].url).toBe(`${BASE}/values/abc`);
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer secret-token');
  });

  it('returns null when the key is missing (404)', async () => {
    const { impl } = scriptedFetch([new Response('not found', { status: 404 })]);
    const store = new CloudflareKvStore({ ...CONFIG, fetchImpl: impl });
    expect(await store.get('missing')).toBeNull();
  });

  it('throws on an unexpected non-ok status (e.g. 500)', async () => {
    const { impl } = scriptedFetch([new Response('boom', { status: 500 })]);
    const store = new CloudflareKvStore({ ...CONFIG, fetchImpl: impl });
    await expect(store.get('x')).rejects.toThrow(/500/);
  });
});

describe('CloudflareKvStore.put (store-if-absent)', () => {
  it('writes and returns true when the id is absent', async () => {
    const { impl, calls } = scriptedFetch([
      new Response('nope', { status: 404 }), // existence probe
      new Response(JSON.stringify({ success: true }), { status: 200 }), // write
    ]);
    const store = new CloudflareKvStore({ ...CONFIG, fetchImpl: impl });

    expect(await store.put('newid', 'cipher')).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toBe(`${BASE}/values/newid`);
    expect(calls[1].init?.method).toBe('PUT');
    expect(calls[1].init?.body).toBe('cipher');
  });

  it('returns false without writing when the id already exists (collision)', async () => {
    const { impl, calls } = scriptedFetch([
      new Response('existing-cipher', { status: 200 }), // existence probe hits
    ]);
    const store = new CloudflareKvStore({ ...CONFIG, fetchImpl: impl });

    expect(await store.put('taken', 'cipher')).toBe(false);
    expect(calls).toHaveLength(1); // no PUT issued — the existing link is preserved
  });

  it('throws when the write fails', async () => {
    const { impl } = scriptedFetch([
      new Response('nope', { status: 404 }),
      new Response('boom', { status: 500 }),
    ]);
    const store = new CloudflareKvStore({ ...CONFIG, fetchImpl: impl });
    await expect(store.put('id', 'cipher')).rejects.toThrow(/500/);
  });
});

describe('cloudflareKvStoreFromEnv', () => {
  it('constructs from a complete env', () => {
    const store = cloudflareKvStoreFromEnv({
      CLOUDFLARE_ACCOUNT_ID: 'a',
      CLOUDFLARE_KV_NAMESPACE_ID: 'n',
      CLOUDFLARE_KV_API_TOKEN: 't',
    });
    expect(store).toBeInstanceOf(CloudflareKvStore);
  });

  it('throws when any required var is missing', () => {
    expect(() =>
      cloudflareKvStoreFromEnv({
        CLOUDFLARE_ACCOUNT_ID: 'a',
        CLOUDFLARE_KV_NAMESPACE_ID: 'n',
        // token absent
      }),
    ).toThrow(/CLOUDFLARE_KV_API_TOKEN/);
  });
});
