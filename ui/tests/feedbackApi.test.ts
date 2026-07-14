// @vitest-environment node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Route-core logic for the first-party feedback endpoint (#519), tested in
// isolation with an injected store, write budget, and rate limiter. The thin
// `POST /api/feedback` route file is glue over `reportFeedback`; the branches
// that matter — shape validation, field caps, the per-instance rate limit, the
// global daily write budget, id generation, and the authenticated admin read —
// live and are pinned here. Unlike the error beacon, feedback content is what
// the user deliberately sent us, so it is *kept* (not scrubbed) and lands behind
// an authenticated read, never in public logs.
import { describe, it, expect, vi } from 'vitest';
import {
  reportFeedback,
  readFeedback,
  feedbackAdminAuthorized,
  FEEDBACK_MAX_PER_MINUTE,
  FEEDBACK_FIELD_CAPS,
} from '@/server/feedback/feedbackApi';
import type { FeedbackStore, StoredFeedbackEntry } from '@/server/feedback/feedbackStore';
import { createFixedWindowLimiter } from '@/server/errbeacon/errbeaconApi';
import type { WriteBudget } from '@/server/share/writeBudget';

const VALID_BODY = {
  type: 'bug',
  subject: 'Sqrt handle does nothing',
  message: 'Clicking simplify on the radical has no effect.',
  rating: 4,
  context: 'sqrt(4*9)+x=12',
  steps: '1. (start) sqrt(4*9)+x=12',
  shareLink: 'https://algebranch.org/?eq=abc',
  device: 'Desktop',
  browser: 'Firefox',
  os: 'macOS',
  userAgent: 'Mozilla/5.0',
};

// An in-memory FeedbackStore for the core tests — records every put and can
// replay them for the admin read path.
function fakeStore(): FeedbackStore & { entries: StoredFeedbackEntry[] } {
  const entries: StoredFeedbackEntry[] = [];
  return {
    entries,
    async put(id, json) {
      entries.unshift({ id, json }); // newest first, as the real adapter lists
    },
    async list(limit) {
      return entries.slice(0, limit);
    },
  };
}

const openLimiter = () => createFixedWindowLimiter(1000, 60_000, () => 0);
const openBudget = (): WriteBudget => ({ dailyCap: 5000, consume: async () => true });
const spentBudget = (): WriteBudget => ({ dailyCap: 5000, consume: async () => false });
const fixedOpts = { now: () => 1_000_000, suffix: () => 'abcd' };

describe('reportFeedback', () => {
  it('accepts a well-formed report (200), stores exactly one entry with the fields intact', async () => {
    const store = fakeStore();
    const result = await reportFeedback(VALID_BODY, store, openBudget(), openLimiter(), fixedOpts);
    expect(result.status).toBe(200);
    expect(store.entries).toHaveLength(1);
    const record = JSON.parse(store.entries[0].json);
    expect(record.type).toBe('bug');
    expect(record.subject).toBe('Sqrt handle does nothing');
    expect(record.message).toContain('no effect');
    expect(record.shareLink).toBe('https://algebranch.org/?eq=abc');
    expect(record.rating).toBe(4);
    expect(typeof record.receivedAt).toBe('string');
  });

  it('accepts a feature report and a report with no rating / no optional context', async () => {
    const store = fakeStore();
    const r1 = await reportFeedback({ type: 'feature', subject: 's', message: 'm' }, store, openBudget(), openLimiter());
    expect(r1.status).toBe(200);
    const record = JSON.parse(store.entries[0].json);
    expect(record.type).toBe('feature');
    expect(record.rating).toBe(0);
    expect(record.shareLink).toBe('');
  });

  it('rejects a non-object body (400) without storing or spending the budget', async () => {
    const store = fakeStore();
    const budget = openBudget();
    const spy = vi.spyOn(budget, 'consume');
    for (const body of [null, undefined, 'x', 42, ['x']]) {
      expect((await reportFeedback(body, store, budget, openLimiter())).status).toBe(400);
    }
    expect(store.entries).toHaveLength(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects a bad or missing type (400)', async () => {
    const store = fakeStore();
    for (const type of [undefined, 'spam', '', 42]) {
      const r = await reportFeedback({ ...VALID_BODY, type }, store, openBudget(), openLimiter());
      expect(r.status).toBe(400);
    }
    expect(store.entries).toHaveLength(0);
  });

  it('rejects a missing / blank subject or message (400)', async () => {
    const store = fakeStore();
    for (const bad of [{ subject: '' }, { subject: '   ' }, { message: '' }, { message: '  ' }, { subject: 42 }]) {
      const r = await reportFeedback({ ...VALID_BODY, ...bad }, store, openBudget(), openLimiter());
      expect(r.status).toBe(400);
    }
    expect(store.entries).toHaveLength(0);
  });

  it('caps over-long fields so one report cannot bloat the store', async () => {
    const store = fakeStore();
    await reportFeedback(
      { ...VALID_BODY, message: 'x'.repeat(FEEDBACK_FIELD_CAPS.message * 4), steps: 'y'.repeat(FEEDBACK_FIELD_CAPS.steps * 4) },
      store, openBudget(), openLimiter(),
    );
    const record = JSON.parse(store.entries[0].json);
    expect(record.message.length).toBe(FEEDBACK_FIELD_CAPS.message);
    expect(record.steps.length).toBe(FEEDBACK_FIELD_CAPS.steps);
  });

  it('preserves a full-workspace ?ws= link intact (it is a blob, not a short link)', async () => {
    const store = fakeStore();
    // A realistic large workspace replay blob — well past the old 2000-char cap
    // that would have truncated it into an unreconstructable link.
    const bigWorkspace = `https://algebranch.org/?ws=${'A'.repeat(9000)}`;
    const result = await reportFeedback({ ...VALID_BODY, shareLink: bigWorkspace }, store, openBudget(), openLimiter());
    expect(result.status).toBe(200);
    expect(JSON.parse(store.entries[0].json).shareLink).toBe(bigWorkspace);
  });

  it('clamps an out-of-range or non-numeric rating into 0..5', async () => {
    const store = fakeStore();
    await reportFeedback({ ...VALID_BODY, rating: 99 }, store, openBudget(), openLimiter());
    await reportFeedback({ ...VALID_BODY, rating: -3 }, store, openBudget(), openLimiter());
    await reportFeedback({ ...VALID_BODY, rating: 'lots' }, store, openBudget(), openLimiter());
    const ratings = store.entries.map((e) => JSON.parse(e.json).rating);
    expect(ratings).toEqual([0, 0, 5]); // newest-first: 'lots'->0, -3->0, 99->5
  });

  it('returns 429 when the per-instance limiter window is spent, without storing', async () => {
    const store = fakeStore();
    const limiter = createFixedWindowLimiter(2, 60_000, () => 0);
    expect((await reportFeedback(VALID_BODY, store, openBudget(), limiter)).status).toBe(200);
    expect((await reportFeedback(VALID_BODY, store, openBudget(), limiter)).status).toBe(200);
    expect((await reportFeedback(VALID_BODY, store, openBudget(), limiter)).status).toBe(429);
    expect(store.entries).toHaveLength(2);
  });

  it('returns 429 with the daily limit when the write budget is exhausted, without storing', async () => {
    const store = fakeStore();
    const result = await reportFeedback(VALID_BODY, store, spentBudget(), openLimiter());
    expect(result.status).toBe(429);
    if (result.status === 429) expect(result.body.dailyLimit).toBe(5000);
    expect(store.entries).toHaveLength(0);
  });

  it('does not spend the budget when the cheap limiter already rejected', async () => {
    const store = fakeStore();
    const budget = openBudget();
    const spy = vi.spyOn(budget, 'consume');
    const limiter = createFixedWindowLimiter(0, 60_000, () => 0);
    expect((await reportFeedback(VALID_BODY, store, budget, limiter)).status).toBe(429);
    expect(spy).not.toHaveBeenCalled();
  });

  it('generates a time-ordered fb: id', async () => {
    const store = fakeStore();
    const result = await reportFeedback(VALID_BODY, store, openBudget(), openLimiter(), fixedOpts);
    expect(result.status).toBe(200);
    if (result.status === 200) expect(result.body.id).toMatch(/^fb:/);
    expect(store.entries[0].id).toMatch(/^fb:0*1000000-abcd$/);
  });

  it('exports a sane production limiter default', () => {
    expect(FEEDBACK_MAX_PER_MINUTE).toBeGreaterThan(0);
  });
});

describe('readFeedback', () => {
  it('returns parsed entries newest-first up to the limit', async () => {
    const store = fakeStore();
    await reportFeedback({ ...VALID_BODY, subject: 'first' }, store, openBudget(), openLimiter());
    await reportFeedback({ ...VALID_BODY, subject: 'second' }, store, openBudget(), openLimiter());
    const entries = await readFeedback(store, 10);
    expect(entries).toHaveLength(2);
    expect(entries[0].record.subject).toBe('second');
    expect(entries[0].id).toMatch(/^fb:/);
  });
});

describe('feedbackAdminAuthorized', () => {
  it('accepts the exact bearer token and rejects everything else', () => {
    expect(feedbackAdminAuthorized('Bearer s3cret', 's3cret')).toBe(true);
    expect(feedbackAdminAuthorized('Bearer wrong', 's3cret')).toBe(false);
    expect(feedbackAdminAuthorized('s3cret', 's3cret')).toBe(false); // missing scheme
    expect(feedbackAdminAuthorized(null, 's3cret')).toBe(false);
  });

  it('fails closed when no admin token is configured', () => {
    expect(feedbackAdminAuthorized('Bearer anything', undefined)).toBe(false);
    expect(feedbackAdminAuthorized('Bearer ', '')).toBe(false);
  });
});
