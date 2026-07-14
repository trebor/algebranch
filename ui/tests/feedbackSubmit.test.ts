// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Client half of the first-party feedback submit (#519): POST the report to
// `/api/feedback` and classify the outcome for the modal. Mirrors the share-link
// client (`createShareLink`) — an injected fetch keeps it pure and testable.
import { describe, it, expect, vi } from 'vitest';
import { submitFeedback } from '@/utils/feedbackSubmit';
import type { FeedbackPayload } from '@/utils/feedbackUrl';

const PAYLOAD: FeedbackPayload = {
  type: 'bug',
  subject: 'Sqrt handle',
  message: 'no effect',
  rating: 4,
  context: 'sqrt(4)=x',
  steps: '1. sqrt(4)=x',
  shareLink: 'https://algebranch.org/?eq=abc',
  device: 'Desktop',
  browser: 'Firefox',
  os: 'macOS',
  userAgent: 'Mozilla/5.0',
};

function scriptedPost(response: { ok: boolean; status: number; body?: unknown } | Error) {
  const calls: { url: string; init: { method: string; headers: Record<string, string>; body: string } }[] = [];
  const impl = vi.fn(async (url: string, init: { method: string; headers: Record<string, string>; body: string }) => {
    calls.push({ url, init });
    if (response instanceof Error) throw response;
    return { ok: response.ok, status: response.status, json: async () => response.body };
  });
  return { impl, calls };
}

describe('submitFeedback', () => {
  it('POSTs the payload as JSON to /api/feedback and resolves ok on 200', async () => {
    const { impl, calls } = scriptedPost({ ok: true, status: 200, body: { id: 'fb:1' } });
    const result = await submitFeedback(PAYLOAD, impl);
    expect(result).toEqual({ ok: true });
    expect(calls[0].url).toBe('/api/feedback');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers['content-type']).toBe('application/json');
    expect(JSON.parse(calls[0].init.body)).toMatchObject({ type: 'bug', subject: 'Sqrt handle', shareLink: 'https://algebranch.org/?eq=abc' });
  });

  it('reports a rate-limited outcome with the daily limit on 429', async () => {
    const { impl } = scriptedPost({ ok: false, status: 429, body: { error: 'x', dailyLimit: 1000 } });
    const result = await submitFeedback(PAYLOAD, impl);
    expect(result).toEqual({ ok: false, rateLimited: true, dailyLimit: 1000 });
  });

  it('reports a plain failure on a 4xx/5xx that is not 429', async () => {
    for (const status of [400, 500]) {
      const { impl } = scriptedPost({ ok: false, status, body: { error: 'nope' } });
      const result = await submitFeedback(PAYLOAD, impl);
      expect(result).toEqual({ ok: false, rateLimited: false });
    }
  });

  it('reports a plain failure when the network throws', async () => {
    const { impl } = scriptedPost(new Error('offline'));
    const result = await submitFeedback(PAYLOAD, impl);
    expect(result).toEqual({ ok: false, rateLimited: false });
  });
});
