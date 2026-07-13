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
  /** Injectable clock for tests; defaults to `() => new Date()`. */
  now?: () => Date;
}

export class CloudflareKvWriteBudget implements WriteBudget {
  readonly dailyCap: number;
  private readonly authHeader: string;
  private readonly valueUrl: (key: string) => string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(config: CloudflareKvWriteBudgetConfig) {
    ({ authHeader: this.authHeader, valueUrl: this.valueUrl } = kvValuesApi(config));
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.dailyCap = config.dailyCap ?? DEFAULT_DAILY_WRITE_BUDGET;
    this.now = config.now ?? (() => new Date());
  }

  /** The counter key for the current UTC day, e.g. `budget:2026-07-13`. */
  private counterKey(): string {
    return `budget:${this.now().toISOString().slice(0, 10)}`;
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
 * Build a {@link CloudflareKvWriteBudget} from environment variables: the same
 * three Cloudflare credentials as the store, plus the optional
 * `SHARE_DAILY_WRITE_BUDGET` dial (a positive integer). A malformed dial throws
 * rather than silently falling back — a mistyped cap on launch day must fail
 * loudly, not quietly run with the default.
 */
export function cloudflareKvWriteBudgetFromEnv(
  env: Record<string, string | undefined> = process.env,
): CloudflareKvWriteBudget {
  const config = cloudflareKvConfigFromEnv(env);
  const dial = env.SHARE_DAILY_WRITE_BUDGET;
  let dailyCap: number | undefined;
  if (dial !== undefined) {
    if (!/^[1-9][0-9]*$/.test(dial)) {
      throw new Error(`SHARE_DAILY_WRITE_BUDGET must be a positive integer, got: ${dial}`);
    }
    dailyCap = Number.parseInt(dial, 10);
  }
  return new CloudflareKvWriteBudget({ ...config, dailyCap });
}
