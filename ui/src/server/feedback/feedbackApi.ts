// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

// Framework-agnostic core for the first-party feedback endpoint (#519). The Next
// route file (`app/api/feedback/route.ts`) is thin glue that parses the body,
// calls in here with a concrete FeedbackStore, WriteBudget, and RateLimiter, and
// maps the returned `{ status, body }` onto a Response. Keeping the logic here —
// with the store injected — lets every branch be unit-tested without Next's
// request plumbing or a live Cloudflare namespace.
//
// This is modelled on the error beacon (`errbeaconApi.ts`) and share
// (`shareApi.ts`) cores, but differs in one deliberate way: the error beacon
// *scrubs* URLs because its output lands in public server logs, whereas feedback
// is content the user chose to send — including the workspace/equation link they
// explicitly attached — and lands behind an authenticated admin read. So we
// *keep* the content verbatim; the guards here are shape validation, per-field
// size caps (bill + abuse bound), and the two rate gates.

import type { FeedbackStore } from './feedbackStore';
import type { RateLimiter } from '@/server/errbeacon/errbeaconApi';
import type { WriteBudget } from '@/server/share/writeBudget';

// Re-exported so the feedback route can pull its limiter from one module. The
// fixed-window limiter is generic (it first shipped with the error beacon, #505);
// feedback reuses it as the cheap per-instance shield in front of the KV budget.
export { createFixedWindowLimiter } from '@/server/errbeacon/errbeaconApi';

/**
 * Per-instance accept cap per minute — the cheap first-line abuse guard, checked
 * before the write budget so a flood never spends KV reads/writes. Honest use is
 * a few reports per session, far below this; the limiter mainly blunts a scripted
 * burst against a single serverless instance. The global daily bound is the
 * write budget (a KV counter); this is only the in-memory shield in front of it.
 */
export const FEEDBACK_MAX_PER_MINUTE = 10;

/**
 * Per-field character caps. Feedback is kept verbatim, so these bound a single
 * stored value (and the bill) against both an over-sharing honest user and abuse.
 * `steps` and `message` are generous — a long derivation or a detailed report is
 * exactly the actionable feedback we want — while the environment fields are tight
 * since they come from a known, bounded shape.
 */
export const FEEDBACK_FIELD_CAPS = {
  subject: 200,
  message: 5000,
  steps: 10000,
  context: 500,
  // The attached workspace is a self-contained `?ws=` replay blob (not a KV
  // short link — feedback spends no share keys), and those blobs get long: a
  // full workspace is exactly the case that overflows a small cap and would be
  // silently truncated into an unreconstructable link. 16 KB comfortably holds a
  // real workspace while keeping the whole stored record well under KV's 64 KB
  // value limit.
  shareLink: 16384,
  device: 40,
  browser: 40,
  os: 40,
  userAgent: 500,
} as const;

export type FeedbackKind = 'bug' | 'feature';

/** The validated, capped report as stored (and as the admin read returns it). */
export interface FeedbackRecord {
  type: FeedbackKind;
  subject: string;
  message: string;
  rating: number;
  context: string;
  steps: string;
  shareLink: string;
  device: string;
  browser: string;
  os: string;
  userAgent: string;
  /** ISO timestamp the server accepted the report — the sort key for the read. */
  receivedAt: string;
}

/** Result of a create request — the route wrapper maps it onto `Response.json`. */
export type CreateFeedbackResult =
  | { status: 200; body: { id: string } }
  | { status: 429; body: { error: string; dailyLimit?: number } }
  | { status: 400 | 500; body: { error: string } };

/** Injectable clock + id-suffix source so the id is deterministic under test. */
export interface ReportFeedbackOptions {
  now?: () => number;
  suffix?: () => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A required non-blank string field, trimmed and capped; `null` when invalid. */
function requiredText(value: unknown, cap: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, cap);
}

/** An optional string field: absent/non-string becomes '', then capped. */
function optionalText(value: unknown, cap: number): string {
  return (typeof value === 'string' ? value : '').slice(0, cap);
}

/** Clamp a rating into the 0..5 star range; anything non-numeric becomes 0. */
function normalizeRating(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(5, Math.max(0, Math.round(value)));
}

/**
 * A time-ordered store id: `fb:<zero-padded-ms>-<suffix>`. Zero-padding the
 * millisecond clock keeps the keys lexicographically sortable (so a KV prefix
 * list comes back in chronological order), and the random suffix makes two
 * reports in the same millisecond distinct. The `fb:` prefix cannot collide with
 * a 14-char base62 share id or the `budget:`/`feedback-budget:` counters that
 * share the namespace.
 */
function feedbackId(now: number, suffix: string): string {
  return `fb:${String(now).padStart(15, '0')}-${suffix}`;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Validate, cap, and persist one feedback report. Flow: shape-check → cheap
 * per-instance rate limit → global write budget → store. Validation runs first
 * so junk never spends a rate gate; the in-memory limiter runs before the budget
 * so a burst costs no KV round-trip; the budget runs before the store so an
 * exhausted day (429) costs no write.
 */
export async function reportFeedback(
  input: unknown,
  store: FeedbackStore,
  budget: WriteBudget,
  limiter: RateLimiter,
  opts: ReportFeedbackOptions = {},
): Promise<CreateFeedbackResult> {
  if (!isRecord(input)) {
    return { status: 400, body: { error: 'Expected a JSON object body.' } };
  }

  const { type } = input;
  if (type !== 'bug' && type !== 'feature') {
    return { status: 400, body: { error: 'Invalid feedback type.' } };
  }

  const subject = requiredText(input.subject, FEEDBACK_FIELD_CAPS.subject);
  if (subject === null) {
    return { status: 400, body: { error: 'Missing subject.' } };
  }
  const message = requiredText(input.message, FEEDBACK_FIELD_CAPS.message);
  if (message === null) {
    return { status: 400, body: { error: 'Missing message.' } };
  }

  if (!limiter.tryAccept()) {
    return { status: 429, body: { error: 'Too many reports. Please try again shortly.' } };
  }
  if (!(await budget.consume())) {
    return { status: 429, body: { error: 'Daily feedback limit reached.', dailyLimit: budget.dailyCap } };
  }

  const now = (opts.now ?? Date.now)();
  const record: FeedbackRecord = {
    type,
    subject,
    message,
    rating: normalizeRating(input.rating),
    context: optionalText(input.context, FEEDBACK_FIELD_CAPS.context),
    steps: optionalText(input.steps, FEEDBACK_FIELD_CAPS.steps),
    shareLink: optionalText(input.shareLink, FEEDBACK_FIELD_CAPS.shareLink),
    device: optionalText(input.device, FEEDBACK_FIELD_CAPS.device),
    browser: optionalText(input.browser, FEEDBACK_FIELD_CAPS.browser),
    os: optionalText(input.os, FEEDBACK_FIELD_CAPS.os),
    userAgent: optionalText(input.userAgent, FEEDBACK_FIELD_CAPS.userAgent),
    receivedAt: new Date(now).toISOString(),
  };

  const id = feedbackId(now, (opts.suffix ?? randomSuffix)());
  await store.put(id, JSON.stringify(record));
  return { status: 200, body: { id } };
}

/** One entry as the admin read returns it: the id plus the parsed record. */
export interface FeedbackReadEntry {
  id: string;
  record: FeedbackRecord;
}

/**
 * The most recent `limit` reports, newest first, parsed for the admin view. A
 * value that fails to parse is skipped rather than throwing, so one corrupt key
 * can't take down the whole read.
 */
export async function readFeedback(store: FeedbackStore, limit: number): Promise<FeedbackReadEntry[]> {
  const raw = await store.list(limit);
  const entries: FeedbackReadEntry[] = [];
  for (const { id, json } of raw) {
    try {
      entries.push({ id, record: JSON.parse(json) as FeedbackRecord });
    } catch {
      // Skip a corrupt value — one bad key must not break the whole read.
    }
  }
  return entries;
}

/**
 * Whether an `Authorization` header authorizes the admin read. Fails closed: with
 * no configured token (`expected` unset or empty) *nothing* is authorized, so a
 * deploy that forgot to set the secret exposes no feedback. Requires the exact
 * `Bearer <token>` form and compares in length-constant time.
 */
export function feedbackAdminAuthorized(header: string | null, expected: string | undefined): boolean {
  if (!expected) return false;
  if (typeof header !== 'string') return false;
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  return timingSafeEqual(header.slice(prefix.length), expected);
}

/** Length-constant string comparison — avoids leaking the token via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
