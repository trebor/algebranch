// @vitest-environment node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// The Cloudflare KV write-budget adapter (#505): a TTL'd daily counter in the
// share namespace that bounds how many permanent share links can be minted per
// UTC day. KV is eventually consistent, so the counter is an approximate
// bill-bound, not a precise gate — these tests pin the read-increment-write
// shape, the UTC day key, the TTL that lets spent days expire, and the cap.
import { describe, it, expect, vi } from 'vitest';
import {
  CloudflareKvWriteBudget,
  cloudflareKvWriteBudgetFromEnv,
  DEFAULT_DAILY_WRITE_BUDGET,
} from '@/server/share/cloudflareKvWriteBudget';

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

// A fixed instant; the UTC date is 2026-07-13 regardless of the machine's zone.
const NOON_UTC = () => new Date('2026-07-13T12:00:00Z');

describe('CloudflareKvWriteBudget.consume', () => {
  it("starts a fresh day at 1: no counter yet (404) → writes '1' with a TTL, allows", async () => {
    const { impl, calls } = scriptedFetch([
      new Response('not found', { status: 404 }), // counter read
      new Response(JSON.stringify({ success: true }), { status: 200 }), // counter write
    ]);
    const budget = new CloudflareKvWriteBudget({ ...CONFIG, fetchImpl: impl, now: NOON_UTC });

    expect(await budget.consume()).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(`${BASE}/values/budget%3A2026-07-13`);
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer secret-token');
    // The write carries the incremented count and an expiration so spent
    // day-counters clean themselves up (~2 days).
    const writeUrl = new URL(calls[1].url);
    expect(writeUrl.pathname.endsWith('/values/budget%3A2026-07-13')).toBe(true);
    expect(writeUrl.searchParams.get('expiration_ttl')).toBe(String(2 * 24 * 60 * 60));
    expect(calls[1].init?.method).toBe('PUT');
    expect(calls[1].init?.body).toBe('1');
  });

  it('increments an existing counter below the cap', async () => {
    const { impl, calls } = scriptedFetch([
      new Response('41', { status: 200 }),
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    ]);
    const budget = new CloudflareKvWriteBudget({ ...CONFIG, fetchImpl: impl, now: NOON_UTC });

    expect(await budget.consume()).toBe(true);
    expect(calls[1].init?.body).toBe('42');
  });

  it('refuses at the cap without writing', async () => {
    const { impl, calls } = scriptedFetch([new Response('3', { status: 200 })]);
    const budget = new CloudflareKvWriteBudget({
      ...CONFIG,
      fetchImpl: impl,
      now: NOON_UTC,
      dailyCap: 3,
    });

    expect(await budget.consume()).toBe(false);
    expect(calls).toHaveLength(1); // read only — an exhausted day costs no write
  });

  it('keys the counter by UTC date, not the server-local date', async () => {
    const { impl, calls } = scriptedFetch([
      new Response('not found', { status: 404 }),
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    ]);
    // 00:30 UTC — still the previous day in any western-hemisphere local zone.
    const budget = new CloudflareKvWriteBudget({
      ...CONFIG,
      fetchImpl: impl,
      now: () => new Date('2026-01-02T00:30:00Z'),
    });

    await budget.consume();
    expect(calls[0].url).toBe(`${BASE}/values/budget%3A2026-01-02`);
  });

  it('treats an unparseable counter as zero (self-healing overwrite)', async () => {
    const { impl, calls } = scriptedFetch([
      new Response('garbage', { status: 200 }),
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    ]);
    const budget = new CloudflareKvWriteBudget({ ...CONFIG, fetchImpl: impl, now: NOON_UTC });

    expect(await budget.consume()).toBe(true);
    expect(calls[1].init?.body).toBe('1');
  });

  it('throws on an unexpected read failure', async () => {
    const { impl } = scriptedFetch([new Response('boom', { status: 500 })]);
    const budget = new CloudflareKvWriteBudget({ ...CONFIG, fetchImpl: impl, now: NOON_UTC });
    await expect(budget.consume()).rejects.toThrow(/500/);
  });

  it('throws on a write failure', async () => {
    const { impl } = scriptedFetch([
      new Response('not found', { status: 404 }),
      new Response('boom', { status: 500 }),
    ]);
    const budget = new CloudflareKvWriteBudget({ ...CONFIG, fetchImpl: impl, now: NOON_UTC });
    await expect(budget.consume()).rejects.toThrow(/500/);
  });
});

describe('cloudflareKvWriteBudgetFromEnv', () => {
  const ENV = {
    CLOUDFLARE_ACCOUNT_ID: 'a',
    CLOUDFLARE_KV_NAMESPACE_ID: 'n',
    CLOUDFLARE_KV_API_TOKEN: 't',
  };

  it('constructs with the default cap when the dial is unset', () => {
    const budget = cloudflareKvWriteBudgetFromEnv(ENV);
    expect(budget).toBeInstanceOf(CloudflareKvWriteBudget);
    expect(budget.dailyCap).toBe(DEFAULT_DAILY_WRITE_BUDGET);
  });

  it('reads the cap from SHARE_DAILY_WRITE_BUDGET (the launch-day dial)', () => {
    const budget = cloudflareKvWriteBudgetFromEnv({ ...ENV, SHARE_DAILY_WRITE_BUDGET: '250' });
    expect(budget.dailyCap).toBe(250);
  });

  it('rejects a malformed or non-positive dial loudly', () => {
    for (const bad of ['abc', '0', '-5', '1.5']) {
      expect(() =>
        cloudflareKvWriteBudgetFromEnv({ ...ENV, SHARE_DAILY_WRITE_BUDGET: bad }),
      ).toThrow(/SHARE_DAILY_WRITE_BUDGET/);
    }
  });

  it('throws when a Cloudflare credential is missing', () => {
    expect(() =>
      cloudflareKvWriteBudgetFromEnv({
        CLOUDFLARE_ACCOUNT_ID: 'a',
        CLOUDFLARE_KV_NAMESPACE_ID: 'n',
      }),
    ).toThrow(/CLOUDFLARE_KV_API_TOKEN/);
  });
});
