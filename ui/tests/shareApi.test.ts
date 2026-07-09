// @vitest-environment node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Route-core logic for the share create endpoint (#480), tested in isolation
// with an injected in-memory ShareStore so the Cloudflare adapter and Next's
// request plumbing stay out of the unit. The thin `POST /api/share` route file
// is just glue over `createShare`; every meaningful branch — validation, the
// 64 KB cap, and the store-if-absent collision signal — lives and is pinned here.
import { describe, it, expect } from 'vitest';
import { createShare, readShare, MAX_CIPHERTEXT_BYTES } from '@/server/share/shareApi';
import type { ShareStore } from '@/server/share/shareStore';

// 14 base62 chars — a well-shaped id (matches SHARE_ID_PATTERN).
const VALID_ID = 'a1B2c3D4e5F6g7';
const CIPHERTEXT = 'ZmFrZS1jaXBoZXJ0ZXh0';

function fakeStore(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  let putCalls = 0;
  const store: ShareStore = {
    async put(id, ciphertext) {
      putCalls++;
      if (data.has(id)) return false;
      data.set(id, ciphertext);
      return true;
    },
    async get(id) {
      return data.has(id) ? data.get(id)! : null;
    },
  };
  return { store, data, putCalls: () => putCalls };
}

describe('createShare', () => {
  it('stores a well-formed request and echoes the id (200)', async () => {
    const { store, data } = fakeStore();
    const result = await createShare({ id: VALID_ID, ciphertext: CIPHERTEXT }, store);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ id: VALID_ID });
    expect(data.get(VALID_ID)).toBe(CIPHERTEXT);
  });

  it('signals a collision without overwriting the live link (409)', async () => {
    const { store, data } = fakeStore({ [VALID_ID]: 'existing-ciphertext' });
    const result = await createShare({ id: VALID_ID, ciphertext: CIPHERTEXT }, store);
    expect(result.status).toBe(409);
    expect(data.get(VALID_ID)).toBe('existing-ciphertext'); // untouched
  });

  it('rejects a wrong-shape id before touching the store (400)', async () => {
    const { store, putCalls } = fakeStore();
    for (const badId of ['tooshort', 'a1B2c3D4e5F6g7X' /* 15 */, 'a1B2c3-4e5F6g7' /* dash */]) {
      const result = await createShare({ id: badId, ciphertext: CIPHERTEXT }, store);
      expect(result.status).toBe(400);
    }
    expect(putCalls()).toBe(0);
  });

  it('rejects a missing / non-string / empty ciphertext (400)', async () => {
    const { store, putCalls } = fakeStore();
    for (const body of [
      { id: VALID_ID },
      { id: VALID_ID, ciphertext: 123 },
      { id: VALID_ID, ciphertext: '' },
    ]) {
      const result = await createShare(body, store);
      expect(result.status).toBe(400);
    }
    expect(putCalls()).toBe(0);
  });

  it('rejects a non-object body (400)', async () => {
    const { store } = fakeStore();
    for (const body of [null, undefined, 'a string', 42, [VALID_ID, CIPHERTEXT]]) {
      expect((await createShare(body, store)).status).toBe(400);
    }
  });

  it('rejects a ciphertext over the 64 KB cap before touching the store (413)', async () => {
    const { store, putCalls } = fakeStore();
    const tooBig = 'a'.repeat(MAX_CIPHERTEXT_BYTES + 1);
    const result = await createShare({ id: VALID_ID, ciphertext: tooBig }, store);
    expect(result.status).toBe(413);
    expect(putCalls()).toBe(0);
  });

  it('accepts a ciphertext exactly at the cap (200)', async () => {
    const { store } = fakeStore();
    const atCap = 'a'.repeat(MAX_CIPHERTEXT_BYTES);
    const result = await createShare({ id: VALID_ID, ciphertext: atCap }, store);
    expect(result.status).toBe(200);
  });
});

describe('readShare', () => {
  it('returns the stored ciphertext for a known id (200)', async () => {
    const { store } = fakeStore({ [VALID_ID]: CIPHERTEXT });
    const result = await readShare(VALID_ID, store);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ciphertext: CIPHERTEXT });
  });

  it('returns 404 for an unknown but well-shaped id', async () => {
    const { store } = fakeStore();
    const result = await readShare(VALID_ID, store);
    expect(result.status).toBe(404);
  });

  it('rejects a wrong-shape id before touching the store (400)', async () => {
    const { store, data } = fakeStore();
    // A store spy: a `get` on a bad id would be a bug, so track calls.
    let getCalls = 0;
    const spied: ShareStore = {
      put: store.put,
      async get(id) {
        getCalls++;
        return data.has(id) ? data.get(id)! : null;
      },
    };
    for (const badId of ['tooshort', 'a1B2c3D4e5F6g7X' /* 15 */, 'a1B2c3-4e5F6g7' /* dash */, '']) {
      const result = await readShare(badId, spied);
      expect(result.status).toBe(400);
    }
    expect(getCalls).toBe(0);
  });
});
