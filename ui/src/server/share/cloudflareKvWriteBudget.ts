// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type { CloudflareKvConfig } from './cloudflareKvStore';
import { cloudflareKvConfigFromEnv, kvValuesApi } from './cloudflareKvStore';
import type { WriteBudget } from './writeBudget';

/**
 * Cloudflare KV adapter for the share write budget (#505): a per-UTC-day counter
 * (`budget:<yyyy-mm-dd>`) in the *same* namespace as the shares themselves, so it
 * needs no new vendor, token, or storage. Each consume is a read-increment-write;
 * KV is last-write-wins and eventually consistent, so concurrent writers can lose
 * increments — the counter under-counts under load and the cap is approximate by
 * design. It bounds the bill; it is not a precise gate (per-client fairness is
 * the platform WAF rule's job, the first layer in #505 tranche A).
 *
 * Share ids are exactly 14 base62 chars (SHARE_ID_PATTERN), so the `budget:`
 * prefix can never collide with a stored share.
 */

/**
 * Default daily cap on share creates. Far above any plausible honest launch-day
 * volume (a great Show HN day is a few thousand visitors, a small fraction of
 * whom share) yet low enough that abuse can't mint meaningful permanent storage.
 * Overridable per deploy via `SHARE_DAILY_WRITE_BUDGET` — the launch-day dial.
 */
export const DEFAULT_DAILY_WRITE_BUDGET = 5000;

/**
 * Lifetime of a day-counter key. Two days comfortably outlives the UTC day the
 * counter guards (plus clock skew), then KV deletes it — the budget never adds
 * permanent storage of its own.
 */
const BUDGET_TTL_SECONDS = 2 * 24 * 60 * 60;

export interface CloudflareKvWriteBudgetConfig extends CloudflareKvConfig {
  /** Max creates per UTC day; defaults to {@link DEFAULT_DAILY_WRITE_BUDGET}. */
  dailyCap?: number;
  /**
   * Prefix for the day-counter key; defaults to `budget:` (the share budget). A
   * second, independent budget (e.g. feedback, #519) sharing the same namespace
   * passes its own prefix so the two counters never conflate — a feedback storm
   * must not report the share limit as reached, and vice versa. The prefix must
   * not collide with a 14-char base62 share id, so it contains a colon.
   */
  keyPrefix?: string;
  /** Injectable clock for tests; defaults to `() => new Date()`. */
  now?: () => Date;
}

export class CloudflareKvWriteBudget implements WriteBudget {
  readonly dailyCap: number;
  private readonly authHeader: string;
  private readonly valueUrl: (key: string) => string;
  private readonly fetchImpl: typeof fetch;
  private readonly keyPrefix: string;
  private readonly now: () => Date;

  constructor(config: CloudflareKvWriteBudgetConfig) {
    ({ authHeader: this.authHeader, valueUrl: this.valueUrl } = kvValuesApi(config));
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.dailyCap = config.dailyCap ?? DEFAULT_DAILY_WRITE_BUDGET;
    this.keyPrefix = config.keyPrefix ?? 'budget:';
    this.now = config.now ?? (() => new Date());
  }

  /** The counter key for the current UTC day, e.g. `budget:2026-07-13`. */
  private counterKey(): string {
    return `${this.keyPrefix}${this.now().toISOString().slice(0, 10)}`;
  }

  async consume(): Promise<boolean> {
    const valueUrl = this.valueUrl(this.counterKey());

    const read = await this.fetchImpl(valueUrl, {
      headers: { Authorization: this.authHeader },
    });
    let count = 0;
    if (read.status !== 404) {
      if (!read.ok) {
        throw new Error(`Cloudflare KV budget read failed: ${read.status}`);
      }
      // A corrupt counter parses to NaN → treat as 0; the next write overwrites
      // it with a clean integer, so the counter self-heals.
      const parsed = Number.parseInt(await read.text(), 10);
      count = Number.isNaN(parsed) ? 0 : parsed;
    }

    if (count >= this.dailyCap) return false;

    const write = await this.fetchImpl(`${valueUrl}?expiration_ttl=${BUDGET_TTL_SECONDS}`, {
      method: 'PUT',
      headers: { Authorization: this.authHeader, 'Content-Type': 'text/plain' },
      body: String(count + 1),
    });
    if (!write.ok) {
      throw new Error(`Cloudflare KV budget write failed: ${write.status}`);
    }
    return true;
  }
}

/**
 * Default daily cap on feedback writes (#519). Feedback shares the KV namespace —
 * and thus the same daily KV write quota — with short links, so this default is
 * deliberately lower than the share cap: honest feedback volume is a small
 * fraction of share volume, and a runaway here must not eat the share budget's
 * headroom. Overridable per deploy via `FEEDBACK_DAILY_WRITE_BUDGET`.
 */
export const DEFAULT_FEEDBACK_DAILY_WRITE_BUDGET = 1000;

/** Parse a positive-integer dial from `env`, throwing loudly if malformed. */
function parseDial(env: Record<string, string | undefined>, name: string): number | undefined {
  const dial = env[name];
  if (dial === undefined) return undefined;
  if (!/^[1-9][0-9]*$/.test(dial)) {
    throw new Error(`${name} must be a positive integer, got: ${dial}`);
  }
  return Number.parseInt(dial, 10);
}

/**
 * Build the share create budget from environment variables: the same three
 * Cloudflare credentials as the store, plus the optional `SHARE_DAILY_WRITE_BUDGET`
 * dial (a positive integer). A malformed dial throws rather than silently falling
 * back — a mistyped cap on launch day must fail loudly, not quietly run with the
 * default. Uses the default `budget:` counter prefix.
 */
export function cloudflareKvWriteBudgetFromEnv(
  env: Record<string, string | undefined> = process.env,
): CloudflareKvWriteBudget {
  const config = cloudflareKvConfigFromEnv(env);
  return new CloudflareKvWriteBudget({ ...config, dailyCap: parseDial(env, 'SHARE_DAILY_WRITE_BUDGET') });
}

/**
 * Build the feedback write budget (#519): same credentials/namespace, its own
 * `feedback-budget:` counter prefix so it is independent of the share budget, and
 * the optional `FEEDBACK_DAILY_WRITE_BUDGET` dial.
 */
export function cloudflareKvFeedbackBudgetFromEnv(
  env: Record<string, string | undefined> = process.env,
): CloudflareKvWriteBudget {
  const config = cloudflareKvConfigFromEnv(env);
  return new CloudflareKvWriteBudget({
    ...config,
    keyPrefix: 'feedback-budget:',
    dailyCap: parseDial(env, 'FEEDBACK_DAILY_WRITE_BUDGET') ?? DEFAULT_FEEDBACK_DAILY_WRITE_BUDGET,
  });
}
