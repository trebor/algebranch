// @vitest-environment node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The recipient half of first-party short links (#480): resolve `/s#<key>` to the
// compressed workspace payload. `loadSharePayload` is the whole testable chain —
// fragment → key → derived id → GET /api/share/<id> → decrypt — with the network
// injected and real Web Crypto (node env). The `/s` page component is thin glue
// over it; every failure branch a recipient can hit is pinned here.
import { describe, it, expect } from 'vitest';
import {
  generateShareKey,
  keyToFragment,
  deriveShareId,
  encryptWorkspace,
} from '@/utils/shareCrypto';
import { loadSharePayload, createShareLink } from '@/utils/shareLink';

type FetchLike = Parameters<typeof loadSharePayload>[1];
type PostFetch = NonNullable<Parameters<typeof createShareLink>[2]>;

/** A fetch that serves `{ ciphertext }` for known ids and 404s the rest. */
function fakeFetch(store: Record<string, string>): NonNullable<FetchLike> {
  return async (url: string) => {
    const id = url.split('/').pop() ?? '';
    if (id in store) {
      return { ok: true, status: 200, json: async () => ({ ciphertext: store[id] }) };
    }
    return { ok: false, status: 404, json: async () => ({ error: 'Not found.' }) };
  };
}

describe('loadSharePayload', () => {
  it('round-trips a stored ciphertext back to the plaintext payload', async () => {
    const key = generateShareKey();
    const payload = 'COMPRESSED_WS_PAYLOAD_base64url';
    const id = await deriveShareId(key);
    const blob = await encryptWorkspace(payload, key);

    const result = await loadSharePayload('#' + keyToFragment(key), fakeFetch({ [id]: blob }));
    expect(result).toEqual({ status: 'ok', payload });
  });

  it('reports a malformed fragment that is not a valid key', async () => {
    const never = (() => {
      throw new Error('fetch should not be called for a malformed fragment');
    }) as unknown as NonNullable<FetchLike>;
    for (const hash of ['', '#', '#not-a-valid-key', '#!!!']) {
      expect(await loadSharePayload(hash, never)).toEqual({ status: 'malformed' });
    }
  });

  it('reports not-found when the id is absent from the store (404)', async () => {
    const key = generateShareKey();
    const result = await loadSharePayload('#' + keyToFragment(key), fakeFetch({}));
    expect(result).toEqual({ status: 'not-found' });
  });

  it('reports corrupt when the ciphertext decrypts under a different key', async () => {
    // id is derived from `key`, but the stored ciphertext was sealed with `other`,
    // so GCM auth fails → the link fetched fine but cannot be read.
    const key = generateShareKey();
    const other = generateShareKey();
    const id = await deriveShareId(key);
    const blob = await encryptWorkspace('someone elses work', other);

    const result = await loadSharePayload('#' + keyToFragment(key), fakeFetch({ [id]: blob }));
    expect(result).toEqual({ status: 'corrupt' });
  });

  it('reports an error when the network throws', async () => {
    const key = generateShareKey();
    const throwing: NonNullable<FetchLike> = async () => {
      throw new Error('network down');
    };
    expect(await loadSharePayload('#' + keyToFragment(key), throwing)).toEqual({ status: 'error' });
  });

  it('reports an error on a non-404 failure status (e.g. 500)', async () => {
    const key = generateShareKey();
    const failing: NonNullable<FetchLike> = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Share store unavailable.' }),
    });
    expect(await loadSharePayload('#' + keyToFragment(key), failing)).toEqual({ status: 'error' });
  });
});

describe('createShareLink', () => {
  /** A POST fake that stores ciphertext by id and 409s a duplicate id (store-if-absent). */
  function storingPost(store: Record<string, string>): PostFetch {
    return async (_url, init) => {
      const { id, ciphertext } = JSON.parse(init.body) as { id: string; ciphertext: string };
      if (id in store) return { ok: false, status: 409 };
      store[id] = ciphertext;
      return { ok: true, status: 200 };
    };
  }

  it('creates a link that opens back to the original payload (full round-trip)', async () => {
    const store: Record<string, string> = {};
    const payload = 'COMPRESSED_WS_PAYLOAD_base64url';

    const created = await createShareLink(payload, 'https://algebranch.org', storingPost(store));
    expect(created.status).toBe('ok');
    if (created.status !== 'ok') return;

    // The link is /s with the key in the fragment — no id, no payload in the URL.
    const url = new URL(created.url);
    expect(url.origin).toBe('https://algebranch.org');
    expect(url.pathname).toBe('/s');
    expect(url.hash.length).toBeGreaterThan(1);

    // Feed the produced fragment to the recipient half → original payload back.
    const opened = await loadSharePayload(url.hash, fakeFetch(store));
    expect(opened).toEqual({ status: 'ok', payload });
  });

  it('regenerates the key and retries on a 409 collision until it stores', async () => {
    const seenIds: string[] = [];
    let calls = 0;
    const post: PostFetch = async (_url, init) => {
      const { id } = JSON.parse(init.body) as { id: string };
      seenIds.push(id);
      calls += 1;
      return calls < 3 ? { ok: false, status: 409 } : { ok: true, status: 200 };
    };

    const created = await createShareLink('payload', 'https://algebranch.org', post);
    expect(created.status).toBe('ok');
    expect(calls).toBe(3);
    // Each retry used a fresh random key, so every attempted id differs.
    expect(new Set(seenIds).size).toBe(3);
  });

  it('reports too-large when the server rejects an oversized ciphertext (413)', async () => {
    const post: PostFetch = async () => ({ ok: false, status: 413 });
    expect(await createShareLink('payload', 'https://algebranch.org', post)).toEqual({
      status: 'too-large',
    });
  });

  it('reports busy — without retrying — when the write budget is exhausted (429)', async () => {
    let calls = 0;
    const post: PostFetch = async () => {
      calls += 1;
      return { ok: false, status: 429 };
    };
    expect(await createShareLink('payload', 'https://algebranch.org', post)).toEqual({
      status: 'busy',
    });
    // A drained budget is not a collision: retrying would only hammer the server.
    expect(calls).toBe(1);
  });

  it('surfaces the daily limit the 429 body names, so the UI can show a real number', async () => {
    const post: PostFetch = async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Daily share limit reached.', dailyLimit: 5000 }),
    });
    expect(await createShareLink('payload', 'https://algebranch.org', post)).toEqual({
      status: 'busy',
      dailyLimit: 5000,
    });
  });

  it('stays busy without a number when the 429 body is missing or malformed', async () => {
    for (const json of [
      undefined, // no body reader at all
      async () => ({ error: 'nope' }), // no dailyLimit field
      async () => ({ dailyLimit: 'lots' }), // wrong type
      async () => {
        throw new Error('not json');
      },
    ]) {
      const post: PostFetch = async () => ({ ok: false, status: 429, json });
      expect(await createShareLink('payload', 'https://algebranch.org', post)).toEqual({
        status: 'busy',
      });
    }
  });

  it('reports an error when the network throws', async () => {
    const post: PostFetch = async () => {
      throw new Error('network down');
    };
    expect(await createShareLink('payload', 'https://algebranch.org', post)).toEqual({
      status: 'error',
    });
  });

  it('reports an error on an unexpected failure status (e.g. 500)', async () => {
    const post: PostFetch = async () => ({ ok: false, status: 500 });
    expect(await createShareLink('payload', 'https://algebranch.org', post)).toEqual({
      status: 'error',
    });
  });

  it('reports an error when retries are exhausted by relentless collisions', async () => {
    const post: PostFetch = async () => ({ ok: false, status: 409 });
    expect(await createShareLink('payload', 'https://algebranch.org', post)).toEqual({
      status: 'error',
    });
  });
});
