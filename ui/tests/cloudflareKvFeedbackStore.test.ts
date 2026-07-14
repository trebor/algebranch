// @vitest-environment node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The Cloudflare KV feedback-store adapter (#519): reports live under an `fb:`
// key prefix in the *same* namespace as short links. `put` is a plain write (ids
// are unique and time-ordered, so no store-if-absent dance), and `list` scans the
// prefix and returns the most recent entries newest-first for the admin read.
import { describe, it, expect, vi } from 'vitest';
import { CloudflareKvFeedbackStore, FEEDBACK_KEY_PREFIX } from '@/server/feedback/cloudflareKvFeedbackStore';

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

const CONFIG = { accountId: 'a', namespaceId: 'n', apiToken: 't' } as const;
const BASE = 'https://api.cloudflare.com/client/v4/accounts/a/storage/kv/namespaces/n';

describe('CloudflareKvFeedbackStore.put', () => {
  it('writes the JSON verbatim under the given id', async () => {
    const { impl, calls } = scriptedFetch([new Response('{"success":true}', { status: 200 })]);
    const store = new CloudflareKvFeedbackStore({ ...CONFIG, fetchImpl: impl });
    await store.put('fb:000000000001000-abcd', '{"subject":"hi"}');
    expect(calls[0].url).toBe(`${BASE}/values/${encodeURIComponent('fb:000000000001000-abcd')}`);
    expect(calls[0].init?.method).toBe('PUT');
    expect(calls[0].init?.body).toBe('{"subject":"hi"}');
  });

  it('throws on a write failure', async () => {
    const { impl } = scriptedFetch([new Response('boom', { status: 500 })]);
    const store = new CloudflareKvFeedbackStore({ ...CONFIG, fetchImpl: impl });
    await expect(store.put('fb:x', '{}')).rejects.toThrow(/500/);
  });
});

describe('CloudflareKvFeedbackStore.list', () => {
  it('scans the fb: prefix and returns entries newest-first, capped to the limit', async () => {
    // KV returns key names ascending (chronological, since ids are zero-padded).
    const listBody = JSON.stringify({
      success: true,
      result: [{ name: 'fb:001-a' }, { name: 'fb:002-b' }, { name: 'fb:003-c' }],
    });
    const { impl, calls } = scriptedFetch([
      new Response(listBody, { status: 200 }), // keys list
      new Response('{"subject":"newest"}', { status: 200 }), // fb:003-c value
      new Response('{"subject":"middle"}', { status: 200 }), // fb:002-b value
    ]);
    const store = new CloudflareKvFeedbackStore({ ...CONFIG, fetchImpl: impl });

    const entries = await store.list(2);
    expect(calls[0].url).toContain(`${BASE}/keys?`);
    expect(calls[0].url).toContain(`prefix=${encodeURIComponent(FEEDBACK_KEY_PREFIX)}`);
    expect(entries).toEqual([
      { id: 'fb:003-c', json: '{"subject":"newest"}' },
      { id: 'fb:002-b', json: '{"subject":"middle"}' },
    ]);
  });

  it('drops keys whose value vanished between list and read', async () => {
    const listBody = JSON.stringify({ success: true, result: [{ name: 'fb:001-a' }] });
    const { impl } = scriptedFetch([
      new Response(listBody, { status: 200 }),
      new Response('not found', { status: 404 }),
    ]);
    const store = new CloudflareKvFeedbackStore({ ...CONFIG, fetchImpl: impl });
    expect(await store.list(10)).toEqual([]);
  });

  it('returns empty when there is no feedback yet', async () => {
    const { impl } = scriptedFetch([
      new Response(JSON.stringify({ success: true, result: [] }), { status: 200 }),
    ]);
    const store = new CloudflareKvFeedbackStore({ ...CONFIG, fetchImpl: impl });
    expect(await store.list(10)).toEqual([]);
  });
});
