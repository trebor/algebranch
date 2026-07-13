// @vitest-environment node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Route-core logic for the error beacon endpoint (#505 tranche B), tested in
// isolation with an injected sink and a fake clock. The thin `POST /api/errbeacon`
// route file is glue over `reportErrorBeacon`; the branches that matter — shape
// validation, the per-instance rate limit, defensive re-scrubbing, and field
// truncation — live and are pinned here. The endpoint deliberately stores nothing:
// an accepted beacon becomes one `console.error` line in Vercel logs.
import { describe, it, expect, vi } from 'vitest';
import {
  reportErrorBeacon,
  createFixedWindowLimiter,
  ERRBEACON_MAX_PER_MINUTE,
} from '@/server/errbeacon/errbeaconApi';
import { MAX_SIGNATURE_FIELD_CHARS } from '@/utils/errorBeacon';

const VALID_BODY = {
  message: 'boom',
  topFrame: 'at f (https://algebranch.org/_next/static/chunks/main.js:1:2)',
  version: '1.4.2',
  uaFamily: 'Firefox',
};

const openLimiter = () => createFixedWindowLimiter(1000, 60_000, () => 0);

describe('reportErrorBeacon', () => {
  it('accepts a well-formed signature (202) and logs exactly one line', () => {
    const sink = vi.fn();
    const result = reportErrorBeacon(VALID_BODY, sink, openLimiter());
    expect(result.status).toBe(202);
    expect(sink).toHaveBeenCalledTimes(1);
    const line = sink.mock.calls[0][0] as string;
    expect(line).toContain('boom');
    expect(line).toContain('1.4.2');
    expect(line).toContain('Firefox');
  });

  it('tolerates missing optional fields — only message is required', () => {
    const sink = vi.fn();
    const result = reportErrorBeacon({ message: 'boom' }, sink, openLimiter());
    expect(result.status).toBe(202);
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-object body (400) without logging', () => {
    const sink = vi.fn();
    for (const body of [null, undefined, 'boom', 42, ['boom']]) {
      expect(reportErrorBeacon(body, sink, openLimiter()).status).toBe(400);
    }
    expect(sink).not.toHaveBeenCalled();
  });

  it('rejects a missing / non-string / empty message (400) without logging', () => {
    const sink = vi.fn();
    for (const body of [{}, { message: 42 }, { message: '' }]) {
      expect(reportErrorBeacon(body, sink, openLimiter()).status).toBe(400);
    }
    expect(sink).not.toHaveBeenCalled();
  });

  it('re-scrubs URLs server-side — a hand-crafted ?eq= payload never reaches the log', () => {
    const sink = vi.fn();
    const result = reportErrorBeacon(
      {
        message: 'boom at https://algebranch.org/?eq=2x%2B1%3D5',
        topFrame: 'at f (https://algebranch.org/s#secretkey:1:2)',
      },
      sink,
      openLimiter(),
    );
    expect(result.status).toBe(202);
    const line = sink.mock.calls[0][0] as string;
    expect(line).not.toContain('eq=2x');
    expect(line).not.toContain('secretkey');
  });

  it('truncates over-long fields so one beacon cannot bloat the log', () => {
    const sink = vi.fn();
    reportErrorBeacon(
      { message: 'x'.repeat(MAX_SIGNATURE_FIELD_CHARS * 4) },
      sink,
      openLimiter(),
    );
    const line = sink.mock.calls[0][0] as string;
    expect(line.length).toBeLessThan(MAX_SIGNATURE_FIELD_CHARS * 2);
  });

  it('drops beacons over the per-minute limit (429) without logging', () => {
    const sink = vi.fn();
    const limiter = createFixedWindowLimiter(3, 60_000, () => 0);
    for (let i = 0; i < 3; i++) {
      expect(reportErrorBeacon(VALID_BODY, sink, limiter).status).toBe(202);
    }
    expect(reportErrorBeacon(VALID_BODY, sink, limiter).status).toBe(429);
    expect(sink).toHaveBeenCalledTimes(3);
  });

  it('does not spend the rate limit on invalid bodies', () => {
    const sink = vi.fn();
    const limiter = createFixedWindowLimiter(1, 60_000, () => 0);
    expect(reportErrorBeacon('junk', sink, limiter).status).toBe(400);
    expect(reportErrorBeacon(VALID_BODY, sink, limiter).status).toBe(202);
  });
});

describe('createFixedWindowLimiter', () => {
  it('resets when the window rolls over', () => {
    let now = 0;
    const limiter = createFixedWindowLimiter(2, 60_000, () => now);
    expect(limiter.tryAccept()).toBe(true);
    expect(limiter.tryAccept()).toBe(true);
    expect(limiter.tryAccept()).toBe(false);
    now = 60_001;
    expect(limiter.tryAccept()).toBe(true);
  });

  it('exports a sane production default', () => {
    expect(ERRBEACON_MAX_PER_MINUTE).toBeGreaterThan(0);
  });
});
